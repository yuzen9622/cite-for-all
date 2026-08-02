import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { normalizeDoi } from "@/lib/citation-engine/input-parser"
import type { CslItem } from "@/lib/citation-engine/types"
import {
  cslFromMetadata,
  rebuildReferenceCitations,
} from "@/lib/references/reference-writer"
import { MAX_BATCH_SIZE, type CitationMetadata } from "@/lib/citations"

const MAX_REFERENCES_PER_PROJECT = 500
const providerSchema = z.enum(["doi.org", "crossref", "datacite", "openalex"])
const inputTypeSchema = z.enum(["doi", "title"])

const metadataSchema = z
  .object({
    title: z.string().trim().min(1),
    authors: z.array(z.string().trim().min(1)),
    year: z.number().int().positive().nullable().optional(),
    journal: z.string().trim().nullable().optional(),
    volume: z.string().trim().nullable().optional(),
    issue: z.string().trim().nullable().optional(),
    pages: z.string().trim().nullable().optional(),
    doi: z.string().trim().nullable().optional(),
    publisher: z.string().trim().nullable().optional(),
    url: z.string().trim().nullable().optional(),
    type: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

const referenceInputSchema = z.object({
  input: z.string().trim().min(1).max(500),
  inputType: inputTypeSchema,
  metadata: metadataSchema,
  csl: z.record(z.string(), z.unknown()).optional(),
  provenance: z
    .object({
      provider: providerSchema,
      providerId: z.string().min(1),
      match: z.enum(["doi-exact", "title-exact"]),
    })
    .optional(),
})

const requestSchema = z
  .object({ items: z.array(referenceInputSchema).min(1).max(MAX_BATCH_SIZE) })
  .strict()

const reorderSchema = z
  .object({
    referenceIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(MAX_REFERENCES_PER_PROJECT)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict()

type ReferenceMetadata = z.infer<typeof metadataSchema>

class CapacityError extends Error {}
class FormattingError extends Error {}
class OrderConflictError extends Error {}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

function databaseUnavailable() {
  return json({ error: "資料庫暫時無法使用，請稍後再試。" }, 503)
}

async function getUserId() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { response: json({ error: "請先登入。" }, 401) }
    }

    return { userId: session.user.id }
  } catch (error) {
    console.error("[references] Unable to load session", error)
    return { response: databaseUnavailable() }
  }
}

function canonicalDoi(value: string | null | undefined) {
  if (!value?.trim()) {
    return null
  }

  const normalized = normalizeDoi(value)
  return normalized || null
}

function withCanonicalDoi(metadata: ReferenceMetadata): ReferenceMetadata {
  return { ...metadata, doi: canonicalDoi(metadata.doi) }
}

function baseCsl(
  value: Record<string, unknown> | undefined,
  metadata: ReferenceMetadata
) {
  const fallback = cslFromMetadata(metadata as unknown as CitationMetadata)
  const merged = value ? { ...fallback, ...value } : fallback

  return {
    ...merged,
    id:
      typeof merged.id === "string" && merged.id.trim()
        ? merged.id
        : fallback.id,
    type:
      typeof merged.type === "string" && merged.type.trim()
        ? merged.type
        : fallback.type,
    title:
      typeof merged.title === "string" && merged.title.trim()
        ? merged.title
        : fallback.title,
  } as CslItem
}

function isSerializationConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const code = "code" in error ? error.code : undefined
  const message = error instanceof Error ? error.message : ""
  return code === "P2034" || message.includes("40001")
}

function isUniqueConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const code = "code" in error ? error.code : undefined
  return code === "P2002"
}

async function serializableTransaction<T>(
  callback: (transaction: Prisma.TransactionClient) => Promise<T>
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: "Serializable",
      })
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 1) {
        throw error
      }
    }
  }

  throw new Error("Serializable transaction failed")
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const identity = await getUserId()
  if (identity.response) {
    return identity.response
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "請提供有效的 JSON 請求。" }, 400)
  }

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "文獻排序資料格式不符合規定。" }, 400)
  }

  const { projectId } = await context.params

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: identity.userId },
      select: { id: true },
    })

    if (!project) {
      return json({ error: "找不到此專案。" }, 404)
    }

    const referenceIds = await serializableTransaction(async (transaction) => {
      const references = await transaction.reference.findMany({
        where: { projectId, project: { userId: identity.userId } },
        select: { id: true, sortOrder: true },
      })
      const requestedIds = new Set(parsed.data.referenceIds)

      if (
        references.length !== parsed.data.referenceIds.length ||
        references.some((reference) => !requestedIds.has(reference.id))
      ) {
        throw new OrderConflictError("文獻清單已變更，請重新排序。")
      }

      const maxSortOrder = references.reduce(
        (maximum, reference) => Math.max(maximum, reference.sortOrder),
        0
      )
      const temporaryOffset = maxSortOrder + references.length + 1

      await transaction.reference.updateMany({
        where: { projectId, project: { userId: identity.userId } },
        data: { sortOrder: { increment: temporaryOffset } },
      })

      for (const [index, referenceId] of parsed.data.referenceIds.entries()) {
        const updated = await transaction.reference.updateMany({
          where: {
            id: referenceId,
            projectId,
            project: { userId: identity.userId },
          },
          data: { sortOrder: index + 1 },
        })

        if (updated.count !== 1) {
          throw new OrderConflictError("文獻清單已變更，請重新排序。")
        }
      }

      return parsed.data.referenceIds
    })

    return json({ success: true, referenceIds })
  } catch (error) {
    if (error instanceof OrderConflictError) {
      return json({ error: error.message }, 409)
    }
    if (isSerializationConflict(error) || isUniqueConflict(error)) {
      return json({ error: "專案正在被其他操作修改，請重試。" }, 409)
    }

    console.error("[references] Unable to reorder references", error)
    return databaseUnavailable()
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const identity = await getUserId()
  if (identity.response) {
    return identity.response
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "請提供有效的 JSON 請求。" }, 400)
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "文獻資料格式不符合規定。" }, 400)
  }

  const { projectId } = await context.params

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: identity.userId },
      select: { id: true },
    })

    if (!project) {
      return json({ error: "找不到此專案。" }, 404)
    }

    const result = await serializableTransaction(async (transaction) => {
      const currentCount = await transaction.reference.count({
        where: { projectId, project: { userId: identity.userId } },
      })

      if (currentCount + parsed.data.items.length > MAX_REFERENCES_PER_PROJECT) {
        throw new CapacityError("此專案最多只能儲存 500 筆文獻。")
      }

      const maxOrder = await transaction.reference.aggregate({
        where: { projectId, project: { userId: identity.userId } },
        _max: { sortOrder: true },
      })
      let nextSortOrder = (maxOrder._max.sortOrder ?? 0) + 1

      const dois = parsed.data.items
        .map((item) => canonicalDoi(item.metadata.doi))
        .filter((doi): doi is string => Boolean(doi))
      const existing = dois.length
        ? await transaction.reference.findMany({
            where: {
              projectId,
              project: { userId: identity.userId },
              doi: { in: dois },
            },
            select: { doi: true },
          })
        : []
      const seenDois = new Set(
        existing.map((reference) => reference.doi).filter(Boolean)
      )
      const skipped: Array<{ input: string; reason: string }> = []
      const created = []

      for (const item of parsed.data.items) {
        const metadata = withCanonicalDoi(item.metadata)
        if (metadata.doi && seenDois.has(metadata.doi)) {
          skipped.push({ input: item.input, reason: "此 DOI 已存在於專案中。" })
          continue
        }

        let snapshot
        try {
          snapshot = rebuildReferenceCitations(
            baseCsl(item.csl, metadata),
            metadata as unknown as CitationMetadata
          )
        } catch (error) {
          throw new FormattingError(
            "文獻格式無法產生，未寫入任何資料。",
            { cause: error }
          )
        }

        const reference = await transaction.reference.create({
          data: {
            ...(item.csl ? {} : { id: snapshot.csl.id }),
            projectId,
            sortOrder: nextSortOrder,
            input: item.input,
            inputType: item.inputType,
            provider: item.provenance?.provider ?? null,
            providerId: item.provenance?.providerId ?? null,
            matchKind: item.provenance?.match ?? null,
            title: metadata.title,
            authors: metadata.authors,
            year: metadata.year ?? null,
            journal: metadata.journal ?? null,
            volume: metadata.volume ?? null,
            issue: metadata.issue ?? null,
            pages: metadata.pages ?? null,
            doi: metadata.doi,
            publisher: metadata.publisher ?? null,
            url: metadata.url ?? null,
            itemType: metadata.type ?? null,
            csl: snapshot.csl as unknown as Prisma.InputJsonValue,
            citations: snapshot.citations as unknown as Prisma.InputJsonValue,
            bibtex: snapshot.bibtex,
          },
        })
        created.push(reference)
        if (metadata.doi) {
          seenDois.add(metadata.doi)
        }
        nextSortOrder += 1
      }

      return { created, skipped }
    })

    return json(result, 201)
  } catch (error) {
    if (error instanceof CapacityError) {
      return json({ error: error.message }, 409)
    }
    if (error instanceof FormattingError) {
      return json({ error: error.message }, 422)
    }
    if (isSerializationConflict(error) || isUniqueConflict(error)) {
      return json({ error: "專案正在被其他操作修改，請重試。" }, 409)
    }

    console.error("[references] Unable to create references", error)
    return databaseUnavailable()
  }
}

import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { normalizeDoi } from "@/lib/citation-engine/input-parser"
import type { CslItem } from "@/lib/citation-engine/types"
import {
  rebuildReferenceCitations,
} from "@/lib/references/reference-writer"
import type { CitationMetadata } from "@/lib/citations"

const patchSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    authors: z.array(z.string().trim().min(1)).optional(),
    year: z.number().int().positive().nullable().optional(),
    journal: z.string().trim().nullable().optional(),
    volume: z.string().trim().nullable().optional(),
    issue: z.string().trim().nullable().optional(),
    pages: z.string().trim().nullable().optional(),
    doi: z.string().trim().nullable().optional(),
    publisher: z.string().trim().nullable().optional(),
    url: z.string().trim().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要一個可更新欄位。",
  })

class FormattingError extends Error {}

type ReferenceMetadata = {
  title: string
  authors: string[]
  year: number | null
  journal: string | null
  volume: string | null
  issue: string | null
  pages: string | null
  doi: string | null
  publisher: string | null
  url: string | null
  type: string | null
}

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
    console.error("[reference] Unable to load session", error)
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

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ projectId: string; referenceId: string }>
  }
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

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "文獻 metadata 不符合規定。" }, 400)
  }

  const { projectId, referenceId } = await context.params

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: identity.userId },
      select: { id: true },
    })
    if (!project) {
      return json({ error: "找不到此專案。" }, 404)
    }

    const reference = await prisma.reference.findFirst({
      where: {
        id: referenceId,
        projectId,
        project: { userId: identity.userId },
      },
    })
    if (!reference) {
      return json({ error: "找不到此文獻。" }, 404)
    }

    const metadata: ReferenceMetadata = {
      title: reference.title,
      authors: reference.authors,
      year: reference.year,
      journal: reference.journal,
      volume: reference.volume,
      issue: reference.issue,
      pages: reference.pages,
      doi: reference.doi,
      publisher: reference.publisher,
      url: reference.url,
      type: reference.itemType,
      ...parsed.data,
    }
    metadata.doi = canonicalDoi(metadata.doi)

    if (metadata.doi) {
      const duplicate = await prisma.reference.findFirst({
        where: {
          id: { not: referenceId },
          projectId,
          project: { userId: identity.userId },
          doi: metadata.doi,
        },
        select: { id: true },
      })
      if (duplicate) {
        return json({ error: "此 DOI 已存在於專案中。" }, 409)
      }
    }

    let snapshot
    try {
      snapshot = rebuildReferenceCitations(
        reference.csl as unknown as CslItem,
        metadata as unknown as CitationMetadata
      )
    } catch (error) {
      throw new FormattingError("文獻格式無法產生，原資料未變更。", {
        cause: error,
      })
    }

    const updated = await prisma.reference.updateMany({
      where: {
        id: referenceId,
        projectId,
        project: { userId: identity.userId },
      },
      data: {
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
        isEdited: true,
      },
    })

    if (updated.count === 0) {
      return json({ error: "找不到此文獻。" }, 404)
    }

    const result = await prisma.reference.findFirst({
      where: {
        id: referenceId,
        projectId,
        project: { userId: identity.userId },
      },
    })

    return result ? json({ reference: result }) : json({ error: "找不到此文獻。" }, 404)
  } catch (error) {
    if (error instanceof FormattingError) {
      return json({ error: error.message }, 422)
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return json({ error: "此 DOI 已存在於專案中。" }, 409)
    }

    console.error("[reference] Unable to update reference", error)
    return databaseUnavailable()
  }
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ projectId: string; referenceId: string }>
  }
) {
  const identity = await getUserId()
  if (identity.response) {
    return identity.response
  }

  try {
    const { projectId, referenceId } = await context.params
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: identity.userId },
      select: { id: true },
    })
    if (!project) {
      return json({ error: "找不到此專案。" }, 404)
    }

    const deleted = await prisma.reference.deleteMany({
      where: {
        id: referenceId,
        projectId,
        project: { userId: identity.userId },
      },
    })

    return deleted.count
      ? json({ success: true })
      : json({ error: "找不到此文獻。" }, 404)
  } catch (error) {
    console.error("[reference] Unable to delete reference", error)
    return databaseUnavailable()
  }
}

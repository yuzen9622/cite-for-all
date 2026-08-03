import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

const MAX_PROJECTS = 50
const styleSchema = z.enum([
  "apa",
  "mla",
  "chicago",
  "harvard",
  "ieee",
  "vancouver",
  "bibtex",
])

const projectSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(500).nullable().optional(),
    defaultStyle: styleSchema.optional(),
  })
  .strict()

class CapacityError extends Error {}

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
    console.error("[projects] Unable to load session", error)
    return { response: databaseUnavailable() }
  }
}

function isSerializationConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const code = "code" in error ? error.code : undefined
  const message = error instanceof Error ? error.message : ""
  return code === "P2034" || message.includes("40001")
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

export async function GET() {
  const identity = await getUserId()
  if (identity.response) {
    return identity.response
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId: identity.userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { references: true } } },
    })

    return json({ projects })
  } catch (error) {
    console.error("[projects] Unable to list projects", error)
    return databaseUnavailable()
  }
}

export async function POST(request: Request) {
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

  const parsed = projectSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "專案名稱、描述或引用格式不符合規定。" }, 400)
  }

  try {
    const project = await serializableTransaction(async (transaction) => {
      const count = await transaction.project.count({
        where: { userId: identity.userId },
      })

      if (count >= MAX_PROJECTS) {
        throw new CapacityError("專案數量已達上限（50 個）。")
      }

      return transaction.project.create({
        data: {
          userId: identity.userId,
          name: parsed.data.name,
          description: parsed.data.description,
          defaultStyle: parsed.data.defaultStyle ?? "apa",
        },
        include: { _count: { select: { references: true } } },
      })
    })

    return json({ project }, 201)
  } catch (error) {
    if (error instanceof CapacityError) {
      return json({ error: error.message }, 409)
    }

    console.error("[projects] Unable to create project", error)
    return databaseUnavailable()
  }
}

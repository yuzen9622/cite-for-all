import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

const styleSchema = z.enum([
  "apa",
  "mla",
  "chicago",
  "harvard",
  "ieee",
  "vancouver",
  "bibtex",
])

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    defaultStyle: styleSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要一個可更新欄位。",
  })

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
    console.error("[project] Unable to load session", error)
    return { response: databaseUnavailable() }
  }
}

async function projectIdFromContext(
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params
  return projectId
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const identity = await getUserId()
  if (identity.response) {
    return identity.response
  }

  try {
    const projectId = await projectIdFromContext(context)
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: identity.userId },
      include: { references: { orderBy: { sortOrder: "asc" } } },
    })

    return project ? json({ project }) : json({ error: "找不到此專案。" }, 404)
  } catch (error) {
    console.error("[project] Unable to load project", error)
    return databaseUnavailable()
  }
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

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "專案更新內容不符合規定。" }, 400)
  }

  try {
    const projectId = await projectIdFromContext(context)
    const updated = await prisma.project.updateMany({
      where: { id: projectId, userId: identity.userId },
      data: parsed.data,
    })

    if (updated.count === 0) {
      return json({ error: "找不到此專案。" }, 404)
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: identity.userId },
      include: {
        references: { orderBy: { sortOrder: "asc" } },
        _count: { select: { references: true } },
      },
    })

    return project ? json({ project }) : json({ error: "找不到此專案。" }, 404)
  } catch (error) {
    console.error("[project] Unable to update project", error)
    return databaseUnavailable()
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const identity = await getUserId()
  if (identity.response) {
    return identity.response
  }

  try {
    const projectId = await projectIdFromContext(context)
    const deleted = await prisma.project.deleteMany({
      where: { id: projectId, userId: identity.userId },
    })

    return deleted.count
      ? json({ success: true })
      : json({ error: "找不到此專案。" }, 404)
  } catch (error) {
    console.error("[project] Unable to delete project", error)
    return databaseUnavailable()
  }
}

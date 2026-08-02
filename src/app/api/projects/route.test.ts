import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  projectCount: vi.fn(),
  projectCreate: vi.fn(),
  projectFindMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/db", () => ({
  prisma: {
    project: {
      count: mocks.projectCount,
      create: mocks.projectCreate,
      findMany: mocks.projectFindMany,
    },
    $transaction: mocks.transaction,
  },
}))

import { GET, POST } from "@/app/api/projects/route"

describe("/api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
  })

  it("requires an authenticated user", async () => {
    mocks.auth.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "請先登入。" })
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(mocks.projectFindMany).not.toHaveBeenCalled()
  })

  it("lists only the current user's projects", async () => {
    mocks.projectFindMany.mockResolvedValue([])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(mocks.projectFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { references: true } } },
    })
  })

  it("rejects invalid bodies without writing", async () => {
    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      })
    )

    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("checks the project capacity inside the transaction before create", async () => {
    const create = vi.fn()
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        project: {
          count: vi.fn().mockResolvedValue(50),
          create,
        },
      })
    )

    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Full" }),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "專案數量已達上限（50 個）。",
    })
    expect(create).not.toHaveBeenCalled()
  })
})

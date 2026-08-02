import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  projectFindFirst: vi.fn(),
  transaction: vi.fn(),
  rebuild: vi.fn(),
  cslFromMetadata: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/db", () => ({
  prisma: {
    project: { findFirst: mocks.projectFindFirst },
    $transaction: mocks.transaction,
  },
}))
vi.mock("@/lib/references/reference-writer", () => ({
  rebuildReferenceCitations: mocks.rebuild,
  cslFromMetadata: mocks.cslFromMetadata,
}))

import { POST } from "@/app/api/projects/[projectId]/references/route"

const context = { params: Promise.resolve({ projectId: "project-1" }) }

function request(items: unknown[]) {
  return new Request("http://localhost/api/projects/project-1/references", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
}

const item = {
  input: "DOI:10.1000/TEST",
  inputType: "doi",
  metadata: {
    title: "Title",
    authors: ["Doe, Jane"],
    doi: "https://doi.org/10.1000/test",
  },
}

describe("POST /api/projects/[projectId]/references", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.projectFindFirst.mockResolvedValue({ id: "project-1" })
    mocks.cslFromMetadata.mockReturnValue({
      id: "manual-id",
      type: "article-journal",
      title: "Title",
    })
    mocks.rebuild.mockReturnValue({
      csl: { id: "manual-id", type: "article-journal", title: "Title" },
      citations: {
        apa: "APA",
        mla: "MLA",
        chicago: "Chicago",
        harvard: "Harvard",
        ieee: "[1] IEEE",
        vancouver: "1. Vancouver",
      },
      bibtex: "@article{title}",
    })
  })

  it("returns 401 before querying the project", async () => {
    mocks.auth.mockResolvedValue(null)

    const response = await POST(request([item]), context)

    expect(response.status).toBe(401)
    expect(mocks.projectFindFirst).not.toHaveBeenCalled()
  })

  it("returns 404 for a project the user does not own", async () => {
    mocks.projectFindFirst.mockResolvedValue(null)

    const response = await POST(request([item]), context)

    expect(response.status).toBe(404)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("rejects capacity before any write in the same transaction", async () => {
    const create = vi.fn()
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        reference: {
          count: vi.fn().mockResolvedValue(499),
          aggregate: vi.fn(),
          findMany: vi.fn(),
          create,
        },
      })
    )

    const response = await POST(
      request([item, { ...item, input: "second" }]),
      context
    )

    expect(response.status).toBe(409)
    expect(create).not.toHaveBeenCalled()
  })

  it("normalizes DOI and skips an existing canonical DOI", async () => {
    const create = vi.fn()
    const findMany = vi.fn().mockResolvedValue([{ doi: "10.1000/test" }])
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        reference: {
          count: vi.fn().mockResolvedValue(0),
          aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: null } }),
          findMany,
          create,
        },
      })
    )

    const response = await POST(request([item]), context)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      created: [],
      skipped: [{ input: item.input, reason: "此 DOI 已存在於專案中。" }],
    })
    expect(findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        project: { userId: "user-1" },
        doi: { in: ["10.1000/test"] },
      },
      select: { doi: true },
    })
    expect(create).not.toHaveBeenCalled()
  })
})

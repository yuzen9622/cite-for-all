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

import { PATCH, POST } from "@/app/api/projects/[projectId]/references/route"

const context = { params: Promise.resolve({ projectId: "project-1" }) }

function request(items: unknown[]) {
  return new Request("http://localhost/api/projects/project-1/references", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
}

function reorderRequest(referenceIds: unknown[]) {
  return new Request("http://localhost/api/projects/project-1/references", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referenceIds }),
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

describe("PATCH /api/projects/[projectId]/references", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.projectFindFirst.mockResolvedValue({ id: "project-1" })
  })

  it("returns 401 before querying the project", async () => {
    mocks.auth.mockResolvedValue(null)

    const response = await PATCH(
      reorderRequest(["reference-2", "reference-1"]),
      context
    )

    expect(response.status).toBe(401)
    expect(mocks.projectFindFirst).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("rejects duplicate reference IDs before opening a transaction", async () => {
    const response = await PATCH(
      reorderRequest(["reference-1", "reference-1"]),
      context
    )

    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("returns 404 for a project the user does not own", async () => {
    mocks.projectFindFirst.mockResolvedValue(null)

    const response = await PATCH(
      reorderRequest(["reference-2", "reference-1"]),
      context
    )

    expect(response.status).toBe(404)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("rejects a stale order without changing sortOrder", async () => {
    const updateMany = vi.fn()
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        reference: {
          findMany: vi.fn().mockResolvedValue([
            { id: "reference-1", sortOrder: 1 },
            { id: "reference-2", sortOrder: 2 },
          ]),
          updateMany,
        },
      })
    )

    const response = await PATCH(reorderRequest(["reference-1"]), context)

    expect(response.status).toBe(409)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it("rejects an ID that does not belong to the project", async () => {
    const updateMany = vi.fn()
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        reference: {
          findMany: vi.fn().mockResolvedValue([
            { id: "reference-1", sortOrder: 1 },
            { id: "reference-2", sortOrder: 2 },
          ]),
          updateMany,
        },
      })
    )

    const response = await PATCH(
      reorderRequest(["reference-1", "foreign-reference"]),
      context
    )

    expect(response.status).toBe(409)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it("moves every row aside before assigning the requested order", async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        reference: {
          findMany: vi.fn().mockResolvedValue([
            { id: "reference-1", sortOrder: 1 },
            { id: "reference-2", sortOrder: 2 },
          ]),
          updateMany,
        },
      })
    )

    const response = await PATCH(
      reorderRequest(["reference-2", "reference-1"]),
      context
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      referenceIds: ["reference-2", "reference-1"],
    })
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        projectId: "project-1",
        project: { userId: "user-1" },
      },
      data: { sortOrder: { increment: 5 } },
    })
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "reference-2",
        projectId: "project-1",
        project: { userId: "user-1" },
      },
      data: { sortOrder: 1 },
    })
    expect(updateMany).toHaveBeenNthCalledWith(3, {
      where: {
        id: "reference-1",
        projectId: "project-1",
        project: { userId: "user-1" },
      },
      data: { sortOrder: 2 },
    })
  })
})

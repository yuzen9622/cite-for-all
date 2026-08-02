import { beforeEach, describe, expect, it, vi } from "vitest"

const convertCitations = vi.fn()

vi.mock("@/lib/citation-service", () => ({
  convertCitations,
}))

describe("POST /api/cite", () => {
  beforeEach(() => {
    convertCitations.mockReset()
  })

  it("rejects malformed JSON and empty input", async () => {
    const { POST } = await import("@/app/api/cite/route")
    const malformed = await POST(
      new Request("http://localhost/api/cite", {
        method: "POST",
        body: "{",
      })
    )
    const empty = await POST(
      new Request("http://localhost/api/cite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: [] }),
      })
    )

    expect(malformed.status).toBe(400)
    expect(empty.status).toBe(400)
    expect(convertCitations).not.toHaveBeenCalled()
  })

  it("returns the backward-compatible result envelope and summary", async () => {
    convertCitations.mockResolvedValue([
      { success: true, input: "found", data: { success: true } },
      {
        success: false,
        input: "missing",
        status: 404,
        code: "NOT_FOUND",
        error: "not found",
      },
    ])
    const { POST } = await import("@/app/api/cite/route")
    const response = await POST(
      new Request("http://localhost/api/cite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: [" found ", "missing"] }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toMatchObject({
      results: [{ success: true }, { success: false, code: "NOT_FOUND" }],
      summary: { total: 2, succeeded: 1, failed: 1 },
    })
    expect(convertCitations).toHaveBeenCalledWith(
      ["found", "missing"],
      expect.any(AbortSignal)
    )
  })

  it("enforces the 30-item and 500-character limits", async () => {
    const { POST } = await import("@/app/api/cite/route")
    const tooMany = await POST(
      new Request("http://localhost/api/cite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: Array.from({ length: 31 }, (_, index) => `title-${index}`),
        }),
      })
    )
    const tooLong = await POST(
      new Request("http://localhost/api/cite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: ["x".repeat(501)] }),
      })
    )

    expect(tooMany.status).toBe(400)
    expect(tooLong.status).toBe(400)
    expect(convertCitations).not.toHaveBeenCalled()
  })
})

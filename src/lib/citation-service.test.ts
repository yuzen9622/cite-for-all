import { beforeEach, describe, expect, it, vi } from "vitest"
import { ResolutionError } from "@/lib/citation-engine/citation-resolver"

const createCitation = vi.fn()

vi.mock("@/lib/citation-engine/citation-engine", () => ({
  createCitation,
}))

describe("citation batch service", () => {
  beforeEach(() => {
    createCitation.mockReset()
  })

  it("preserves successful items when another input is not found", async () => {
    createCitation
      .mockResolvedValueOnce({
        success: true,
        inputType: "doi",
        metadata: { title: "Found", authors: [] },
        citations: {
          apa: "APA",
          mla: "MLA",
          chicago: "Chicago",
          harvard: "Harvard",
          ieee: "[1] IEEE",
          vancouver: "1. Vancouver",
        },
        bibtex: "@article{}",
        provenance: {
          provider: "crossref",
          providerId: "10.1000/found",
          match: "doi-exact",
        },
      })
      .mockRejectedValueOnce(
        new ResolutionError(
          "NOT_FOUND",
          "找不到完全符合此 DOI 的文獻，未產生引用。"
        )
      )

    const { convertCitations } = await import("@/lib/citation-service")
    const results = await convertCitations([
      "10.1000/found",
      "10.1000/missing",
    ])

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ success: true })
    expect(results[1]).toEqual({
      success: false,
      input: "10.1000/missing",
      status: 404,
      code: "NOT_FOUND",
      error: "找不到完全符合此 DOI 的文獻，未產生引用。",
    })
    expect(results[1]).not.toHaveProperty("metadata")
    expect(results[1]).not.toHaveProperty("citations")
  })
})

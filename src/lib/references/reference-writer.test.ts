import { describe, expect, it } from "vitest"
import { cslFromMetadata, rebuildReferenceCitations } from "@/lib/references/reference-writer"

describe("reference writer", () => {
  const metadata = {
    title: "Original title",
    authors: ["Doe, Jane"],
    year: 2024,
    journal: "Example Journal",
    volume: "12",
    issue: "3",
    pages: "1-9",
    doi: "DOI:10.1000/TEST",
  }

  it("creates a minimal CSL item that all formatters accept", () => {
    const csl = cslFromMetadata(metadata)

    expect(csl).toMatchObject({
      type: "article-journal",
      title: "Original title",
      DOI: "10.1000/test",
      author: [{ family: "Doe", given: "Jane" }],
    })
    expect(csl.id).toMatch(/^c[a-z0-9]{24}$/)
  })

  it("rebuilds every stored snapshot when metadata changes", () => {
    const original = cslFromMetadata(metadata)
    const before = rebuildReferenceCitations(original, metadata)
    const after = rebuildReferenceCitations(original, {
      ...metadata,
      title: "Edited title",
    })

    expect(after.csl.title).toBe("Edited title")
    expect(after.citations.apa).not.toBe(before.citations.apa)
    expect(after.citations.mla).not.toBe(before.citations.mla)
    expect(after.bibtex).not.toBe(before.bibtex)
  })
})

import { describe, expect, it } from "vitest"
import {
  cslFromMetadata,
  rebuildReferenceCitations,
} from "@/lib/references/reference-writer"

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
      DOI: "10.1000/TEST",
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

it("updates field provenance for edits without attributing manual changes to a provider", () => {
  const original = cslFromMetadata({
    title: "Original",
    authors: ["Doe, Jane"],
    year: 2024,
  })
  original.custom = {
    citationIntegrity: {
      status: "incomplete",
      missing: ["page"],
      conflicts: [],
      warnings: [],
      fields: {
        title: { provider: "doi.org", providerId: "source" },
        author: { provider: "crossref", providerId: "source" },
      },
    },
  }
  const after = rebuildReferenceCitations(
    original,
    { title: "Edited" },
    { edited: true },
  )
  expect(
    (
      after.csl.custom as {
        citationIntegrity: { fields: Record<string, { provider: string }> }
      }
    ).citationIntegrity.fields.title.provider,
  ).toBe("manual")
  expect(
    (
      after.csl.custom as {
        citationIntegrity: { fields: Record<string, { provider: string }> }
      }
    ).citationIntegrity.fields.author.provider,
  ).toBe("crossref")
})

import { describe, expect, it } from "vitest"
import type { CitationResult } from "@/lib/citations"
import { buildReferenceItems } from "@/lib/references/save-payload"

const successfulResult = {
  success: true,
  input: "10.1000/example",
  data: {
    success: true,
    inputType: "doi",
    metadata: {
      title: "Example article",
      authors: ["Doe, Jane"],
      year: 2024,
      journal: "Example Journal",
      doi: "10.1000/example",
    },
    csl: {
      id: "10.1000/example",
      type: "article-journal",
      title: "Example article",
      DOI: "10.1000/example",
    },
    citations: {
      apa: "APA",
      mla: "MLA",
      chicago: "Chicago",
      harvard: "Harvard",
      ieee: "[1] IEEE",
      vancouver: "1. Vancouver",
    },
    citationsHtml: {
      apa: "<i>APA</i>",
      mla: "<i>MLA</i>",
      chicago: "<i>Chicago</i>",
      harvard: "<i>Harvard</i>",
      ieee: "<i>IEEE</i>",
      vancouver: "<i>Vancouver</i>",
    },
    bibtex: "@article{example}",
    provenance: {
      provider: "crossref",
      providerId: "10.1000/example",
      match: "doi-exact",
    },
  },
} satisfies CitationResult

const failedResult = {
  success: false,
  input: "missing title",
  error: "not found",
} satisfies CitationResult

describe("buildReferenceItems", () => {
  it("keeps only successful conversion results", () => {
    const items = buildReferenceItems([successfulResult, failedResult])

    expect(items).toHaveLength(1)
    expect(items[0]?.input).toBe(successfulResult.input)
  })

  it("maps each save field from the successful result data", () => {
    expect(buildReferenceItems([successfulResult])).toEqual([
      {
        input: successfulResult.input,
        inputType: successfulResult.data.inputType,
        metadata: successfulResult.data.metadata,
        csl: successfulResult.data.csl,
        provenance: successfulResult.data.provenance,
      },
    ])
  })
})

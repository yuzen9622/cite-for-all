import { describe, expect, it, vi } from "vitest"
import {
  recordFromCsl,
  crossrefRecord,
  applyMetadataToCsl,
  dataciteRecord,
} from "@/lib/citation-engine/metadata-normalizer"
import {
  formatAllCitations,
  formatBibliography,
} from "@/lib/citation-engine/citation-formatter"
import { rebuildReferenceCitations } from "@/lib/references/reference-writer"
import {
  formatCitationExport,
  formatCitationExportHtml,
  formatRisExport,
} from "@/lib/export-citations"
import { abbreviateJournal } from "@/lib/citation-engine/journal-abbreviation"
import { CitationResolver } from "@/lib/citation-engine/citation-resolver"

const raw = {
  id: "audit",
  type: "article-journal",
  title: "A study of learning",
  author: [{ family: "Doe", given: "Jane" }],
  issued: { "date-parts": [[2024, 3, 15]] },
  "container-title": "Example Journal",
  volume: "12",
  issue: "2",
  page: "10-20",
  DOI: "10.1000/audit",
}
const record = (extra = {}) =>
  recordFromCsl({ ...raw, ...extra }, "doi.org", "audit")!
const exportable = (extra = {}) => {
  const r = record(extra)
  return { csl: r.csl, metadata: r.metadata, ...formatAllCitations(r.csl) }
}

describe("citation integrity audit: expected contracts", () => {
  it("keeps corporate authors after saving", () => {
    const r = record({ author: [{ literal: "World Health Organization" }] })
    const saved = rebuildReferenceCitations(r.csl, r.metadata)
    expect(saved.csl.author).toEqual(r.csl.author)
  })
  it("keeps compound family names after saving", () => {
    const r = record({ author: [{ given: "Juan", family: "García Márquez" }] })
    expect(rebuildReferenceCitations(r.csl, r.metadata).csl.author).toEqual(
      r.csl.author,
    )
  })
  it("keeps month and day after saving", () => {
    const r = record()
    expect(applyMetadataToCsl(r.csl, r.metadata).issued).toEqual(r.csl.issued)
  })
  it("preserves bibliographic fields and name particles", () => {
    const input = {
      ...raw,
      type: "chapter",
      editor: [{ family: "Smith", given: "John" }],
      edition: "2",
      ISBN: "9780387848587",
      "publisher-place": "New York",
      language: "de",
      author: [
        {
          family: "Beethoven",
          given: "Ludwig",
          "non-dropping-particle": "van",
          suffix: "Jr.",
        },
      ],
      accessed: { "date-parts": [[2026, 10, 8]] },
    }
    const r = recordFromCsl(input, "doi.org", "audit")!
    expect(r.csl).toMatchObject(input)
  })
  it("preserves article numbers", () => {
    const r = crossrefRecord({
      ...raw,
      page: undefined,
      "article-number": "e12345",
    })!
    expect(formatBibliography(r.csl, "apa")).toContain("Article e12345")
  })
  it("does not treat deposit creation date as publication date", () => {
    expect(
      record({ issued: undefined, created: { "date-parts": [[2026, 10, 8]] } })
        .metadata.year,
    ).toBeUndefined()
  })
  it("retains a valid published date when issued is empty", () => {
    expect(
      record({ issued: {}, "published-print": { "date-parts": [[2020, 6]] } })
        .metadata.year,
    ).toBe(2020)
  })
  it("keeps scientific superscript markup", () => {
    const r = record({ title: "Measurements of 10<sup>3</sup> cells" })
    expect(formatAllCitations(r.csl).citationsHtml.apa).toContain(
      "<sup>3</sup>",
    )
  })
  it("uses sentence case for an unambiguous APA title", () => {
    expect(
      formatBibliography(
        record({ title: "Effects of Learning on Memory" }).csl,
        "apa",
      ),
    ).toContain("Effects of learning on memory")
  })
  it("does not lowercase proper nouns for IEEE", () => {
    const output = formatBibliography(
      record({ title: "Learning English in Taiwan with Python" }).csl,
      "ieee",
    )
    expect(output).toContain("English in Taiwan with Python")
  })
  it("sorts author-date bibliographies and adds year suffixes", () => {
    const records = [
      exportable({ id: "z", DOI: "10.1000/z", title: "Zebra learning" }),
      exportable({ id: "a", DOI: "10.1000/a", title: "Alpha learning" }),
    ]
    const output = formatCitationExport(records, "apa")
    expect(output).toContain("2024a")
    expect(output.indexOf("Alpha")).toBeLessThan(output.indexOf("Zebra"))
  })
  it("retains rich text in saved citation snapshots", () => {
    const r = record()
    expect(rebuildReferenceCitations(r.csl, r.metadata)).toHaveProperty(
      "citationsHtml.apa",
    )
  })
  it("looks up punctuation-bearing journal keys", () => {
    expect(abbreviateJournal("Computers & Education")).toBe("Comput. Educ.")
  })
  it("does not lose old records in mixed rich text export", () => {
    const old = exportable({ title: "Old record" })
    delete (old as { citationsHtml?: unknown }).citationsHtml
    const output = formatCitationExportHtml(
      [old, exportable({ title: "New record" })],
      "apa",
    )
    expect(output).toContain("Old record")
  })
  it("preserves full RIS dates and editor data from CSL", () => {
    const r = {
      ...exportable({ type: "chapter" }),
      csl: {
        ...raw,
        type: "chapter",
        editor: [{ given: "John", family: "Smith" }],
      },
    }
    const output = formatRisExport([r])
    expect(output).toMatch(/2024\/03\/15/)
    expect(output).toContain("Smith")
  })
  it("does not stop metadata enrichment at a title-only DOI record", async () => {
    const partial = record({
      author: undefined,
      issued: undefined,
      "container-title": undefined,
      volume: undefined,
      issue: undefined,
      page: undefined,
    })
    const richer = record()
    const next = vi.fn().mockResolvedValue(richer)
    const resolver = new CitationResolver({
      doiProviders: [
        { name: "doi.org", getByDoi: async () => partial },
        { name: "crossref", getByDoi: next },
      ],
    })
    const result = await resolver.resolve("10.1000/audit")
    expect(result.record.csl.author).toEqual(richer.csl.author)
  })
  it("preserves Crossref group author names", () => {
    expect(
      crossrefRecord({ ...raw, author: [{ name: "Research Consortium" }] })
        ?.metadata.authors,
    ).toEqual(["Research Consortium"])
  })
  it("retains DataCite object publishers", () => {
    expect(
      dataciteRecord({
        attributes: {
          doi: "10.1000/data",
          titles: [{ title: "Dataset" }],
          types: { citeproc: "dataset" },
          publicationYear: 2024,
          publisher: { name: "Data Repository" },
        },
      })?.csl.publisher,
    ).toBe("Data Repository")
  })
  it("does not accept a different title after removing significant symbols", async () => {
    const resolver = new CitationResolver({
      titleProviders: [
        {
          name: "crossref",
          searchByTitle: async () => [
            record({ title: "Learning C", DOI: undefined }),
          ],
        },
      ],
    })
    await expect(resolver.resolve("Learning C++")).rejects.toThrow()
  })
  it("keeps generated BibTeX keys unique in a batch", () => {
    const items = [
      exportable({ id: "one", DOI: "10.1000/one", title: "Learning alpha" }),
      exportable({ id: "two", DOI: "10.1000/two", title: "Learning beta" }),
    ]
    const bib = formatCitationExport(items, "bibtex")
    const keys = [...bib.matchAll(/@\w+\{([^,]+)/g)].map((m) => m[1])
    expect(new Set(keys).size).toBe(2)
  })
})

import { describe, expect, it } from "vitest"
import { Cite } from "@citation-js/core"
import "@citation-js/plugin-bibtex"
import { readFileSync } from "node:fs"
import assets from "./assets.json"
import { recordFromCsl, applyMetadataToCsl } from "./metadata-normalizer"
import { mergeRecords, assessRecord } from "./record-quality"
import { formatAllCitations, formatBibliography } from "./citation-formatter"
import { formatBibtex, citationKey } from "./bibtex"
import { normalizeTitle } from "./title-matcher"
import {
  formatCitationExport,
  formatCitationExportHtml,
  formatCitationEntries,
  formatRisExport,
} from "../export-citations"
import type { CslItem } from "./types"

const item: CslItem = {
  id: "test",
  title: "Learning English in Taiwan with Python",
  type: "article-journal",
  author: [{ family: "García Márquez", given: "Juan" }],
  issued: { "date-parts": [[2024, 3, 15]] },
  "container-title": "Journal",
  DOI: "10.1000/test",
  page: "1-4",
}
const record = (overrides: Partial<CslItem> = {}) =>
  recordFromCsl({ ...item, ...overrides }, "crossref", "test")!
const exported = (csl: CslItem) => ({
  csl,
  metadata: recordFromCsl(csl, "crossref", "test")!.metadata,
  ...formatAllCitations(csl),
})

describe("citation integrity regression contracts", () => {
  it("keeps generated assets identical to their pinned source files", () => {
    for (const [file, contents] of Object.entries(assets))
      expect(contents).toBe(
        readFileSync(`src/lib/citation-engine/${file}`, "utf8"),
      )
  })
  it("preserves all fields on a no-op edit and untouched authors on a partial author edit", () => {
    const r = record({
      author: [...item.author!, { literal: "Research, Development Group" }],
    })
    expect(applyMetadataToCsl(r.csl, r.metadata)).toEqual(r.csl)
    expect(applyMetadataToCsl(r.csl, { title: "Changed" }).issued).toEqual(
      item.issued,
    )
    expect(
      applyMetadataToCsl(r.csl, {
        authors: [r.metadata.authors[0], "Smith, Jane"],
      }).author?.[0],
    ).toEqual(item.author![0])
    expect(
      applyMetadataToCsl(r.csl, { authors: [], year: null } as never).issued,
    ).toBeUndefined()
    expect(applyMetadataToCsl(r.csl, { authors: [] }).author).toBeUndefined()
  })
  it.each([
    [],
    [2024, 0],
    [2024, 13],
    [2023, 2, 29],
    [2024, 4, 31],
    [2024, 1, 0],
    [2024, 1, 1, 2],
  ])(
    "rejects invalid publication date %j and uses valid fallback",
    (...parts) => {
      const r = recordFromCsl(
        {
          ...item,
          issued: { "date-parts": [parts] },
          "published-print": { "date-parts": [[2020, 6, 1]] },
        },
        "crossref",
        "test",
      )!
      expect(r.csl.issued).toEqual({ "date-parts": [[2020, 6, 1]] })
    },
  )
  it("keeps leap dates and range dates", () => {
    expect(
      record({
        issued: {
          "date-parts": [
            [2024, 2, 29],
            [2024, 3, 1],
          ],
        },
      }).csl.issued,
    ).toEqual({
      "date-parts": [
        [2024, 2, 29],
        [2024, 3, 1],
      ],
    })
  })
  it("separates book series from chapter containers and retains edition/subtitle", () => {
    const book = record({
      type: "book",
      title: "The Elements of Statistical Learning",
      subtitle: "Data Mining, Inference, and Prediction",
      edition: "2",
      ISBN: "9780387848587",
      "container-title": "Springer Series in Statistics",
      publisher: "Springer",
    }).csl
    expect(book["collection-title"]).toBe("Springer Series in Statistics")
    expect(book["container-title"]).toBeUndefined()
    const output = formatAllCitations(book)
    expect(output.citations.apa).not.toContain("In Springer")
    expect(output.citations.apa).toContain("2nd ed.")
    expect(output.citationsHtml.apa).toMatch(/<i>The Elements/)
    expect(record({ type: "chapter" }).csl["container-title"]).toBe("Journal")
  })
  it("preserves nocase, scientific markup and non-English capitalization", () => {
    const title =
      'Effects of <i>Escherichia coli</i> at 10<sup>3</sup> in H<sub>2</sub>O: <span class="nocase">Taiwan</span>'
    const csl = record({ title }).csl
    expect(formatAllCitations(csl).citationsHtml.apa).toContain("<sup>3</sup>")
    expect(formatAllCitations(csl).citationsHtml.apa).toContain("<sub>2</sub>")
    expect(formatAllCitations(csl).citationsHtml.apa).toContain("Taiwan")
    expect(
      formatBibliography(
        record({ title: "Die Bedeutung Der Bildung", language: "de" }).csl,
        "apa",
      ),
    ).toContain("Die Bedeutung Der Bildung")
    expect(
      record({ title: '<img src=x onerror="alert(1)">Safe <i>title</i>' }).csl
        .title,
    ).toBe("Safe <i>title</i>")
    expect(formatBibtex(csl)).toContain("10\\textsuperscript{3}")
  })
  it("uses a manually verified sentence-case title without changing raw source title", () => {
    const csl = record({
      title: "Research in Unusual Places",
      "sentence-case-title": "Research in unusual places",
    }).csl
    expect(formatBibliography(csl, "apa")).toContain(
      "Research in unusual places",
    )
    expect(csl.title).toBe("Research in Unusual Places")
  })
  it("does not merge fields across incompatible titles or overwrite conflicting authors", () => {
    const base = record({ page: undefined })
    const wrong = mergeRecords(
      base,
      record({ title: "Different work", page: "99" }),
    )
    expect(wrong.csl.page).toBeUndefined()
    expect(wrong.quality?.status).toBe("conflicting")
    const conflict = mergeRecords(
      base,
      record({ author: [{ family: "Smith", given: "Jane" }] }),
    )
    expect(conflict.csl.author).toEqual(base.csl.author)
    expect(conflict.quality?.conflicts).toContain("author")
  })
  it("enriches dates by compatible precision and records field provenance", () => {
    const enriched = mergeRecords(
      record({ issued: { "date-parts": [[2024]] }, page: undefined }),
      { ...record(), provider: "doi.org", providerId: "doi-detail" },
    )
    expect(enriched.csl.issued).toEqual(item.issued)
    expect(enriched.quality?.fields.page.provider).toBe("doi.org")
    expect(
      assessRecord(record({ author: undefined, issued: undefined })).missing,
    ).toEqual(expect.arrayContaining(["author", "issued"]))
  })
  it("keeps semantic title symbols separate", () => {
    for (const title of [
      "Learning C++",
      "Learning C#",
      "Learning C+",
      "Learning C",
    ]) {
      expect(
        ["Learning C++", "Learning C#", "Learning C+", "Learning C"].filter(
          (other) => normalizeTitle(other) === normalizeTitle(title),
        ),
      ).toEqual([title])
    }
  })
  it("formats display, clipboard HTML and text as the same sorted bibliography", () => {
    const records = [
      exported({ ...item, id: "z", title: "Zebra", DOI: "10.1000/z" }),
      exported({ ...item, id: "a", title: "Alpha", DOI: "10.1000/a" }),
    ]
    const entries = formatCitationEntries(records, "apa")
    expect(entries.map((e) => e.index)).toEqual([1, 0])
    expect(entries[0].text).toContain("2024a")
    expect(entries[1].html).toContain("2024b")
    const html = formatCitationExportHtml(records, "apa")
    expect(html.indexOf("Alpha")).toBeLessThan(html.indexOf("Zebra"))
    expect(html.match(/<p /g)).toHaveLength(2)
    for (const style of ["ieee", "vancouver"] as const) {
      const numeric = formatCitationExportHtml(records, style, 5)
      expect(numeric).not.toContain("<div")
      expect(numeric.match(/<p /g)).toHaveLength(2)
      expect(numeric).toContain(style === "ieee" ? "[5]" : "5.")
      expect(formatCitationExport(records, style, 5)).toContain(
        style === "ieee" ? "[6]" : "6.",
      )
    }
  })
  it("round-trips BibTeX names, corporate authors, DOI, date and edition through an independent parser", () => {
    const csl = {
      ...item,
      type: "book",
      edition: "2",
      publisher: "Academic Press",
      author: [...item.author!, { literal: "World Health Organization" }],
    }
    const parsed = new Cite(formatBibtex(csl)).data[0] as CslItem
    expect(parsed.author?.[0]).toEqual(csl.author[0])
    expect(parsed.author?.[1]?.literal ?? parsed.author?.[1]?.family).toBe(
      "World Health Organization",
    )
    expect(parsed.author?.[1]?.given).toBeUndefined()
    expect(parsed.DOI).toBe(csl.DOI)
    expect(parsed.issued?.["date-parts"]?.[0]).toEqual([2024, 3, 15])
    expect(String(parsed.edition)).toBe("2")
    expect(citationKey({ ...csl, id: "changed-id" })).toBe(citationKey(csl))
  })
  it("exports RIS structured names, contributors, publication and access dates and identifiers", () => {
    const csl = {
      ...item,
      type: "chapter",
      author: [{ literal: "Research, Development Group" }, ...item.author!],
      editor: [{ family: "van Beethoven", given: "Ludwig" }],
      edition: "2",
      ISBN: "9780387848587",
      "publisher-place": "New York",
      accessed: { "date-parts": [[2026, 10, 9]] },
    }
    const ris = formatRisExport([exported(csl)])
    for (const expected of [
      "AU  - García Márquez, Juan",
      "AU  - Research,, Development Group",
      "A2  - van Beethoven, Ludwig",
      "DA  - 2024/03/15",
      "ET  - 2",
      "SN  - 9780387848587",
      "CY  - New York",
      "Y2  - 2026/10/9",
    ])
      expect(ris).toContain(expected)
  })
})

it("does not indent BibTeX fields rejected by EndNote's built-in filter", () => {
  expect(
    formatBibtex(item)
      .split("\n")
      .filter((line) => line.includes(" = "))
      .every((line) => /^\w+ = /.test(line)),
  ).toBe(true)
})

it("repairs legacy book-series display without changing stored CSL", () => {
  const csl = {
    ...item,
    type: "book",
    "container-title": "Springer Series in Statistics",
  }
  const before = structuredClone(csl)
  expect(formatBibliography(csl, "apa")).not.toContain("In Springer")
  expect(csl).toEqual(before)
})

it("does not mutate cached provenance or conflicts during enrichment", () => {
  const base = record({ page: undefined })
  base.quality = assessRecord(base)
  const before = structuredClone(base)
  mergeRecords(base, record({ author: [{ family: "Other" }] }))
  expect(base).toEqual(before)
})

it("preserves every legacy record in mixed HTML export", () => {
  const legacy = exported({ ...item, title: "Legacy title" })
  const mixed = {
    metadata: legacy.metadata,
    citations: legacy.citations,
    bibtex: legacy.bibtex,
  }
  const records = [mixed, exported({ ...item, id: "new", title: "New title" })]
  const html = formatCitationExportHtml(records, "apa")
  expect(html).toContain("Legacy title")
  expect(html).toContain("New title")
  expect(html.match(/<p /g)).toHaveLength(2)
})

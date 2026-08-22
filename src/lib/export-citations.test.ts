import { describe, expect, it } from "vitest"
import {
  citationExportHtml,
  citationExportText,
  formatCitationExportHtml,
  type CitationExportRecord,
} from "@/lib/export-citations"

const IEEE_ENTRY =
  '<div data-csl-entry-id="1" class="csl-entry">\n    <div class="csl-left-margin">[1]</div><div class="csl-right-inline">D. Gašević, “Big data,” <i>IEEE Trans. Learn. Technol.</i>, vol. 7, 2014, doi: 10.1109/X.</div>\n  </div>'

const record: CitationExportRecord = {
  metadata: { title: "Big data", authors: ["D. Gašević"] },
  citations: {
    apa: "Gašević, D. (2014). ...",
    mla: "Gašević, D. ...",
    chicago: "Gašević, D. 2014. ...",
    harvard: "Gašević, D. (2014) ...",
    ieee: "[1] D. Gašević, ...",
    vancouver: "1. Gašević D. ...",
  },
  citationsHtml: {
    apa: '<div class="csl-left-margin">(1)</div>',
    mla: '<div class="csl-left-margin">(1)</div>',
    chicago: '<div class="csl-left-margin">(1)</div>',
    harvard: '<div class="csl-left-margin">(1)</div>',
    ieee: IEEE_ENTRY,
    vancouver:
      '<div class="csl-left-margin">1.</div><div class="csl-right-inline">Gašević D. Big data. <i>J.</i> 2014.</div>',
  },
  bibtex: "@article{...}",
}

describe("citationExportHtml", () => {
  it("renumbers the IEEE bracket in the left margin", () => {
    expect(citationExportHtml(record, "ieee", 2, 1)).toContain(
      '<div class="csl-left-margin">[3]</div>',
    )
    expect(citationExportHtml(record, "ieee", 2, 1)).not.toContain(
      'csl-left-margin">[1]</div>',
    )
  })

  it("renumbers the Vancouver number in the left margin", () => {
    expect(citationExportHtml(record, "vancouver", 2, 1)).toContain(
      '<div class="csl-left-margin">3.</div>',
    )
  })

  it("keeps italics intact after renumbering", () => {
    const out = citationExportHtml(record, "ieee", 0, 4)
    expect(out).toContain("<i>IEEE Trans. Learn. Technol.</i>")
  })

  it("returns undefined for BibTeX and for records without HTML data", () => {
    expect(citationExportHtml(record, "bibtex", 0, 1)).toBeUndefined()

    const withoutHtml: CitationExportRecord = {
      ...record,
      citationsHtml: undefined,
    }
    expect(citationExportHtml(withoutHtml, "ieee", 0, 1)).toBeUndefined()
  })

  it("aggregates all entries for batch copy", () => {
    const joined = formatCitationExportHtml([record, record], "ieee", 1)
    expect(joined).toContain("[2]</div>")
    expect(joined).toContain("[2]</div>")
    expect(joined).toContain("<i>IEEE Trans. Learn. Technol.</i>")
  })

  it("mirrors the plain-text numbering for IEEE", () => {
    expect(citationExportText(record, "ieee", 2, 1)).toBe("[3] D. Gašević, ...")
  })
})

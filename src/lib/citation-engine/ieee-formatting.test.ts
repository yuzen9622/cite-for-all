import { describe, expect, it } from "vitest"
import {
  abbreviateJournal,
  resolveContainerTitleShort,
} from "@/lib/citation-engine/journal-abbreviation"
import { sentenceCaseTitle } from "@/lib/citation-engine/sentence-case"
import { cleanDoi, normalizeDoi } from "@/lib/citation-engine/input-parser"
import { formatAllCitations } from "@/lib/citation-engine/citation-formatter"
import type { CslItem } from "@/lib/citation-engine/types"

describe("IEEE end-to-end formatting", () => {
  const item: CslItem = {
    id: "10.1109/TLT.2013.6177701",
    type: "article-journal",
    title:
      "Big Data and Learning Analytics in Higher Education: A Look at Use Cases",
    author: [{ family: "Gašević", given: "Dragan" }],
    issued: { "date-parts": [[2014, 2]] },
    "container-title": "IEEE Transactions on Learning Technologies",
    "container-title-short": "IEEE Trans. Learn. Technol.",
    volume: "7",
    issue: "1",
    page: "94-107",
    DOI: "10.1109/TLT.2013.6177701",
  }

  it("produces a compliant IEEE periodical reference", () => {
    const out = formatAllCitations(item).citations.ieee
    expect(out).toBe(
      '[1] D. Gašević, “Big data and learning analytics in higher education: A look at use cases,” IEEE Trans. Learn. Technol., vol. 7, no. 1, pp. 94–107, Feb. 2014, doi: 10.1109/TLT.2013.6177701.'
    )
  })

  it("does not fabricate an issue number when absent", () => {
    const withoutIssue = { ...item, issue: undefined } as CslItem
    const out = formatAllCitations(withoutIssue).citations.ieee
    expect(out).not.toContain("no. ")
    expect(out).toContain("vol. 7, pp.")
  })

  it("omits the month when the source has only a year", () => {
    const yearOnly = { ...item, issued: { "date-parts": [[2014]] } } as CslItem
    const out = formatAllCitations(yearOnly).citations.ieee
    expect(out).toContain("2014,")
    expect(out).not.toMatch(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\. /)
  })

  it("uses a single page with p. and an en dash for ranges", () => {
    const single = { ...item, page: "94" } as CslItem
    expect(formatAllCitations(single).citations.ieee).toContain("p. 94")
  })
})

describe("IEEE journal abbreviation", () => {
  it("abbreviates IEEE journals per standard", () => {
    expect(abbreviateJournal("IEEE Transactions on Learning Technologies")).toBe(
      "IEEE Trans. Learn. Technol."
    )
    expect(abbreviateJournal("IEEE Transactions on Education")).toBe(
      "IEEE Trans. Educ."
    )
    expect(abbreviateJournal("IEEE Access")).toBe("IEEE Access")
  })

  it("is case- and punctuation-insensitive when matching", () => {
    expect(
      abbreviateJournal("Ieee transactions on learning technologies!")
    ).toBe("IEEE Trans. Learn. Technol.")
  })

  it("returns undefined for unknown journals", () => {
    expect(abbreviateJournal("Some Corpus Alien Journal")).toBeUndefined()
  })

  it("prefers curated abbreviation over provider short title", () => {
    expect(
      resolveContainerTitleShort(
        "IEEE Transactions on Learning Technologies",
        "IEEE Trans. Learning Technol."
      )
    ).toBe("IEEE Trans. Learn. Technol.")
  })

  it("falls back to provider short title when not curated", () => {
    expect(
      resolveContainerTitleShort("Some Journal", "Some J.")
    ).toBe("Some J.")
    expect(resolveContainerTitleShort("Some Journal", undefined)).toBeUndefined()
  })
})

describe("sentence-case title", () => {
  it("converts a Title-Case title to sentence case", () => {
    expect(
      sentenceCaseTitle(
        "Big Data and Learning Analytics in Higher Education: A Look at Use Cases"
      )
    ).toBe(
      "Big data and learning analytics in higher education: A look at use cases"
    )
  })

  it("keeps initial-, after-colon, and acronym capitalization", () => {
    expect(
      sentenceCaseTitle(
        "An AI-Powered MOOC and the IEEE Standard for Learning: OPEN Data Study"
      )
    ).toBe(
      "An AI-Powered MOOC and the IEEE standard for learning: OPEN data study"
    )
  })

  it("keeps CamelCase proper nouns and keeps already-lowercase words", () => {
    expect(sentenceCaseTitle("Learning with LaTeX and OpenAlex in 3D")).toBe(
      "Learning with LaTeX and OpenAlex in 3D"
    )
  })

  it("handles empty strings", () => {
    expect(sentenceCaseTitle("")).toBe("")
  })
})

describe("DOI case preservation", () => {
  it("cleanDoi preserves publisher casing", () => {
    expect(cleanDoi("10.1109/TLT.2013.6177701")).toBe("10.1109/TLT.2013.6177701")
  })

  it("cleanDoi strips doi:/URL prefixes and trailing punctuation", () => {
    expect(cleanDoi("DOI:  https://dx.doi.org/10.1109/TE.2020.001.")).toBe(
      "10.1109/TE.2020.001"
    )
  })

  it("normalizeDoi still lowercases for identity/cache keys", () => {
    expect(normalizeDoi("10.1109/TLT.2013.6177701")).toBe(
      "10.1109/tlt.2013.6177701"
    )
  })
})
import { describe, expect, it } from "vitest"
import {
  formatAllCitations,
  formatBibliography,
} from "@/lib/citation-engine/citation-formatter"
import type { CslItem } from "@/lib/citation-engine/types"

const article: CslItem = {
  id: "10.1000/test",
  type: "article-journal",
  title: "Test Title",
  author: [{ family: "Doe", given: "Jane" }],
  issued: { "date-parts": [[2024]] },
  "container-title": "Journal",
  volume: "1",
  issue: "2",
  page: "3-4",
  DOI: "10.1000/test",
}

describe("CSL and BibTeX formatting", () => {
  it("uses the pinned APA 7 style", () => {
    expect(formatBibliography(article, "apa")).toBe(
      "Doe, J. (2024). Test Title. Journal, 1(2), 3–4. https://doi.org/10.1000/test"
    )
  })

  it("produces all six CSL formats and BibTeX", () => {
    const output = formatAllCitations(article)

    expect(Object.keys(output.citations)).toEqual([
      "apa",
      "mla",
      "chicago",
      "harvard",
      "ieee",
      "vancouver",
    ])
    expect(output.citations.ieee).toMatch(/^\[1\]/)
    expect(output.citations.vancouver).toMatch(/^1\./)
    expect(output.bibtex).toContain("@article{")
    expect(output.bibtex).toContain("doi = {10.1000/test}")
  })

  it.each([
    {
      id: "book",
      type: "book",
      title: "A Book",
      author: [{ literal: "Research Group" }],
      issued: { "date-parts": [[2020]] },
      publisher: "Academic Press",
    },
    {
      id: "chapter",
      type: "chapter",
      title: "A Chapter",
      author: [{ family: "王", given: "小明" }],
      issued: { "date-parts": [[2021]] },
      "container-title": "Collected Work",
      page: "10-20",
    },
    {
      id: "conference",
      type: "paper-conference",
      title: "A Conference Paper",
      author: [{ family: "Doe", given: "Alex" }],
      issued: { "date-parts": [[2022]] },
      "container-title": "Proceedings",
    },
    {
      id: "dataset",
      type: "dataset",
      title: "A Dataset",
      author: [{ literal: "Open Data Lab" }],
      issued: { "date-parts": [[2023]] },
      publisher: "Repository",
    },
    {
      id: "minimal",
      type: "article-journal",
      title: "Article Without Volume Issue Pages or DOI",
      author: [{ family: "Smith", given: "Sam" }],
      issued: { "date-parts": [[2024]] },
      "container-title": "Journal",
    },
  ] satisfies CslItem[])(
    "formats a supported $type record with incomplete optional metadata",
    (item) => {
      const output = formatAllCitations(item)
      expect(Object.values(output.citations).every(Boolean)).toBe(true)
      expect(output.bibtex).toMatch(/^@/)
    }
  )
})

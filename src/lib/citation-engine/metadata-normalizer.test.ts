import { describe, expect, it } from "vitest"
import {
  crossrefRecord,
  dataciteRecord,
  recordFromCsl,
} from "@/lib/citation-engine/metadata-normalizer"

describe("metadata normalization", () => {
  it("maps a Crossref work into canonical CSL and public metadata", () => {
    const result = crossrefRecord({
      DOI: "10.1000/TEST",
      type: "journal-article",
      title: ["<i>A &amp; B</i>"],
      subtitle: ["A Review"],
      author: [{ given: "Jane", family: "Doe" }],
      issued: { "date-parts": [[2024, 3, 1]] },
      "container-title": ["Journal"],
      volume: "12",
      issue: "3",
      page: "1-9",
    })

    expect(result?.csl).toMatchObject({
      DOI: "10.1000/test",
      type: "article-journal",
      title: "A & B: A Review",
    })
    expect(result?.metadata).toMatchObject({
      authors: ["Jane Doe"],
      year: 2024,
      journal: "Journal",
    })
  })

  it("maps DataCite creators, title, date, and container", () => {
    const result = dataciteRecord({
      id: "10.5281/zenodo.1",
      attributes: {
        doi: "10.5281/ZENODO.1",
        titles: [{ title: "Dataset title" }],
        creators: [{ givenName: "Ada", familyName: "Lovelace" }],
        publicationYear: 2023,
        types: { citeproc: "dataset" },
        container: { title: "Zenodo" },
        publisher: "Zenodo",
      },
    })

    expect(result?.csl).toMatchObject({
      DOI: "10.5281/zenodo.1",
      type: "dataset",
      title: "Dataset title",
    })
    expect(result?.metadata.authors).toEqual(["Ada Lovelace"])
  })

  it("whitelists canonical CSL fields from a large DOI.org response", () => {
    const result = recordFromCsl(
      {
        DOI: "10.1000/test",
        type: "journal-article",
        title: "Article",
        "published-print": { "date-parts": [[2016, 3]] },
        page: "42-78",
        reference: [{ DOI: "10.1000/reference" }],
        license: [{ URL: "https://example.com/license" }],
      },
      "doi.org",
      "10.1000/test"
    )

    expect(result?.csl.issued).toEqual({ "date-parts": [[2016, 3]] })
    expect(result?.csl).not.toHaveProperty("reference")
    expect(result?.csl).not.toHaveProperty("license")
  })
})

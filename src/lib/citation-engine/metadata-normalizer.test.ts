import { describe, expect, it } from "vitest"
import type { CitationMetadata } from "@/lib/citations"
import {
  applyMetadataToCsl,
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
      DOI: "10.1000/TEST",
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
      DOI: "10.5281/ZENODO.1",
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

  it("merges editable metadata while preserving omitted CSL fields", () => {
    const base = {
      id: "source-id",
      type: "article-journal",
      title: "Original title",
      author: [{ given: "Ada", family: "Lovelace" }],
      issued: { "date-parts": [[2020, 4, 2]] },
      "container-title": "Original journal",
      DOI: "10.1000/original",
      ISSN: "1234-5678",
    }

    const result = applyMetadataToCsl(base, {
      title: "Edited title",
      authors: ["Doe, Jane"],
    })

    expect(result).toMatchObject({
      id: "source-id",
      title: "Edited title",
      author: [{ family: "Doe", given: "Jane" }],
      issued: { "date-parts": [[2020, 4, 2]] },
      "container-title": "Original journal",
      DOI: "10.1000/original",
      ISSN: "1234-5678",
    })
  })

  it("clears optional fields only when empty or null is explicit", () => {
    const result = applyMetadataToCsl(
      {
        id: "source-id",
        type: "article-journal",
        title: "Original title",
        issued: { "date-parts": [[2020]] },
        "container-title": "Original journal",
        DOI: "10.1000/original",
      },
      {
        title: "Original title",
        authors: [],
        year: null,
        journal: "",
        doi: "https://doi.org/10.1000/NEW.",
      } as unknown as CitationMetadata
    )

    expect(result).not.toHaveProperty("author")
    expect(result).not.toHaveProperty("issued")
    expect(result).not.toHaveProperty("container-title")
    expect(result.DOI).toBe("10.1000/NEW")
    expect(result.type).toBe("article-journal")
  })

  it("never drops the required CSL type", () => {
    const result = applyMetadataToCsl(
      { id: "source-id", type: "article-journal", title: "Title" },
      { title: "Title", authors: [], type: null } as unknown as CitationMetadata
    )

    expect(result.type).toBe("article-journal")
  })
})

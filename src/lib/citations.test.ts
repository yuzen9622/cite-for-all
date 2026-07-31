import { describe, expect, it } from "vitest"
import {
  formatRis,
  type CitationMetadata,
} from "@/lib/citations"

describe("RIS export", () => {
  it("formats journal metadata with repeated authors and split pages", () => {
    const metadata: CitationMetadata = {
      type: "article-journal",
      title: "Learning versus performance: An integrative review",
      authors: ["Soderstrom, Nicholas C.", "Bjork, Robert A."],
      year: 2015,
      journal: "Perspectives on Psychological Science",
      volume: "10",
      issue: "2",
      pages: "176–199",
      doi: "10.1177/1745691615569000",
    }

    expect(formatRis([metadata])).toBe(
      [
        "TY  - JOUR",
        "AU  - Soderstrom, Nicholas C.",
        "AU  - Bjork, Robert A.",
        "TI  - Learning versus performance: An integrative review",
        "JO  - Perspectives on Psychological Science",
        "PY  - 2015",
        "VL  - 10",
        "IS  - 2",
        "SP  - 176",
        "EP  - 199",
        "DO  - 10.1177/1745691615569000",
        "UR  - https://doi.org/10.1177/1745691615569000",
        "ER  - ",
        "",
      ].join("\r\n")
    )
  })

  it("separates multiple records and omits unavailable fields", () => {
    const records: CitationMetadata[] = [
      {
        type: "book",
        title: "First\nBook",
        authors: ["Author, Ada"],
        year: 2024,
        publisher: "Example Press",
      },
      {
        type: "dataset",
        title: "Reusable dataset",
        authors: [],
        url: "https://example.org/dataset",
      },
    ]

    const output = formatRis(records)

    expect(output).toContain("TY  - BOOK\r\n")
    expect(output).toContain("TI  - First Book\r\n")
    expect(output).toContain("PB  - Example Press\r\n")
    expect(output).toContain("ER  - \r\n\r\nTY  - DATA\r\n")
    expect(output).toContain("UR  - https://example.org/dataset\r\n")
    expect(output.endsWith("ER  - \r\n")).toBe(true)
    expect(output).not.toContain("AU  - \r\n")
  })
})

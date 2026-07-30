import { describe, expect, it } from "vitest"
import {
  matchExactTitle,
  normalizeTitle,
} from "@/lib/citation-engine/title-matcher"
import type { ProviderRecord } from "@/lib/citation-engine/types"

function record(title: string, doi: string): ProviderRecord {
  return {
    provider: "crossref",
    providerId: doi,
    csl: {
      id: doi,
      type: "article-journal",
      title,
      DOI: doi,
    },
    metadata: { title, authors: [], doi },
  }
}

describe("strict title matching", () => {
  it("ignores only presentation differences", () => {
    expect(normalizeTitle("<i>Meta–Analysis</i>: A Review")).toBe(
      "meta analysis a review"
    )
    expect(
      matchExactTitle("META-ANALYSIS: A REVIEW", [
        record("<i>Meta–Analysis</i>: A Review", "10.1000/a"),
      ])
    ).toMatchObject({ kind: "single" })
  })

  it("rejects typos, missing subtitles, and added semantic words", () => {
    const candidate = [
      record(
        "Effectiveness of intelligent tutoring systems: A meta-analytic review",
        "10.1000/a"
      ),
    ]

    expect(
      matchExactTitle(
        "Effectivness of intelligent tutoring systems: A meta-analytic review",
        candidate
      )
    ).toEqual({ kind: "none" })
    expect(
      matchExactTitle("Effectiveness of intelligent tutoring systems", candidate)
    ).toEqual({ kind: "none" })
    expect(
      matchExactTitle(
        "Effectiveness of modern intelligent tutoring systems: A meta-analytic review",
        candidate
      )
    ).toEqual({ kind: "none" })
  })

  it("rejects an exact title shared by multiple DOI records", () => {
    expect(
      matchExactTitle("Same title", [
        record("Same title", "10.1000/a"),
        record("Same title", "10.1000/b"),
      ])
    ).toEqual({ kind: "ambiguous" })
  })

  it("deduplicates the same DOI before deciding ambiguity", () => {
    expect(
      matchExactTitle("Same title", [
        record("Same title", "10.1000/a"),
        { ...record("Same title", "10.1000/a"), provider: "datacite" },
      ])
    ).toMatchObject({ kind: "single" })
  })
})

import { describe, expect, it } from "vitest"
import {
  classifyInput,
  extractDoi,
  isValidDoi,
  normalizeDoi,
} from "@/lib/citation-engine/input-parser"

describe("DOI input parsing", () => {
  it("canonicalizes DOI URLs and prefixes", () => {
    expect(normalizeDoi("https://doi.org/10.3102/0034654315581420")).toBe(
      "10.3102/0034654315581420"
    )
    expect(normalizeDoi("DOI: 10.1109/TLT.2023.3259013")).toBe(
      "10.1109/tlt.2023.3259013"
    )
  })

  it("extracts a DOI from a full reference without its trailing punctuation", () => {
    expect(
      extractDoi(
        "Kulik, J. A. (2016). Review. https://doi.org/10.3102/0034654315581420."
      )
    ).toBe("10.3102/0034654315581420")
  })

  it("rejects malformed DOI-like text as a title", () => {
    expect(isValidDoi("10.12/nope")).toBe(false)
    expect(classifyInput("10.12/nope")).toEqual({
      kind: "title",
      value: "10.12/nope",
    })
  })
})

export const STYLE_OPTIONS = [
  { id: "apa", label: "APA 7th" },
  { id: "mla", label: "MLA 9" },
  { id: "chicago", label: "Chicago" },
  { id: "harvard", label: "Harvard" },
  { id: "ieee", label: "IEEE" },
  { id: "vancouver", label: "Vancouver" },
  { id: "bibtex", label: "BibTeX" },
] as const

export type CitationStyle = (typeof STYLE_OPTIONS)[number]["id"]

export interface CitationMetadata {
  title: string
  authors: string[]
  year?: number
  journal?: string
  volume?: string
  issue?: string
  pages?: string
  doi?: string
  publisher?: string
  url?: string
  type?: string
}

export interface DoxaCitation {
  success: true
  inputType: "doi" | "title" | string
  metadata: CitationMetadata
  citations: Record<Exclude<CitationStyle, "bibtex">, string>
  bibtex: string
}

export type CitationResult =
  | {
      success: true
      input: string
      data: DoxaCitation
    }
  | {
      success: false
      input: string
      error: string
      status?: number
    }

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/gi

function cleanDoi(value: string) {
  let result = value.trim().replace(/[.,;:]+$/g, "")
  const opening = (result.match(/\(/g) ?? []).length
  const closing = (result.match(/\)/g) ?? []).length

  if (closing > opening) {
    result = result.replace(/\)+$/g, "")
  }

  return result
}

export function parseCitationInputs(rawInput: string) {
  return rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const doiMatches = line.match(DOI_PATTERN)
      return doiMatches?.length ? doiMatches.map(cleanDoi) : [line]
    })
}

export function citationText(
  result: Extract<CitationResult, { success: true }>,
  style: CitationStyle,
  resultIndex: number
) {
  const raw =
    style === "bibtex"
      ? result.data.bibtex
      : result.data.citations[style as Exclude<CitationStyle, "bibtex">]

  if (style === "ieee") {
    return raw.replace(/^\[1\]/, `[${resultIndex + 1}]`)
  }

  if (style === "vancouver") {
    return raw.replace(/^1\.\s*/, `${resultIndex + 1}. `)
  }

  return raw
}

export const MAX_BATCH_SIZE = 30

export const STYLE_OPTIONS = [
  { id: "apa", label: "APA 7th" },
  { id: "mla", label: "MLA 9" },
  { id: "chicago", label: "Chicago Author–Date" },
  { id: "harvard", label: "Harvard Cite Them Right" },
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

export interface CitationData {
  success: true
  inputType: "doi" | "title"
  metadata: CitationMetadata
  citations: Record<Exclude<CitationStyle, "bibtex">, string>
  bibtex: string
  provenance: {
    provider: "doi.org" | "crossref" | "datacite" | "openalex"
    providerId: string
    match: "doi-exact" | "title-exact"
  }
}

export type CitationResult =
  | {
      success: true
      input: string
      data: CitationData
    }
  | {
      success: false
      input: string
      error: string
      status?: number
      code?:
        | "NOT_FOUND"
        | "UPSTREAM_RATE_LIMITED"
        | "UPSTREAM_UNAVAILABLE"
        | "INTERNAL_ERROR"
    }

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/gi
const RIS_TYPE_BY_CSL: Record<string, string> = {
  "article-journal": "JOUR",
  "article-magazine": "MGZN",
  "article-newspaper": "NEWS",
  book: "BOOK",
  chapter: "CHAP",
  dataset: "DATA",
  manuscript: "MANSCPT",
  "paper-conference": "CONF",
  "post-weblog": "BLOG",
  report: "RPRT",
  thesis: "THES",
  webpage: "ELEC",
}

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

function cleanRisValue(value: string | number) {
  return String(value).replace(/\s+/g, " ").trim()
}

function appendRisField(
  lines: string[],
  tag: string,
  value: string | number | undefined
) {
  if (value === undefined) {
    return
  }

  const cleaned = cleanRisValue(value)
  if (cleaned) {
    lines.push(`${tag}  - ${cleaned}`)
  }
}

function risPages(pages: string | undefined) {
  const cleaned = pages ? cleanRisValue(pages) : ""
  const range = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/)

  return range
    ? { start: range[1], end: range[2] }
    : { start: cleaned || undefined, end: undefined }
}

function risType(metadata: CitationMetadata) {
  if (metadata.type && RIS_TYPE_BY_CSL[metadata.type]) {
    return RIS_TYPE_BY_CSL[metadata.type]
  }

  return metadata.journal ? "JOUR" : "GEN"
}

function risRecord(metadata: CitationMetadata) {
  const lines = [`TY  - ${risType(metadata)}`]
  const pages = risPages(metadata.pages)

  for (const author of metadata.authors) {
    appendRisField(lines, "AU", author)
  }

  appendRisField(lines, "TI", metadata.title)
  appendRisField(
    lines,
    metadata.type === "chapter" || metadata.type === "paper-conference"
      ? "T2"
      : "JO",
    metadata.journal
  )
  appendRisField(lines, "PY", metadata.year)
  appendRisField(lines, "VL", metadata.volume)
  appendRisField(lines, "IS", metadata.issue)
  appendRisField(lines, "SP", pages.start)
  appendRisField(lines, "EP", pages.end)
  appendRisField(lines, "DO", metadata.doi)
  appendRisField(lines, "PB", metadata.publisher)
  appendRisField(
    lines,
    "UR",
    metadata.url ??
      (metadata.doi ? `https://doi.org/${metadata.doi}` : undefined)
  )
  lines.push("ER  - ")

  return lines.join("\r\n")
}

export function formatRis(records: CitationMetadata[]) {
  if (records.length === 0) {
    return ""
  }

  return `${records.map(risRecord).join("\r\n\r\n")}\r\n`
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

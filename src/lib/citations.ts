import type { CslItem } from "@/lib/citation-engine/types"

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
  csl: CslItem
  citations: Record<Exclude<CitationStyle, "bibtex">, string>
  /** 含斜體等 Rich Text 標記的 HTML 版引用（UI 展示與 Rich Text 複製用） */
  citationsHtml: Record<Exclude<CitationStyle, "bibtex">, string>
  bibtex: string
  quality?: import("./citation-engine/record-quality").RecordQuality
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
  value: string | number | null | undefined,
) {
  if (value == null) {
    return
  }

  const cleaned = cleanRisValue(value)
  if (cleaned) {
    lines.push(`${tag}  - ${cleaned}`)
  }
}

function risPages(pages: string | null | undefined) {
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
    metadata.journal,
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
      (metadata.doi ? `https://doi.org/${metadata.doi}` : undefined),
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
  resultIndex: number,
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

export function risName(name: import("./citation-engine/types").CslName) {
  if (name.literal)
    return name.literal.includes(",")
      ? name.literal.replace(",", ",,")
      : `${name.literal},`
  const family = [name["non-dropping-particle"], name.family]
    .filter(Boolean)
    .join(" ")
  const given = [name.given, name["dropping-particle"]]
    .filter(Boolean)
    .join(" ")
  return `${family}, ${given}${name.suffix ? `, ${name.suffix}` : ""}`.trim()
}

/** Structured CSL is the authoritative source for interchange, not display names. */
export function formatRisCsl(items: CslItem[]) {
  return (
    items
      .map((c) => {
        const lines = [`TY  - ${RIS_TYPE_BY_CSL[c.type] ?? "GEN"}`]
        for (const name of c.author ?? [])
          appendRisField(lines, "AU", risName(name))
        for (const name of (c.editor ??
          []) as import("./citation-engine/types").CslName[])
          appendRisField(lines, "A2", risName(name))
        for (const name of (c.translator ??
          []) as import("./citation-engine/types").CslName[])
          appendRisField(lines, "A4", risName(name))
        const date = c.issued?.["date-parts"]?.[0]
        const pages = risPages(c.page)
        const fields: Record<string, unknown> = {
          TI: c.title.replace(/<[^>]*>/g, ""),
          T2: c["container-title"],
          T3: c["collection-title"],
          PY: date?.[0],
          DA: date
            ?.map((part, index) =>
              index ? String(part).padStart(2, "0") : String(part),
            )
            .join("/"),
          VL: c.volume,
          IS: c.issue,
          SP: pages.start,
          EP: pages.end,
          C7: c.number,
          DO: c.DOI,
          PB: c.publisher,
          CY: c["publisher-place"],
          ET: c.edition,
          SN: c.ISBN ?? c.ISSN,
          LA: c.language,
          UR: c.URL ?? (c.DOI ? `https://doi.org/${c.DOI}` : undefined),
          Y2: (
            c.accessed as import("./citation-engine/types").CslDate | undefined
          )?.["date-parts"]?.[0]?.join("/"),
        }
        for (const [tag, value] of Object.entries(fields))
          if (typeof value === "string" || typeof value === "number")
            appendRisField(lines, tag, value)
        lines.push("ER  - ")
        return lines.join("\r\n")
      })
      .join("\r\n\r\n") + (items.length ? "\r\n" : "")
  )
}

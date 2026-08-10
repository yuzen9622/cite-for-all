import { formatRis, type CitationMetadata, type CitationStyle } from "@/lib/citations"

export interface CitationExportRecord {
  metadata: CitationMetadata
  citations: Record<Exclude<CitationStyle, "bibtex">, string>
  /** 含斜體標記的 HTML 版引用；儲存的舊資料可能沒有（可選） */
  citationsHtml?: Record<Exclude<CitationStyle, "bibtex">, string>
  bibtex: string
}

export function citationExportText(
  record: CitationExportRecord,
  style: CitationStyle,
  index: number,
  startNumber = 1
) {
  const raw = style === "bibtex" ? record.bibtex : record.citations[style]
  const number = index + startNumber

  if (style === "ieee") {
    return raw.replace(/^\[1\]/, `[${number}]`)
  }

  if (style === "vancouver") {
    return raw.replace(/^1\.\s*/, `${number}. `)
  }

  return raw
}

/**
 * HTML 版引用，並把 CSL 產出的編號（[1]／1.）換成批次中的實際序號。
 * BibTeX 與無 HTML 資料的記錄回傳 undefined。
 */
export function citationExportHtml(
  record: CitationExportRecord,
  style: CitationStyle,
  index: number,
  startNumber = 1
) {
  if (style === "bibtex" || !record.citationsHtml) {
    return undefined
  }

  const raw = record.citationsHtml[style]
  const number = index + startNumber

  if (style === "ieee") {
    return raw.replace(
      /<div class="csl-left-margin">\[\d+\]<\/div>/,
      `<div class="csl-left-margin">[${number}]</div>`
    )
  }

  if (style === "vancouver") {
    return raw.replace(
      /<div class="csl-left-margin">\d+\.<\/div>/,
      `<div class="csl-left-margin">${number}.</div>`
    )
  }

  return raw
}

export function formatCitationExport(
  records: CitationExportRecord[],
  style: CitationStyle,
  startNumber = 1
) {
  return records
    .map((record, index) => citationExportText(record, style, index, startNumber))
    .join("\n\n")
}

export function formatCitationExportHtml(
  records: CitationExportRecord[],
  style: CitationStyle,
  startNumber = 1
) {
  return records
    .map((record, index) => citationExportHtml(record, style, index, startNumber))
    .filter((html): html is string => Boolean(html))
    .join("\n")
}

export function formatRisExport(records: CitationExportRecord[]) {
  return formatRis(records.map((record) => record.metadata))
}

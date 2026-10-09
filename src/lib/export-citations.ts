import {
  formatBibliographyBatch,
  formatBibliography,
  formatBibliographyHtml,
  formatBibtex,
} from "./citation-engine/citation-formatter"
import {
  applyMetadataToCsl,
  cslForOutput,
} from "./citation-engine/metadata-normalizer"
import type { CslItem } from "./citation-engine/types"
import { sanitizeHtml } from "./sanitize-html"

import {
  formatRisCsl,
  type CitationMetadata,
  type CitationStyle,
} from "@/lib/citations"

export interface CitationExportRecord {
  csl?: CslItem
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
  startNumber = 1,
) {
  const raw = record.csl
    ? style === "bibtex"
      ? formatBibtex(canonicalItem(record))
      : formatBibliography(record.csl, style)
    : style === "bibtex"
      ? record.bibtex
      : record.citations[style]
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
  startNumber = 1,
) {
  if (style === "bibtex") return undefined
  const raw = record.csl
    ? formatBibliographyHtml(record.csl, style)
    : record.citationsHtml?.[style]
  if (!raw) return undefined
  return wordBibliographyHtml(raw, style, index + startNumber)
}

export function formatCitationExport(
  records: CitationExportRecord[],
  style: CitationStyle,
  startNumber = 1,
) {
  if (!records.length) return ""
  if (style === "bibtex") return uniqueBibtex(records)
  if (records.some((record) => record.csl)) {
    return renumberText(
      formatBibliographyBatch(records.map(canonicalItem), style).text,
      style,
      startNumber,
    )
  }
  return records
    .map((record, index) =>
      citationExportText(record, style, index, startNumber),
    )
    .join("\n\n")
}

export function formatCitationExportHtml(
  records: CitationExportRecord[],
  style: CitationStyle,
  startNumber = 1,
) {
  if (style === "bibtex" || !records.length) return ""
  if (records.some((record) => record.csl)) {
    const output = formatBibliographyBatch(
      records.map(canonicalItem),
      style,
    ).html
    return wordBibliographyHtml(output, style, startNumber)
  }
  return records
    .map((record, index) =>
      wordBibliographyHtml(
        record.citationsHtml?.[style] ??
          `<div class="csl-entry">${escapeHtml(citationExportText(record, style, index, startNumber))}</div>`,
        style,
        startNumber + index,
      ),
    )
    .join("\n")
}

export function canonicalItem(record: CitationExportRecord): CslItem {
  return cslForOutput(
    record.csl ??
      applyMetadataToCsl(
        {
          id: record.metadata.doi ?? record.metadata.title,
          type: record.metadata.type ?? "article-journal",
          title: record.metadata.title,
        },
        record.metadata,
      ),
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renumberText(text: string, style: CitationStyle, start: number) {
  if (style === "ieee")
    return text.replace(/^\[(\d+)\]/gm, (_, n) => `[${Number(n) + start - 1}]`)
  if (style === "vancouver")
    return text.replace(/^(\d+)\.\s/gm, (_, n) => `${Number(n) + start - 1}. `)
  return text
}

/** A single p per reference makes Word keep the number and body in one paragraph. */
export function wordBibliographyHtml(
  html: string,
  style: CitationStyle,
  start = 1,
) {
  const entries = html
    .replace(/^<div class="csl-bib-body"[^>]*>\s*/i, "")
    .replace(/\s*<\/div>\s*$/i, "")
  let index = 0
  // CSL entries may contain left-margin/right-inline divs; split at the next entry.
  return entries
    .split(/(?=<div[^>]*class="csl-entry")/)
    .filter((part) => part.trim())
    .map((part) => {
      const number = start + index++
      const numbered = part.replace(
        /<div class="csl-left-margin">[\s\S]*?<\/div>/,
        style === "ieee" ? `[${number}]&#9;` : `${number}.&#9;`,
      )
      const inline = sanitizeHtml(numbered.replace(/<\/?div[^>]*>/g, "").trim())
      return `<p style="margin:0 0 8pt 36pt;text-indent:-36pt;line-height:1.5;">${inline}</p>`
    })
    .join("\n")
}

function uniqueBibtex(records: CitationExportRecord[]) {
  const used = new Set<string>()
  return records
    .map((record) => {
      const bib = record.csl
        ? formatBibtex(canonicalItem(record))
        : record.bibtex
      return bib.replace(/^(@\w+\{)([^,]+),/, (_, prefix, original) => {
        let key = original
        let suffix = 1
        while (used.has(key)) key = `${original}_${++suffix}`
        used.add(key)
        return `${prefix}${key},`
      })
    })
    .join("\n\n")
}

export function formatRisExport(records: CitationExportRecord[]) {
  return formatRisCsl(records.map(canonicalItem))
}

export function formatCitationEntries(
  records: CitationExportRecord[],
  style: CitationStyle,
  start = 1,
) {
  if (style === "bibtex" || !records.some((record) => record.csl)) {
    return records.map((record, index) => ({
      index,
      text: citationExportText(record, style, index, start),
      html: citationExportHtml(record, style, index, start),
    }))
  }
  return formatBibliographyBatch(records.map(canonicalItem), style).entries.map(
    (entry) => ({
      ...entry,
      text: renumberText(entry.text, style, start),
      html: wordBibliographyHtml(entry.html, style, start + entry.index),
    }),
  )
}

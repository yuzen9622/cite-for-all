import { formatRis, type CitationMetadata, type CitationStyle } from "@/lib/citations"

export interface CitationExportRecord {
  metadata: CitationMetadata
  citations: Record<Exclude<CitationStyle, "bibtex">, string>
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

export function formatCitationExport(
  records: CitationExportRecord[],
  style: CitationStyle,
  startNumber = 1
) {
  return records
    .map((record, index) => citationExportText(record, style, index, startNumber))
    .join("\n\n")
}

export function formatRisExport(records: CitationExportRecord[]) {
  return formatRis(records.map((record) => record.metadata))
}

import type { ProviderRecord } from "@/lib/citation-engine/types"

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
}

function decodedCodePoint(codePoint: number, fallback: string) {
  return Number.isInteger(codePoint) &&
    codePoint >= 0 &&
    codePoint <= 0x10ffff &&
    !(codePoint >= 0xd800 && codePoint <= 0xdfff)
    ? String.fromCodePoint(codePoint)
    : fallback
}

export function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, body: string) => {
      if (body.startsWith("#x") || body.startsWith("#X")) {
        const codePoint = Number.parseInt(body.slice(2), 16)
        return decodedCodePoint(codePoint, entity)
      }

      if (body.startsWith("#")) {
        const codePoint = Number.parseInt(body.slice(1), 10)
        return decodedCodePoint(codePoint, entity)
      }

      return HTML_ENTITIES[body.toLowerCase()] ?? entity
    }
  )
}

export function stripMarkup(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
}

export function normalizeTitle(value: string) {
  return stripMarkup(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function recordIdentity(record: ProviderRecord) {
  return record.csl.DOI?.toLowerCase() || `${record.provider}:${record.providerId}`
}

export function findSingleExactTitleMatch(
  requestedTitle: string,
  records: ProviderRecord[]
) {
  const result = matchExactTitle(requestedTitle, records)
  return result.kind === "single" ? result.record : null
}

export function matchExactTitle(
  requestedTitle: string,
  records: ProviderRecord[]
):
  | { kind: "none" }
  | { kind: "ambiguous" }
  | { kind: "single"; record: ProviderRecord } {
  const requested = normalizeTitle(requestedTitle)
  const uniqueMatches = new Map(
    records
      .filter((record) => normalizeTitle(record.metadata.title) === requested)
      .map((record) => [recordIdentity(record), record])
  )

  if (uniqueMatches.size === 0) {
    return { kind: "none" }
  }

  if (uniqueMatches.size > 1) {
    return { kind: "ambiguous" }
  }

  return { kind: "single", record: [...uniqueMatches.values()][0] }
}

export function exactTitleMatches(
  requestedTitle: string,
  records: ProviderRecord[]
) {
  const requested = normalizeTitle(requestedTitle)
  return records.filter(
    (record) => normalizeTitle(record.metadata.title) === requested
  )
}

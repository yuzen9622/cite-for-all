import type { InputKind } from "@/lib/citation-engine/types"

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/i
const DOI_EXACT_PATTERN = /^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/i
const APA_YEAR_SEPARATOR =
  /\(\s*(?:(?:18|19|20)\d{2}[a-z]?|n\.d\.)\s*\)\.\s+/i
const APA_AUTHOR_WITH_INITIALS =
  /(?:^|[,&]\s*)[\p{L}][\p{L}'’-]*,\s*(?:[\p{L}]\.\s*){1,4}/u
const APA_SOURCE_WITH_VOLUME =
  /,\s*\*?\d+\*?\s*(?:\(\s*\d+\s*\))?\s*,\s*(?:[a-z]?\d+|e\d+)\s*[-–—]\s*(?:[a-z]?\d+|e\d+)/i

function trimUnbalancedClosingParentheses(value: string) {
  const opening = (value.match(/\(/g) ?? []).length
  const closing = (value.match(/\)/g) ?? []).length

  return closing > opening ? value.replace(/\)+$/g, "") : value
}

export function normalizeDoi(value: string) {
  let normalized = value.trim()

  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // A malformed percent escape cannot be part of a valid DOI. Leave it as-is
    // so the syntax guard below rejects it.
  }

  normalized = normalized
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim()
    .replace(/[.,;:]+$/g, "")

  return trimUnbalancedClosingParentheses(normalized).toLowerCase()
}

export function extractDoi(value: string) {
  const normalized = normalizeDoi(value)

  if (DOI_EXACT_PATTERN.test(normalized)) {
    return normalized
  }

  const match = value.match(DOI_PATTERN)
  return match ? normalizeDoi(match[0]) : null
}

export function isValidDoi(value: string) {
  return DOI_EXACT_PATTERN.test(normalizeDoi(value))
}

function titleFromApaReference(value: string) {
  const yearSeparator = APA_YEAR_SEPARATOR.exec(value)
  if (!yearSeparator) {
    return null
  }

  const authorSegment = value.slice(0, yearSeparator.index)
  if (!APA_AUTHOR_WITH_INITIALS.test(authorSegment)) {
    return null
  }

  const remainder = value.slice(yearSeparator.index + yearSeparator[0].length)
  if (!remainder) {
    return null
  }

  for (const boundary of remainder.matchAll(/\.\s+/g)) {
    const source = remainder.slice(
      (boundary.index ?? 0) + boundary[0].length
    )
    if (/^[*_]/.test(source) || APA_SOURCE_WITH_VOLUME.test(source)) {
      return remainder.slice(0, (boundary.index ?? 0) + 1).trim()
    }
  }

  return remainder.trim()
}

export function classifyInput(value: string): {
  kind: InputKind
  value: string
} {
  const doi = extractDoi(value)
  if (doi) {
    return { kind: "doi", value: doi }
  }

  const trimmed = value.trim()
  return {
    kind: "title",
    value: titleFromApaReference(trimmed) ?? trimmed,
  }
}

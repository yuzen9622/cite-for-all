import type { InputKind } from "@/lib/citation-engine/types"

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/i
const DOI_EXACT_PATTERN = /^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/i

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

export function classifyInput(value: string): {
  kind: InputKind
  value: string
} {
  const doi = extractDoi(value)
  return doi ? { kind: "doi", value: doi } : { kind: "title", value: value.trim() }
}

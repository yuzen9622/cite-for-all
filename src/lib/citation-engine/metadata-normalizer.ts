import { normalizeDoi } from "@/lib/citation-engine/input-parser"
import { stripMarkup } from "@/lib/citation-engine/title-matcher"
import type {
  CslDate,
  CslItem,
  CslName,
  ProviderName,
  ProviderRecord,
} from "@/lib/citation-engine/types"

function text(value: unknown) {
  return typeof value === "string" && value.trim()
    ? stripMarkup(value).replace(/\s+/g, " ").trim()
    : undefined
}

function textFromFirst(value: unknown) {
  if (Array.isArray(value)) {
    return text(value[0])
  }

  return text(value)
}

function titleWithSubtitle(titleValue: unknown, subtitleValue: unknown) {
  const title = textFromFirst(titleValue)
  const subtitle = textFromFirst(subtitleValue)

  if (!title || !subtitle) {
    return title
  }

  return title.toLocaleLowerCase("en-US").endsWith(
    subtitle.toLocaleLowerCase("en-US")
  )
    ? title
    : `${title}: ${subtitle}`
}

function stringValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  return text(value)
}

function dateFromYear(year: unknown): CslDate | undefined {
  const parsed =
    typeof year === "number"
      ? year
      : typeof year === "string"
        ? Number.parseInt(year, 10)
        : Number.NaN

  return Number.isInteger(parsed) && parsed > 0
    ? { "date-parts": [[parsed]] }
    : undefined
}

function issuedDate(value: unknown): CslDate | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const dateParts = (value as { "date-parts"?: unknown })["date-parts"]
  if (
    Array.isArray(dateParts) &&
    Array.isArray(dateParts[0]) &&
    dateParts[0].every((part) => typeof part === "number")
  ) {
    return { "date-parts": [dateParts[0]] }
  }

  return undefined
}

function namesFromUnknown(value: unknown): CslName[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const names = value.flatMap((entry): CslName[] => {
    if (!entry || typeof entry !== "object") {
      return []
    }

    const record = entry as Record<string, unknown>
    const family = text(record.family)
    const given = text(record.given)
    const literal = text(record.literal)

    return family || given || literal ? [{ family, given, literal }] : []
  })

  return names.length ? names : undefined
}

function displayName(name: CslName) {
  return (
    [name.given, name.family].filter(Boolean).join(" ") ||
    name.literal ||
    "Unknown author"
  )
}

function cslType(value: unknown) {
  const type = text(value)
  const aliases: Record<string, string> = {
    "book-chapter": "chapter",
    "book-section": "chapter",
    "conference-paper": "paper-conference",
    "journal-article": "article-journal",
    "posted-content": "article",
    proceedings: "book",
    "proceedings-article": "paper-conference",
    "reference-entry": "entry-encyclopedia",
  }

  return type ? aliases[type] ?? type : "article-journal"
}

export function recordFromCsl(
  raw: Record<string, unknown>,
  provider: ProviderName,
  fallbackId: string
): ProviderRecord | null {
  const title = titleWithSubtitle(raw.title, raw.subtitle)
  if (!title) {
    return null
  }

  const doi = text(raw.DOI ?? raw.doi)
  const normalizedDoi = doi ? normalizeDoi(doi) : undefined
  const issued =
    issuedDate(
      raw.issued ??
        raw.published ??
        raw["published-print"] ??
        raw["published-online"] ??
        raw.created
    ) ?? dateFromYear(raw.year)
  const csl: CslItem = {
    id: text(raw.id) ?? normalizedDoi ?? fallbackId,
    type: cslType(raw.type),
    title,
    author: namesFromUnknown(raw.author),
    issued,
    "container-title": textFromFirst(raw["container-title"]),
    volume: stringValue(raw.volume),
    issue: stringValue(raw.issue),
    page: stringValue(raw.page),
    DOI: normalizedDoi,
    publisher: text(raw.publisher),
    URL: text(raw.URL ?? raw.url),
  }

  const year = issued?.["date-parts"]?.[0]?.[0]

  return {
    csl,
    provider,
    providerId: fallbackId,
    metadata: {
      title,
      authors: csl.author?.map(displayName) ?? [],
      year,
      journal: csl["container-title"],
      volume: csl.volume,
      issue: csl.issue,
      pages: csl.page,
      doi: csl.DOI,
      publisher: csl.publisher,
      url: csl.URL,
      type: csl.type,
    },
  }
}

export function crossrefRecord(
  raw: Record<string, unknown>
): ProviderRecord | null {
  const doi = text(raw.DOI)
  return recordFromCsl(
    {
      ...raw,
      id: doi ?? raw.URL,
      type: cslType(raw.type),
      title: textFromFirst(raw.title),
      author: raw.author,
      issued: raw.issued ?? raw.published ?? raw.created,
      "container-title": textFromFirst(raw["container-title"]),
      DOI: doi,
      URL: raw.URL,
    },
    "crossref",
    doi ?? text(raw.URL) ?? "crossref-record"
  )
}

export function dataciteRecord(
  raw: Record<string, unknown>
): ProviderRecord | null {
  const attributes =
    raw.attributes && typeof raw.attributes === "object"
      ? (raw.attributes as Record<string, unknown>)
      : raw
  const creators = Array.isArray(attributes.creators)
    ? attributes.creators.map((creator) => {
        const item =
          creator && typeof creator === "object"
            ? (creator as Record<string, unknown>)
            : {}
        const family = text(item.familyName)
        const given = text(item.givenName)
        const name = text(item.name)

        return family || given
          ? { family, given }
          : { literal: name ?? "Unknown author" }
      })
    : undefined
  const title = Array.isArray(attributes.titles)
    ? text(
        (attributes.titles[0] as Record<string, unknown> | undefined)?.title
      )
    : text(attributes.title)
  const types =
    attributes.types && typeof attributes.types === "object"
      ? (attributes.types as Record<string, unknown>)
      : {}
  const doi = text(attributes.doi ?? raw.id)
  const container =
    attributes.container && typeof attributes.container === "object"
      ? (attributes.container as Record<string, unknown>)
      : {}

  return recordFromCsl(
    {
      id: doi ?? raw.id,
      type: types.citeproc ?? "article",
      title,
      author: creators,
      issued: dateFromYear(attributes.publicationYear),
      "container-title": container.title,
      volume: container.volume,
      issue: container.issue,
      page:
        container.firstPage && container.lastPage
          ? `${container.firstPage}-${container.lastPage}`
          : container.firstPage,
      DOI: doi,
      publisher: attributes.publisher,
      URL: attributes.url ?? (doi ? `https://doi.org/${doi}` : undefined),
    },
    "datacite",
    doi ?? text(raw.id) ?? "datacite-record"
  )
}

export function openAlexRecord(
  raw: Record<string, unknown>
): ProviderRecord | null {
  const authorships = Array.isArray(raw.authorships) ? raw.authorships : []
  const authors = authorships.flatMap((authorship) => {
    if (!authorship || typeof authorship !== "object") {
      return []
    }

    const author = (authorship as Record<string, unknown>).author
    if (!author || typeof author !== "object") {
      return []
    }

    const name = text((author as Record<string, unknown>).display_name)
    return name ? [{ literal: name }] : []
  })
  const primaryLocation =
    raw.primary_location && typeof raw.primary_location === "object"
      ? (raw.primary_location as Record<string, unknown>)
      : {}
  const source =
    primaryLocation.source && typeof primaryLocation.source === "object"
      ? (primaryLocation.source as Record<string, unknown>)
      : {}
  const biblio =
    raw.biblio && typeof raw.biblio === "object"
      ? (raw.biblio as Record<string, unknown>)
      : {}
  const doiUrl = text(raw.doi)
  const doi = doiUrl ? normalizeDoi(doiUrl) : undefined

  return recordFromCsl(
    {
      id: raw.id,
      type: raw.type_crossref ?? "article-journal",
      title: raw.title ?? raw.display_name,
      author: authors,
      issued: dateFromYear(raw.publication_year),
      "container-title": source.display_name,
      volume: biblio.volume,
      issue: biblio.issue,
      page:
        biblio.first_page && biblio.last_page
          ? `${biblio.first_page}-${biblio.last_page}`
          : biblio.first_page,
      DOI: doi,
      publisher: source.host_organization_name,
      URL: primaryLocation.landing_page_url ?? raw.id,
    },
    "openalex",
    text(raw.id) ?? doi ?? "openalex-record"
  )
}

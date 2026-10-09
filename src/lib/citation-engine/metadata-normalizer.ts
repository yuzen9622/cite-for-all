import { cleanDoi, normalizeDoi } from "@/lib/citation-engine/input-parser"
import { resolveContainerTitleShort } from "@/lib/citation-engine/journal-abbreviation"
import { safeTitleMarkup } from "@/lib/citation-engine/title-markup"
import { stripMarkup } from "@/lib/citation-engine/title-matcher"
import type { CitationMetadata } from "@/lib/citations"
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
  const rich = (value: unknown) => {
    const first = Array.isArray(value) ? value[0] : value
    return typeof first === "string" ? safeTitleMarkup(first).trim() : undefined
  }
  const title = rich(titleValue)
  const subtitle = rich(subtitleValue)

  if (!title || !subtitle) {
    return title
  }

  return title
    .toLocaleLowerCase("en-US")
    .endsWith(subtitle.toLocaleLowerCase("en-US"))
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
      : typeof year === "string" && /^\d{1,4}$/.test(year)
        ? Number(year)
        : Number.NaN

  return Number.isInteger(parsed) && parsed > 0 && parsed <= 9999
    ? { "date-parts": [[parsed]] }
    : undefined
}

function issuedDate(value: unknown): CslDate | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const dateParts = (value as CslDate)["date-parts"]
  if (!Array.isArray(dateParts) || !dateParts.length || dateParts.length > 2)
    return undefined
  for (const parts of dateParts) {
    if (
      !Array.isArray(parts) ||
      !parts.length ||
      parts.length > 3 ||
      !parts.every(Number.isInteger) ||
      parts[0] < 1 ||
      parts[0] > 9999
    )
      return undefined
    const [year, month, day] = parts
    if (month !== undefined && (month < 1 || month > 12)) return undefined
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (day !== undefined && (day < 1 || day > days[month - 1]))
      return undefined
  }
  return { "date-parts": dateParts.map((parts) => [...parts]) }
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
    const literal = text(record.literal ?? record.name)

    if (!family && !given && !literal) return []
    const name: CslName = { family, given, literal }
    for (const key of [
      "non-dropping-particle",
      "dropping-particle",
      "suffix",
    ] as const) {
      if (text(record[key])) name[key] = text(record[key])
    }
    for (const key of ["comma-suffix", "static-ordering"] as const) {
      if (typeof record[key] === "boolean") name[key] = record[key]
    }
    return [name]
  })

  return names.length ? names : undefined
}

export function displayName(name: CslName) {
  return (
    [
      name.given,
      name["dropping-particle"],
      name["non-dropping-particle"],
      name.family,
      name.suffix,
    ]
      .filter(Boolean)
      .join(" ") ||
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

  return type ? (aliases[type] ?? type) : "article-journal"
}

export function recordFromCsl(
  raw: Record<string, unknown>,
  provider: ProviderName,
  fallbackId: string,
): ProviderRecord | null {
  const title = titleWithSubtitle(raw.title, raw.subtitle)
  if (!title) {
    return null
  }

  const doi = text(raw.DOI ?? raw.doi)
  const normalizedDoi = doi ? normalizeDoi(doi) : undefined
  const containerTitle = textFromFirst(raw["container-title"])
  const providerShort =
    textFromFirst(raw["container-title-short"]) ??
    textFromFirst(raw["short-container-title"]) ??
    textFromFirst(raw["journal-abbreviation"])
  const issued =
    [raw.issued, raw.published, raw["published-print"], raw["published-online"]]
      .map(issuedDate)
      .find(Boolean) ?? dateFromYear(raw.year)
  const csl: CslItem = {
    id: text(raw.id) ?? normalizedDoi ?? fallbackId,
    type: cslType(raw.type),
    title,
    author: namesFromUnknown(raw.author),
    issued,
    "container-title": containerTitle,
    "container-title-short": resolveContainerTitleShort(
      containerTitle,
      providerShort,
    ),
    volume: stringValue(raw.volume),
    issue: stringValue(raw.issue),
    page: stringValue(raw.page),
    DOI: doi ? cleanDoi(doi) : undefined,
    publisher:
      text(raw.publisher) ??
      text((raw.publisher as { name?: unknown } | null)?.name),
    URL: text(raw.URL ?? raw.url),
  }

  for (const key of [
    "editor",
    "translator",
    "container-author",
    "collection-editor",
  ] as const) {
    const names = namesFromUnknown(raw[key])
    if (names) csl[key] = names
  }
  for (const key of [
    "edition",
    "ISBN",
    "ISSN",
    "publisher-place",
    "language",
    "collection-title",
    "collection-number",
    "number",
    "article-number",
    "title-short",
    "event-title",
    "event-place",
    "genre",
    "version",
    "medium",
  ] as const) {
    const value =
      stringValue(raw[key]) ??
      (Array.isArray(raw[key])
        ? raw[key].map(stringValue).filter(Boolean).join("; ")
        : undefined)
    if (value) csl[key] = value
  }
  csl.edition ??= stringValue(raw["edition-number"])
  csl["publisher-place"] ??= text(raw["publisher-location"])
  csl.number ??= stringValue(raw["article-number"])
  const accessed = issuedDate(raw.accessed)
  if (accessed) csl.accessed = accessed
  // Crossref/DOI book containers describe the series, not a containing work.
  if (csl.type === "book" && containerTitle) {
    csl["collection-title"] ??= containerTitle
    delete csl["container-title"]
    delete csl["container-title-short"]
  }

  if (typeof raw["sentence-case-title"] === "string")
    csl["sentence-case-title"] = safeTitleMarkup(raw["sentence-case-title"])

  if (
    raw.custom &&
    typeof raw.custom === "object" &&
    !Array.isArray(raw.custom)
  )
    csl.custom = structuredClone(raw.custom)

  const year = issued?.["date-parts"]?.[0]?.[0]

  return {
    csl,
    provider,
    providerId: fallbackId,
    metadata: {
      title: stripMarkup(title).replace(/\s+/g, " ").trim(),
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

function nameFromDisplayName(value: string) {
  const name = value.trim()
  if (!name) {
    return null
  }

  if (name.endsWith(",")) return { literal: name.slice(0, -1).trim() }

  if (name.includes(",")) {
    const [family, ...givenParts] = name.split(",")
    const given = givenParts.join(",").trim()
    return given ? { family: family.trim(), given } : { literal: family.trim() }
  }

  // A display string cannot reliably identify personal/compound family names.
  return { literal: name }
}

function setOptionalCslField(
  target: CslItem,
  key: keyof CslItem,
  value: unknown,
) {
  if (value === null || value === "") {
    delete target[key]
    return
  }

  target[key] = value as never
}

function editableValue(metadata: Partial<CitationMetadata>, key: string) {
  return (metadata as unknown as Record<string, unknown>)[key]
}

function editableString(metadata: Partial<CitationMetadata>, key: string) {
  const value = editableValue(metadata, key)
  return typeof value === "string" || value === null ? value : undefined
}

export function applyMetadataToCsl(
  base: CslItem,
  metadata: Partial<CitationMetadata>,
): CslItem {
  const next: CslItem = { ...base }
  const title = editableString(metadata, "title")
  const authorsValue = editableValue(metadata, "authors")

  if (
    title !== null &&
    title !== undefined &&
    title.trim() &&
    title.trim() !== stripMarkup(base.title).replace(/\s+/g, " ").trim()
  ) {
    next.title = safeTitleMarkup(title.trim())
    delete next["sentence-case-title"]
  }

  if (
    Array.isArray(authorsValue) &&
    JSON.stringify(authorsValue) !==
      JSON.stringify(base.author?.map(displayName) ?? [])
  ) {
    const authors = authorsValue
      .filter((author): author is string => typeof author === "string")
      .map(
        (value) =>
          base.author?.find((name) => displayName(name) === value) ??
          nameFromDisplayName(value),
      )
      .filter((name): name is NonNullable<typeof name> => Boolean(name))

    if (authors.length) {
      next.author = authors
    } else {
      delete next.author
    }
  }

  const year = editableValue(metadata, "year")
  if (year !== undefined) {
    if (year === null) {
      delete next.issued
    } else if (typeof year === "number" && Number.isInteger(year) && year > 0) {
      if (year !== base.issued?.["date-parts"]?.[0]?.[0]) {
        next.issued = { "date-parts": [[year]] }
      }
    }
  }

  const journal = editableString(metadata, "journal")
  if (journal !== undefined) {
    const trimmedJournal = journal?.trim() ?? null
    const journalChanged = trimmedJournal !== (next["container-title"] ?? null)
    setOptionalCslField(next, "container-title", trimmedJournal)
    setOptionalCslField(
      next,
      "container-title-short",
      trimmedJournal
        ? resolveContainerTitleShort(
            trimmedJournal,
            journalChanged ? undefined : next["container-title-short"],
          )
        : null,
    )
  }
  const volume = editableString(metadata, "volume")
  if (volume !== undefined) {
    setOptionalCslField(next, "volume", volume?.trim() ?? null)
  }
  const issue = editableString(metadata, "issue")
  if (issue !== undefined) {
    setOptionalCslField(next, "issue", issue?.trim() ?? null)
  }
  const pages = editableString(metadata, "pages")
  if (pages !== undefined) {
    setOptionalCslField(next, "page", pages?.trim() ?? null)
  }
  const doiValue = editableString(metadata, "doi")
  if (doiValue !== undefined) {
    const doi = doiValue?.trim() ? cleanDoi(doiValue) : ""
    setOptionalCslField(next, "DOI", doi || null)
  }
  const publisher = editableString(metadata, "publisher")
  if (publisher !== undefined) {
    setOptionalCslField(next, "publisher", publisher?.trim() ?? null)
  }
  const url = editableString(metadata, "url")
  if (url !== undefined) {
    setOptionalCslField(next, "URL", url?.trim() ?? null)
  }

  next.type =
    editableString(metadata, "type")?.trim() || base.type || "article-journal"
  return next
}

export function crossrefRecord(
  raw: Record<string, unknown>,
): ProviderRecord | null {
  const doi = text(raw.DOI)
  return recordFromCsl(
    {
      ...raw,
      id: doi ?? raw.URL,
      type: cslType(raw.type),
      title: raw.title,
      author: raw.author,
      issued: raw.issued,
      "container-title": textFromFirst(raw["container-title"]),
      DOI: doi,
      URL: raw.URL,
    },
    "crossref",
    doi ?? text(raw.URL) ?? "crossref-record",
  )
}

export function dataciteRecord(
  raw: Record<string, unknown>,
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
    ? text((attributes.titles[0] as Record<string, unknown> | undefined)?.title)
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
    doi ?? text(raw.id) ?? "datacite-record",
  )
}

export function openAlexRecord(
  raw: Record<string, unknown>,
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
    text(raw.id) ?? doi ?? "openalex-record",
  )
}

/** Repair representational aliases for display/export without writing stored references. */
export function cslForOutput(item: CslItem): CslItem {
  const next = { ...item }
  if (next.type === "book" && next["container-title"]) {
    next["collection-title"] ??= next["container-title"]
    delete next["container-title"]
    delete next["container-title-short"]
  }
  next.number ??= next["article-number"]
  next.edition ??= next["edition-number"]
  next["publisher-place"] ??= next["publisher-location"]
  return next
}

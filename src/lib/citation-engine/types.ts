import type { CitationMetadata } from "@/lib/citations"

export type InputKind = "doi" | "title"

export type ProviderName = "doi.org" | "crossref" | "datacite" | "openalex"

export interface CslName {
  family?: string
  given?: string
  literal?: string
}

export interface CslDate {
  "date-parts"?: number[][]
  raw?: string
}

export interface CslItem {
  id: string
  type: string
  title: string
  author?: CslName[]
  issued?: CslDate
  "container-title"?: string
  "container-title-short"?: string
  volume?: string
  issue?: string
  page?: string
  DOI?: string
  publisher?: string
  URL?: string
  [key: string]: unknown
}

export interface ProviderRecord {
  csl: CslItem
  metadata: CitationMetadata
  provider: ProviderName
  providerId: string
}

export interface MetadataProvider {
  readonly name: ProviderName
  getByDoi?(doi: string, signal?: AbortSignal): Promise<ProviderRecord | null>
  searchByTitle?(
    title: string,
    signal?: AbortSignal
  ): Promise<ProviderRecord[]>
}

export type ProviderFailureKind =
  | "not-found"
  | "rate-limited"
  | "unavailable"
  | "invalid-response"

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly kind: ProviderFailureKind,
    message: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

export interface ResolvedCitation {
  inputType: InputKind
  record: ProviderRecord
}

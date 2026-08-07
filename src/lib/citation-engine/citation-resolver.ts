import { CitationCache } from "@/lib/citation-engine/citation-cache"
import {
  classifyInput,
  cleanDoi,
  normalizeDoi,
} from "@/lib/citation-engine/input-parser"
import {
  CrossrefProvider,
  DataCiteProvider,
  DoiContentProvider,
  OpenAlexProvider,
} from "@/lib/citation-engine/providers"
import {
  exactTitleMatches,
  normalizeTitle,
} from "@/lib/citation-engine/title-matcher"
import {
  ProviderError,
  type MetadataProvider,
  type ProviderRecord,
  type ResolvedCitation,
} from "@/lib/citation-engine/types"

export type ResolutionFailureCode =
  | "NOT_FOUND"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"

export class ResolutionError extends Error {
  constructor(
    public readonly code: ResolutionFailureCode,
    message: string
  ) {
    super(message)
    this.name = "ResolutionError"
  }
}

interface ResolverOptions {
  doiProviders?: MetadataProvider[]
  titleProviders?: MetadataProvider[]
  cache?: CitationCache<ProviderRecord>
}

function failureFromProviderErrors(errors: ProviderError[]) {
  if (errors.length > 0 && errors.every((error) => error.kind === "rate-limited")) {
    return new ResolutionError(
      "UPSTREAM_RATE_LIMITED",
      "文獻資料服務目前使用量較高，請稍後再試。"
    )
  }

  return new ResolutionError(
    "UPSTREAM_UNAVAILABLE",
    "文獻資料服務暫時無法回應，請稍後再試。"
  )
}

function recordIdentity(record: ProviderRecord) {
  return record.csl.DOI?.toLowerCase() || `${record.provider}:${record.providerId}`
}

export class CitationResolver {
  private readonly doiProviders: MetadataProvider[]
  private readonly titleProviders: MetadataProvider[]
  private readonly cache: CitationCache<ProviderRecord>

  constructor(options: ResolverOptions = {}) {
    this.doiProviders = options.doiProviders ?? [
      new DoiContentProvider(),
      new CrossrefProvider(),
      new DataCiteProvider(),
    ]
    this.titleProviders =
      options.titleProviders ??
      [
        new CrossrefProvider(),
        new DataCiteProvider(),
        ...(process.env.OPENALEX_API_KEY ? [new OpenAlexProvider()] : []),
      ]
    this.cache = options.cache ?? new CitationCache<ProviderRecord>()
  }

  async resolve(input: string, signal?: AbortSignal): Promise<ResolvedCitation> {
    const parsed = classifyInput(input)

    if (parsed.kind === "doi") {
      return {
        inputType: "doi",
        record: await this.resolveDoi(parsed.value, signal),
      }
    }

    return {
      inputType: "title",
      record: await this.resolveTitle(parsed.value, signal),
    }
  }

  private async resolveDoi(doi: string, signal?: AbortSignal) {
    const canonicalDoi = normalizeDoi(doi)
    const displayDoi = cleanDoi(doi)
    const cacheKey = `doi:${canonicalDoi}`
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const errors: ProviderError[] = []
    let responded = false

    for (const provider of this.doiProviders) {
      if (!provider.getByDoi) {
        continue
      }

      try {
        const record = await provider.getByDoi(canonicalDoi, signal)
        responded = true

        if (record?.csl.DOI && normalizeDoi(record.csl.DOI) === canonicalDoi) {
          // 保留使用者輸入／DOI metadata 的原始字母大小寫，避免任意全部轉小寫。
          const recordWithInputDoi = {
            ...record,
            csl: { ...record.csl, DOI: displayDoi },
            metadata: { ...record.metadata, doi: displayDoi },
          }
          this.cache.set(cacheKey, recordWithInputDoi)
          return recordWithInputDoi
        }
      } catch (error) {
        if (error instanceof ProviderError) {
          errors.push(error)
          continue
        }
        throw error
      }
    }

    if (!responded && errors.length > 0) {
      throw failureFromProviderErrors(errors)
    }

    throw new ResolutionError(
      "NOT_FOUND",
      "找不到完全符合此 DOI 的文獻，未產生引用。"
    )
  }

  private async resolveTitle(title: string, signal?: AbortSignal) {
    const normalizedTitle = normalizeTitle(title)
    const cacheKey = `title:${normalizedTitle}`
    const cached = this.cache.get(cacheKey)
    if (cached && normalizeTitle(cached.metadata.title) === normalizedTitle) {
      return cached
    }

    const errors: ProviderError[] = []
    let responded = false
    const exactMatches = new Map<string, ProviderRecord>()

    for (const provider of this.titleProviders) {
      if (!provider.searchByTitle) {
        continue
      }

      try {
        const records = await provider.searchByTitle(title, signal)
        responded = true
        for (const match of exactTitleMatches(title, records)) {
          exactMatches.set(recordIdentity(match), match)
        }
      } catch (error) {
        if (error instanceof ResolutionError) {
          throw error
        }

        if (error instanceof ProviderError) {
          errors.push(error)
          continue
        }
        throw error
      }
    }

    if (exactMatches.size > 1) {
      throw new ResolutionError(
        "NOT_FOUND",
        "標題對應到多筆文獻，為避免誤引，未產生引用。"
      )
    }

    if (exactMatches.size === 1) {
      const matched = [...exactMatches.values()][0]
      const record = await this.enrichWithAuthoritativeDoi(matched, signal)
      this.cache.set(cacheKey, record)
      if (record.csl.DOI) {
        this.cache.set(`doi:${normalizeDoi(record.csl.DOI)}`, record)
      }
      return record
    }

    if (!responded && errors.length > 0) {
      throw failureFromProviderErrors(errors)
    }

    throw new ResolutionError(
      "NOT_FOUND",
      "找不到標題完全相符的文獻，未產生引用。"
    )
  }

  /**
   * 標題搜尋（尤其 Crossref 的 search endpoint）常會把作者名正規化成
   * 去除重音符的 ASCII（例如 Gašević → Gasevic），並缺少期刊縮寫資訊。
   * 若該筆標題結果帶有 DOI，就用 DOI 重新擷取更完整的權威 metadata
   * （保留 Gašević 等原始姓名、月份、期刊縮寫）；失敗時退回原標題結果。
   */
  private async enrichWithAuthoritativeDoi(
    matched: ProviderRecord,
    signal?: AbortSignal
  ): Promise<ProviderRecord> {
    const doi = matched.csl.DOI
    if (!doi) {
      return matched
    }

    try {
      return await this.resolveDoi(doi, signal)
    } catch {
      return matched
    }
  }
}

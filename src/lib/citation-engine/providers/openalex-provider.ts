import { openAlexRecord } from "@/lib/citation-engine/metadata-normalizer"
import {
  asRecord,
  asRecordArray,
  fetchProviderJson,
} from "@/lib/citation-engine/provider-client"
import type { MetadataProvider } from "@/lib/citation-engine/types"

export class OpenAlexProvider implements MetadataProvider {
  readonly name = "openalex" as const

  async searchByTitle(title: string, signal?: AbortSignal) {
    const apiKey = process.env.OPENALEX_API_KEY?.trim()
    if (!apiKey) {
      return []
    }

    const params = new URLSearchParams({
      search: title,
      per_page: "5",
      api_key: apiKey,
    })
    const payload = await fetchProviderJson(
      this.name,
      `https://api.openalex.org/works?${params}`,
      {},
      signal
    )
    const root = asRecord(payload)
    const results = root ? asRecordArray(root.results) : []

    return results.flatMap((item) => {
      const record = openAlexRecord(item)
      return record ? [record] : []
    })
  }
}

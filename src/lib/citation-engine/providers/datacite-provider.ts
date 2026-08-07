import { normalizeDoi } from "@/lib/citation-engine/input-parser"
import { dataciteRecord } from "@/lib/citation-engine/metadata-normalizer"
import {
  asRecord,
  asRecordArray,
  fetchProviderJson,
} from "@/lib/citation-engine/provider-client"
import {
  ProviderError,
  type MetadataProvider,
} from "@/lib/citation-engine/types"

function dataFromPayload(payload: unknown) {
  const root = asRecord(payload)
  return root ? root.data : null
}

export class DataCiteProvider implements MetadataProvider {
  readonly name = "datacite" as const

  async getByDoi(doi: string, signal?: AbortSignal) {
    const payload = await fetchProviderJson(
      this.name,
      `https://api.datacite.org/dois/${encodeURIComponent(doi)}`,
      {},
      signal
    )

    if (payload === null) {
      return null
    }

    const raw = asRecord(dataFromPayload(payload))
    if (!raw) {
      throw new ProviderError(
        this.name,
        "invalid-response",
        "DataCite response did not contain a work"
      )
    }

    const record = dataciteRecord(raw)
    return record?.csl.DOI &&
      normalizeDoi(record.csl.DOI) === normalizeDoi(doi)
      ? record
      : null
  }

  async searchByTitle(title: string, signal?: AbortSignal) {
    const params = new URLSearchParams({
      query: title,
      "page[size]": "5",
    })
    const payload = await fetchProviderJson(
      this.name,
      `https://api.datacite.org/dois?${params}`,
      {},
      signal
    )

    return asRecordArray(dataFromPayload(payload)).flatMap((item) => {
      const record = dataciteRecord(item)
      return record ? [record] : []
    })
  }
}

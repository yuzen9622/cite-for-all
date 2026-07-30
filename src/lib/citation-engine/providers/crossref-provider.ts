import { normalizeDoi } from "@/lib/citation-engine/input-parser"
import { crossrefRecord } from "@/lib/citation-engine/metadata-normalizer"
import {
  asRecord,
  asRecordArray,
  fetchProviderJson,
} from "@/lib/citation-engine/provider-client"
import {
  ProviderError,
  type MetadataProvider,
} from "@/lib/citation-engine/types"

function crossrefHeaders() {
  const mailto = process.env.CROSSREF_MAILTO?.trim()
  const contact = mailto ? `; mailto:${mailto}` : ""

  return {
    "User-Agent": `cite-for-all/0.1.0 (https://github.com/yuzen9622/cite-for-all${contact})`,
  }
}

function messageFromPayload(payload: unknown) {
  const root = asRecord(payload)
  return root ? asRecord(root.message) : null
}

export class CrossrefProvider implements MetadataProvider {
  readonly name = "crossref" as const

  async getByDoi(doi: string, signal?: AbortSignal) {
    const payload = await fetchProviderJson(
      this.name,
      `https://api.crossref.org/v1/works/${encodeURIComponent(doi)}`,
      { headers: crossrefHeaders() },
      signal
    )

    if (payload === null) {
      return null
    }

    const message = messageFromPayload(payload)
    if (!message) {
      throw new ProviderError(
        this.name,
        "invalid-response",
        "Crossref response did not contain a work"
      )
    }

    const returnedDoi =
      typeof message.DOI === "string" ? normalizeDoi(message.DOI) : null
    if (returnedDoi !== normalizeDoi(doi)) {
      return null
    }

    return crossrefRecord(message)
  }

  async searchByTitle(title: string, signal?: AbortSignal) {
    const params = new URLSearchParams({
      "query.title": title,
      rows: "5",
    })
    const mailto = process.env.CROSSREF_MAILTO?.trim()
    if (mailto) {
      params.set("mailto", mailto)
    }

    const payload = await fetchProviderJson(
      this.name,
      `https://api.crossref.org/v1/works?${params}`,
      { headers: crossrefHeaders() },
      signal
    )
    const message = messageFromPayload(payload)
    const items = message ? asRecordArray(message.items) : []

    return items.flatMap((item) => {
      const record = crossrefRecord(item)
      return record ? [record] : []
    })
  }
}

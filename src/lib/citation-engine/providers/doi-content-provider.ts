import { normalizeDoi } from "@/lib/citation-engine/input-parser"
import { recordFromCsl } from "@/lib/citation-engine/metadata-normalizer"
import {
  asRecord,
  fetchProviderJson,
} from "@/lib/citation-engine/provider-client"
import {
  ProviderError,
  type MetadataProvider,
} from "@/lib/citation-engine/types"

export class DoiContentProvider implements MetadataProvider {
  readonly name = "doi.org" as const

  async getByDoi(doi: string, signal?: AbortSignal) {
    const payload = await fetchProviderJson(
      this.name,
      `https://doi.org/${encodeURIComponent(doi)}`,
      {
        headers: {
          Accept: "application/vnd.citationstyles.csl+json",
        },
      },
      signal
    )

    if (payload === null) {
      return null
    }

    const raw = asRecord(payload)
    if (!raw) {
      throw new ProviderError(
        this.name,
        "invalid-response",
        "doi.org returned a non-object CSL response"
      )
    }

    const returnedDoi =
      typeof raw.DOI === "string"
        ? normalizeDoi(raw.DOI)
        : typeof raw.doi === "string"
          ? normalizeDoi(raw.doi)
          : null

    if (returnedDoi !== normalizeDoi(doi)) {
      return null
    }

    return recordFromCsl(raw, this.name, returnedDoi)
  }
}

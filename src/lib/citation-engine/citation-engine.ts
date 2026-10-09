import { assessRecord } from "./record-quality"
import { formatAllCitations } from "@/lib/citation-engine/citation-formatter"
import { CitationResolver } from "@/lib/citation-engine/citation-resolver"
import type { CitationData } from "@/lib/citations"

const resolver = new CitationResolver()

export async function createCitation(
  input: string,
  signal?: AbortSignal,
): Promise<CitationData> {
  const resolved = await resolver.resolve(input, signal)
  const quality = assessRecord(resolved.record)
  const csl = { ...resolved.record.csl, custom: { citationIntegrity: quality } }
  const formatted = formatAllCitations(csl)

  return {
    success: true,
    inputType: resolved.inputType,
    metadata: resolved.record.metadata,
    csl,
    citations: formatted.citations,
    citationsHtml: formatted.citationsHtml,
    bibtex: formatted.bibtex,
    quality,
    provenance: {
      provider: resolved.record.provider,
      providerId: resolved.record.providerId,
      match: resolved.inputType === "doi" ? "doi-exact" : "title-exact",
    },
  }
}

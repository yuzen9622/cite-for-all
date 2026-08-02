import { formatAllCitations } from "@/lib/citation-engine/citation-formatter"
import { CitationResolver } from "@/lib/citation-engine/citation-resolver"
import type { CitationData } from "@/lib/citations"

const resolver = new CitationResolver()

export async function createCitation(
  input: string,
  signal?: AbortSignal
): Promise<CitationData> {
  const resolved = await resolver.resolve(input, signal)
  const formatted = formatAllCitations(resolved.record.csl)

  return {
    success: true,
    inputType: resolved.inputType,
    metadata: resolved.record.metadata,
    csl: resolved.record.csl,
    citations: formatted.citations,
    bibtex: formatted.bibtex,
    provenance: {
      provider: resolved.record.provider,
      providerId: resolved.record.providerId,
      match: resolved.inputType === "doi" ? "doi-exact" : "title-exact",
    },
  }
}

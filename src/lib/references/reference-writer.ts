import { randomBytes } from "node:crypto"
import { formatBibtex, formatAllCitations } from "@/lib/citation-engine/citation-formatter"
import { applyMetadataToCsl } from "@/lib/citation-engine/metadata-normalizer"
import type { CslItem } from "@/lib/citation-engine/types"
import type { CitationMetadata, CitationStyle } from "@/lib/citations"

type CitationSnapshot = {
  csl: CslItem
  citations: Record<Exclude<CitationStyle, "bibtex">, string>
  bibtex: string
}

function referenceCuid() {
  return `c${Date.now().toString(36)}${randomBytes(16).toString("hex")}`.slice(
    0,
    25
  )
}

export function rebuildReferenceCitations(
  csl: CslItem,
  metadata: CitationMetadata
): CitationSnapshot {
  const nextCsl = applyMetadataToCsl(csl, metadata)
  const formatted = formatAllCitations(nextCsl)

  return {
    csl: nextCsl,
    citations: formatted.citations,
    bibtex: formatBibtex(nextCsl),
  }
}

export function cslFromMetadata(metadata: CitationMetadata): CslItem {
  return applyMetadataToCsl(
    {
      id: referenceCuid(),
      type: "article-journal",
      title: metadata.title,
    },
    metadata
  )
}

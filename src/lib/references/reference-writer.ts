import {
  assessRecord,
  storedRecordQuality,
} from "@/lib/citation-engine/record-quality"
import { randomBytes } from "node:crypto"
import {
  formatBibtex,
  formatAllCitations,
} from "@/lib/citation-engine/citation-formatter"
import { applyMetadataToCsl } from "@/lib/citation-engine/metadata-normalizer"
import type { CslItem } from "@/lib/citation-engine/types"
import type { CitationMetadata, CitationStyle } from "@/lib/citations"

type CitationSnapshot = {
  csl: CslItem
  citations: Record<Exclude<CitationStyle, "bibtex">, string>
  citationsHtml: Record<Exclude<CitationStyle, "bibtex">, string>
  bibtex: string
}

function referenceCuid() {
  return `c${Date.now().toString(36)}${randomBytes(16).toString("hex")}`.slice(
    0,
    25,
  )
}

export function rebuildReferenceCitations(
  csl: CslItem,
  metadata: Partial<CitationMetadata>,
  options: { edited?: boolean } = {},
): CitationSnapshot {
  const nextCsl = applyMetadataToCsl(csl, metadata)
  const previousQuality = storedRecordQuality(csl)
  if (options.edited && previousQuality) {
    const fields = { ...previousQuality.fields }
    const changed = Object.keys({ ...csl, ...nextCsl }).filter(
      (key) =>
        key !== "custom" &&
        JSON.stringify(csl[key]) !== JSON.stringify(nextCsl[key]),
    )
    for (const key of changed) {
      if (nextCsl[key] === undefined) delete fields[key]
      else fields[key] = { provider: "manual", providerId: "reference-editor" }
    }
    const quality = assessRecord({
      csl: nextCsl,
      metadata: { title: nextCsl.title, authors: [] },
      provider: "crossref",
      providerId: "stored",
      quality: {
        ...previousQuality,
        fields,
        conflicts: previousQuality.conflicts.filter(
          (key) => !changed.includes(key),
        ),
      },
    })
    nextCsl.custom = {
      ...(nextCsl.custom as object),
      citationIntegrity: quality,
    }
  }
  const formatted = formatAllCitations(nextCsl)

  return {
    csl: nextCsl,
    citations: formatted.citations,
    citationsHtml: formatted.citationsHtml,
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
    metadata,
  )
}

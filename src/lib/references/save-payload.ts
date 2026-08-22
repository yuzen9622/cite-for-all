import type {
  CitationData,
  CitationMetadata,
  CitationResult,
} from "@/lib/citations"
import type { CslItem } from "@/lib/citation-engine/types"

export interface ReferenceItemInput {
  input: string
  inputType: "doi" | "title"
  metadata: CitationMetadata
  csl: CslItem
  provenance: CitationData["provenance"]
}

export function buildReferenceItems(
  results: CitationResult[]
): ReferenceItemInput[] {
  return results
    .filter(
      (result): result is Extract<CitationResult, { success: true }> =>
        result.success
    )
    .map((result) => ({
      input: result.input,
      inputType: result.data.inputType,
      metadata: result.data.metadata,
      csl: result.data.csl,
      provenance: result.data.provenance,
    }))
}

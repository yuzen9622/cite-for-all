import { createCitation } from "@/lib/citation-engine/citation-engine"
import { ResolutionError } from "@/lib/citation-engine/citation-resolver"
import type { CitationResult } from "@/lib/citations"

const CONCURRENCY = 3

function statusForResolutionError(error: ResolutionError) {
  if (error.code === "NOT_FOUND") {
    return 404
  }
  if (error.code === "UPSTREAM_RATE_LIMITED") {
    return 429
  }
  return 503
}

async function convertOne(
  input: string,
  signal?: AbortSignal
): Promise<CitationResult> {
  try {
    const data = await createCitation(input, signal)
    return { success: true, input, data }
  } catch (error) {
    if (error instanceof ResolutionError) {
      return {
        success: false,
        input,
        status: statusForResolutionError(error),
        code: error.code,
        error: error.message,
      }
    }

    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")

    if (!isTimeout) {
      console.error("[citation-service] Unexpected citation error", error)
    }

    return {
      success: false,
      input,
      status: 503,
      code: isTimeout ? "UPSTREAM_UNAVAILABLE" : "INTERNAL_ERROR",
      error: isTimeout
        ? "文獻查詢逾時，請稍後再試。"
        : "引用轉換暫時無法完成，請稍後再試。",
    }
  }
}

export async function convertCitations(
  inputs: string[],
  signal?: AbortSignal
) {
  const results: CitationResult[] = []

  for (let index = 0; index < inputs.length; index += CONCURRENCY) {
    const chunk = inputs.slice(index, index + CONCURRENCY)
    results.push(...(await Promise.all(chunk.map((input) => convertOne(input, signal)))))
  }

  return results
}

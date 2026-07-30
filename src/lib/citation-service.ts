import type { CitationResult, DoxaCitation } from "@/lib/citations"

const DOXA_CITE_URL = "https://doxa.papersflow.ai/api/public/cite"
const CONCURRENCY = 3

interface DoxaError {
  success?: false
  error?: string
}

function errorMessage(status: number, upstreamMessage?: string) {
  if (status === 429) {
    return "轉換服務目前使用量較高，請稍候一分鐘再試。"
  }

  if (status === 404) {
    return "找不到符合的文獻，請確認 DOI 或改用完整論文標題。"
  }

  if (status >= 500) {
    return "上游文獻服務暫時無法回應，請稍後再試。"
  }

  return upstreamMessage || "找不到符合的文獻，請確認 DOI 或改用完整論文標題。"
}

async function convertOne(input: string): Promise<CitationResult> {
  try {
    const response = await fetch(DOXA_CITE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ input }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })

    const payload = (await response.json().catch(() => null)) as
      | DoxaCitation
      | DoxaError
      | null

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        input,
        status: response.status,
        error: errorMessage(
          response.status,
          payload && "error" in payload ? payload.error : undefined
        ),
      }
    }

    return { success: true, input, data: payload }
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")

    return {
      success: false,
      input,
      error: isTimeout
        ? "轉換逾時，請稍後再試。"
        : "目前無法連線到文獻轉換服務，請檢查網路後重試。",
    }
  }
}

export async function convertCitations(inputs: string[]) {
  const results: CitationResult[] = []

  for (let index = 0; index < inputs.length; index += CONCURRENCY) {
    const chunk = inputs.slice(index, index + CONCURRENCY)
    results.push(...(await Promise.all(chunk.map(convertOne))))
  }

  return results
}

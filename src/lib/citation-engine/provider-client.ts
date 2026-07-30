import {
  ProviderError,
  type ProviderName,
} from "@/lib/citation-engine/types"

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])
const DEFAULT_TIMEOUT_MS = 8_000
const MAX_RETRIES = 2

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after")
  const seconds = retryAfter ? Number.parseFloat(retryAfter) : Number.NaN

  if (Number.isFinite(seconds)) {
    return Math.min(seconds * 1_000, 2_000)
  }

  return 250 * 2 ** attempt
}

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds)

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout)
        reject(signal.reason)
      },
      { once: true }
    )
  })
}

function requestSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

export async function fetchProviderJson(
  provider: ProviderName,
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal
) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...init.headers,
        },
        cache: "no-store",
        signal: requestSignal(signal),
      })

      if (response.status === 404) {
        return null
      }

      if (
        RETRYABLE_STATUSES.has(response.status) &&
        attempt < MAX_RETRIES
      ) {
        await delay(retryDelay(response, attempt), signal)
        continue
      }

      if (!response.ok) {
        const kind =
          response.status === 429 ? "rate-limited" : "unavailable"
        throw new ProviderError(
          provider,
          kind,
          `${provider} returned HTTP ${response.status}`,
          response.status
        )
      }

      return (await response.json()) as unknown
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error
      }

      if (signal?.aborted || attempt === MAX_RETRIES) {
        break
      }

      await delay(250 * 2 ** attempt, signal)
    }
  }

  throw new ProviderError(
    provider,
    "unavailable",
    `${provider} request failed`,
    undefined
  )
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function asRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : []
}

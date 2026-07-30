import { afterEach, describe, expect, it, vi } from "vitest"
import { CitationCache } from "@/lib/citation-engine/citation-cache"

describe("CitationCache", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("expires values after the configured TTL", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-31T00:00:00Z"))
    const cache = new CitationCache<string>(1_000, 10)

    cache.set("doi", "record")
    expect(cache.get("doi")).toBe("record")

    vi.advanceTimersByTime(1_001)
    expect(cache.get("doi")).toBeUndefined()
  })

  it("evicts the least recently used entry", () => {
    const cache = new CitationCache<string>(60_000, 2)
    cache.set("a", "A")
    cache.set("b", "B")
    cache.get("a")
    cache.set("c", "C")

    expect(cache.get("a")).toBe("A")
    expect(cache.get("b")).toBeUndefined()
    expect(cache.get("c")).toBe("C")
  })
})

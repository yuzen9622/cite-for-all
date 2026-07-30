interface CacheEntry<T> {
  expiresAt: number
  value: T
}

export class CitationCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>()

  constructor(
    private readonly ttlMs = 30 * 60 * 1_000,
    private readonly maxEntries = 1_000
  ) {}

  get(key: string) {
    const entry = this.entries.get(key)
    if (!entry) {
      return undefined
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key)
      return undefined
    }

    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: T) {
    this.entries.delete(key)
    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    })

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey === undefined) {
        break
      }
      this.entries.delete(oldestKey)
    }
  }

  clear() {
    this.entries.clear()
  }
}

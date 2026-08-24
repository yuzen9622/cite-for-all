import { describe, it, expect, beforeEach } from "vitest"
import {
  savePendingConversion,
  getPendingConversion,
  clearPendingConversion,
} from "./anonymous-session"

const store = new Map<string, string>()

const mockSessionStorage: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, String(value))
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => {
    store.clear()
  },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  get length() {
    return store.size
  },
}

Object.defineProperty(globalThis, "window", {
  value: {
    sessionStorage: mockSessionStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  writable: true,
  configurable: true,
})

describe("anonymous-session storage utility", () => {
  beforeEach(() => {
    mockSessionStorage.clear()
  })

  it("saves and retrieves pending conversion", () => {
    savePendingConversion("10.1109/5.771073\n10.1038/nature01234", 2)
    const pending = getPendingConversion()
    expect(pending).not.toBeNull()
    expect(pending?.rawInput).toBe("10.1109/5.771073\n10.1038/nature01234")
    expect(pending?.count).toBe(2)
    expect(typeof pending?.timestamp).toBe("number")
  })

  it("clears pending conversion", () => {
    savePendingConversion("10.1109/5.771073", 1)
    clearPendingConversion()
    expect(getPendingConversion()).toBeNull()
  })

  it("ignores empty or whitespace-only inputs", () => {
    savePendingConversion("   ", 0)
    expect(getPendingConversion()).toBeNull()
  })

  it("handles corrupted json in storage gracefully", () => {
    mockSessionStorage.setItem(
      "cite_anonymous_pending_conversion",
      "invalid-json{",
    )
    expect(getPendingConversion()).toBeNull()
  })
})

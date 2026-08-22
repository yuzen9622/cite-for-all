"use client"

import * as React from "react"

const SESSION_STORAGE_KEY = "cite_anonymous_pending_conversion"

export interface PendingAnonymousConversion {
  rawInput: string
  count: number
  timestamp: number
}

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

export function savePendingConversion(rawInput: string, count: number): void {
  if (typeof window === "undefined" || !rawInput.trim()) return
  try {
    const payload: PendingAnonymousConversion = {
      rawInput,
      count,
      timestamp: Date.now(),
    }
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
    notify()
  } catch {
    // Ignore storage quota or access errors
  }
}

export function getPendingConversion(): PendingAnonymousConversion | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingAnonymousConversion
    if (typeof parsed?.rawInput === "string" && parsed.rawInput.trim()) {
      return parsed
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

export function clearPendingConversion(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    notify()
  } catch {
    // Ignore errors
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener("storage", callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener("storage", callback)
  }
}

let cachedSnapshot: PendingAnonymousConversion | null = null
let cachedRaw: string | null = null

function getSnapshot(): PendingAnonymousConversion | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      if (!raw) {
        cachedSnapshot = null
      } else {
        const parsed = JSON.parse(raw) as PendingAnonymousConversion
        cachedSnapshot =
          typeof parsed?.rawInput === "string" && parsed.rawInput.trim()
            ? parsed
            : null
      }
    }
    return cachedSnapshot
  } catch {
    return null
  }
}

function getServerSnapshot() {
  return null
}

export function usePendingConversion(): PendingAnonymousConversion | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

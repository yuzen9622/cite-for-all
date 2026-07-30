"use client"

import { useMemo, useState } from "react"
import {
  citationText,
  parseCitationInputs,
  type CitationResult,
  type CitationStyle,
} from "@/lib/citations"

export type InputMode = "single" | "batch"

const EXAMPLES: Record<InputMode, string> = {
  single: "10.3102/0034654315581420",
  batch: "10.3102/0034654315581420\n10.1109/tlt.2023.3259013",
}

interface ApiResponse {
  results?: CitationResult[]
  error?: string
}

export function useCitationConverter() {
  const [mode, setMode] = useState<InputMode>("single")
  const [rawInput, setRawInput] = useState("")
  const [style, setStyle] = useState<CitationStyle>("apa")
  const [results, setResults] = useState<CitationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  const parsedInputs = useMemo(() => parseCitationInputs(rawInput), [rawInput])
  const successfulResults = results.filter((result) => result.success)

  function changeMode(nextMode: InputMode) {
    setMode(nextMode)
    setError("")
    setResults([])
    setRawInput("")
  }

  function updateInput(value: string) {
    setRawInput(value)
    setError("")
  }

  function loadExample() {
    setRawInput(EXAMPLES[mode])
    setError("")
  }

  async function convert() {
    setError("")

    if (!rawInput.trim()) {
      setError("請先貼上 DOI 或完整論文標題。")
      return
    }

    if (mode === "single" && parsedInputs.length !== 1) {
      setError("單筆模式一次只能輸入一筆；多筆資料請切換到批次模式。")
      return
    }

    if (parsedInputs.length > 15) {
      setError("單次最多可轉換 15 筆文獻。")
      return
    }

    setLoading(true)
    setResults([])

    try {
      const response = await fetch("/api/cite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: parsedInputs }),
      })
      const payload = (await response.json()) as ApiResponse

      if (!response.ok || !payload.results) {
        setError(payload.error || "轉換失敗，請稍後再試。")
        return
      }

      setResults(payload.results)
    } catch {
      setError("無法連線到轉換服務，請檢查網路後重試。")
    } finally {
      setLoading(false)
    }
  }

  function allCitationText() {
    return successfulResults
      .map((result, index) => citationText(result, style, index))
      .join("\n\n")
  }

  async function copyText(text: string, copyId: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(copyId)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setError("瀏覽器未允許剪貼簿權限，請手動選取文字複製。")
    }
  }

  function downloadAll() {
    const extension = style === "bibtex" ? "bib" : "txt"
    const blob = new Blob([allCitationText()], {
      type: "text/plain;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `citations-${style}.${extension}`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return {
    mode,
    rawInput,
    style,
    results,
    loading,
    error,
    copied,
    parsedInputs,
    successfulResults,
    changeMode,
    updateInput,
    loadExample,
    setStyle,
    convert,
    citationText,
    allCitationText,
    copyText,
    downloadAll,
  }
}

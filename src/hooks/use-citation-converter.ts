"use client"

import { useMemo, useState } from "react"
import {
  MAX_BATCH_SIZE,
  citationText,
  formatRis,
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

function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function useCitationConverter() {
  const [mode, setMode] = useState<InputMode>("single")
  const [rawInput, setRawInput] = useState("")
  const [style, setStyle] = useState<CitationStyle>("apa")
  const [startNumber, setStartNumber] = useState(1)
  const [results, setResults] = useState<CitationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  const parsedInputs = useMemo(() => parseCitationInputs(rawInput), [rawInput])
  const successfulResults = results.filter((result) => result.success)
  const failedResults = results
    .map((result, index) => ({ result, index }))
    .filter(
      (
        entry
      ): entry is {
        result: Extract<CitationResult, { success: false }>
        index: number
      } => !entry.result.success
    )
    .map(({ result, index }) => ({
      order: index + 1,
      input: result.input,
      message: result.error,
    }))

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

    if (parsedInputs.length > MAX_BATCH_SIZE) {
      setError(`單次最多可轉換 ${MAX_BATCH_SIZE} 筆文獻。`)
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

  function updateStartNumber(value: string) {
    if (value === "") {
      setStartNumber(1)
      return
    }

    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed) || parsed < 1) {
      return
    }

    setStartNumber(Math.min(parsed, 9999))
  }

  function citationTextAt(
    result: Extract<CitationResult, { success: true }>,
    style: CitationStyle,
    index: number
  ) {
    return citationText(result, style, index + startNumber - 1)
  }

  function allCitationText() {
    return successfulResults
      .map((result, index) => citationTextAt(result, style, index))
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
    downloadTextFile(
      allCitationText(),
      `citations-${style}.${extension}`,
      "text/plain;charset=utf-8"
    )
  }

  function downloadRis() {
    downloadTextFile(
      formatRis(successfulResults.map((result) => result.data.metadata)),
      "citations.ris",
      "application/x-research-info-systems;charset=utf-8"
    )
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
    failedResults,
    MAX_BATCH_SIZE,
    changeMode,
    updateInput,
    loadExample,
    setStyle,
    convert,
    citationText,
    citationTextAt,
    startNumber,
    updateStartNumber,
    allCitationText,
    copyText,
    downloadAll,
    downloadRis,
  }
}

"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  MAX_BATCH_SIZE,
  citationText,
  parseCitationInputs,
  type CitationResult,
  type CitationStyle,
} from "@/lib/citations"
import {
  citationExportText,
  formatCitationExport,
  formatRisExport,
} from "@/lib/export-citations"

export type InputMode = "single" | "batch"

const EXAMPLES: Record<InputMode, string> = {
  single: "10.3102/0034654315581420",
  batch: "10.3102/0034654315581420\n10.1109/tlt.2023.3259013",
}

interface ApiResponse {
  results?: CitationResult[]
  error?: string
}

interface SaveResponse {
  created?: Array<unknown>
  skipped?: Array<unknown>
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
  const [saving, setSaving] = useState(false)
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
        toast.error(payload.error || "轉換失敗，請稍後再試。")
        return
      }

      setResults(payload.results)

      const succeeded = payload.results.filter((result) => result.success).length
      const failed = payload.results.length - succeeded
      if (succeeded === 0) {
        toast.error(`${failed} 筆都找不到相符的文獻。`)
      } else if (failed > 0) {
        toast.warning(`已轉換 ${succeeded} 筆；${failed} 筆找不到相符的文獻。`)
      } else {
        toast.success(`已轉換 ${succeeded} 筆文獻。`)
      }
    } catch {
      toast.error("無法連線到轉換服務，請檢查網路後重試。")
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
    return citationExportText(result.data, style, index, startNumber)
  }

  function allCitationText() {
    return formatCitationExport(
      successfulResults.map((result) => result.data),
      style,
      startNumber
    )
  }

  async function copyText(text: string, copyId: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(copyId)
      window.setTimeout(() => setCopied(null), 1800)
      toast.success("已複製到剪貼簿。")
    } catch {
      toast.error("瀏覽器未允許剪貼簿權限，請手動選取文字複製。")
    }
  }

  function downloadAll() {
    const extension = style === "bibtex" ? "bib" : "txt"
    const filename = `citations-${style}.${extension}`
    try {
      downloadTextFile(
        allCitationText(),
        filename,
        "text/plain;charset=utf-8"
      )
      toast.success(`已下載 ${filename}。`)
    } catch {
      toast.error("下載失敗，請稍後再試。")
    }
  }

  function downloadRis() {
    try {
      downloadTextFile(
        formatRisExport(successfulResults.map((result) => result.data)),
        "citations.ris",
        "application/x-research-info-systems;charset=utf-8"
      )
      toast.success("已下載 citations.ris。")
    } catch {
      toast.error("下載失敗，請稍後再試。")
    }
  }

  async function saveToProject(projectId: string) {
    if (successfulResults.length === 0) {
      toast.error("目前沒有可儲存的文獻。")
      return false
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: successfulResults.map((result) => ({
            input: result.input,
            inputType: result.data.inputType,
            metadata: result.data.metadata,
            csl: result.data.csl,
            provenance: result.data.provenance,
          })),
        }),
      })
      const payload = (await response.json()) as SaveResponse

      if (!response.ok) {
        toast.error(payload.error || "儲存失敗，請稍後再試。")
        return false
      }

      const createdCount = payload.created?.length ?? 0
      const skippedCount = payload.skipped?.length ?? 0
      if (skippedCount) {
        toast.success(`已儲存 ${createdCount} 筆文獻。`, {
          description: `${skippedCount} 筆因 DOI 重複而略過。`,
        })
      } else {
        toast.success(`已儲存 ${createdCount} 筆文獻。`)
      }
      return true
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。")
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    mode,
    rawInput,
    style,
    results,
    loading,
    saving,
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
    saveToProject,
  }
}

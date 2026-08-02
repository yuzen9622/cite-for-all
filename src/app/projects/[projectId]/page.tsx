"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, Copy, Download, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ReferenceEditor, type EditableReference } from "@/components/projects/reference-editor"
import { SiteHeader } from "@/components/site-header"
import { STYLE_OPTIONS, type CitationStyle } from "@/lib/citations"
import {
  citationExportText,
  formatCitationExport,
  formatRisExport,
  type CitationExportRecord,
} from "@/lib/export-citations"

interface StoredReference extends EditableReference {
  projectId: string
  sortOrder: number
  input: string
  inputType: string
  provider: string | null
  itemType: string | null
  citations: Record<string, string>
  bibtex: string
  isEdited: boolean
}

interface ProjectData {
  id: string
  name: string
  description: string | null
  defaultStyle: string
  references: StoredReference[]
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

function exportRecord(reference: StoredReference): CitationExportRecord {
  return {
    metadata: {
      title: reference.title,
      authors: reference.authors,
      year: reference.year ?? undefined,
      journal: reference.journal ?? undefined,
      volume: reference.volume ?? undefined,
      issue: reference.issue ?? undefined,
      pages: reference.pages ?? undefined,
      doi: reference.doi ?? undefined,
      publisher: reference.publisher ?? undefined,
      url: reference.url ?? undefined,
      type: reference.itemType ?? undefined,
    },
    citations: reference.citations as CitationExportRecord["citations"],
    bibtex: reference.bibtex,
  }
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId
  const [project, setProject] = useState<ProjectData | null>(null)
  const [style, setStyle] = useState<CitationStyle>("apa")
  const [startNumber, setStartNumber] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [requiresLogin, setRequiresLogin] = useState(false)

  const loadProject = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        headers: { "Cache-Control": "no-cache" },
      })
      const payload = (await response.json()) as {
        project?: ProjectData
        error?: string
      }
      if (response.status === 401) {
        setRequiresLogin(true)
      }
      if (!response.ok || !payload.project) {
        setError(payload.error || "無法載入專案。")
        return
      }
      setProject(payload.project)
      setStyle(
        STYLE_OPTIONS.some((option) => option.id === payload.project?.defaultStyle)
          ? (payload.project.defaultStyle as CitationStyle)
          : "apa"
      )
    } catch {
      setError("無法連線到專案服務，請稍後再試。")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    // This effect synchronizes the page with the remote project record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProject()
  }, [loadProject])

  const records = useMemo(
    () => project?.references.map(exportRecord) ?? [],
    [project?.references]
  )
  const allText = useMemo(
    () => formatCitationExport(records, style, startNumber),
    [records, startNumber, style]
  )

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(allText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError("瀏覽器未允許剪貼簿權限，請手動選取文字複製。")
    }
  }

  function downloadAll() {
    downloadTextFile(
      allText,
      `${project?.name ?? "project"}-${style}.${style === "bibtex" ? "bib" : "txt"}`,
      "text/plain;charset=utf-8"
    )
  }

  function downloadRis() {
    downloadTextFile(
      formatRisExport(records),
      `${project?.name ?? "project"}.ris`,
      "application/x-research-info-systems;charset=utf-8"
    )
  }

  async function deleteReference(reference: StoredReference) {
    if (!window.confirm(`確定要刪除「${reference.title}」嗎？`)) {
      return
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/references/${reference.id}`,
        { method: "DELETE" }
      )
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error || "刪除文獻失敗。")
        return
      }
      setProject((current) =>
        current
          ? {
              ...current,
              references: current.references.filter(
                (item) => item.id !== reference.id
              ),
            }
          : current
      )
    } catch {
      setError("無法連線到文獻服務，請稍後再試。")
    }
  }

  function updateReference(reference: EditableReference) {
    setProject((current) =>
      current
        ? {
            ...current,
            references: current.references.map((item) =>
              item.id === reference.id
                ? { ...item, ...reference }
                : item
            ),
          }
        : current
    )
    setEditingId(null)
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-12 text-sm text-muted-foreground">
          正在載入專案…
        </main>
      </>
    )
  }

  if (requiresLogin) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-12">
        <Card className="rounded-none">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm">請先登入，才能查看此專案。</p>
            <Button
              type="button"
              onClick={() => {
                window.location.href = `/api/auth/signin?callbackUrl=/projects/${projectId}`
              }}
              className="rounded-none"
            >
              前往登入
            </Button>
          </CardContent>
        </Card>
        </main>
      </>
    )
  }

  if (!project) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-destructive" role="alert">
          {error || "找不到此專案。"}
        </p>
        <Link href="/projects" className="mt-4 inline-flex text-sm underline">
          回到專案列表
        </Link>
        </main>
      </>
    )
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-7 sm:py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/projects"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> 我的專案
          </Link>
          <h1 className="font-heading text-4xl font-semibold tracking-[-0.05em]">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {project.references.length} 筆文獻
        </span>
      </div>

      {error && (
        <p className="mb-5 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card className="mb-6 rounded-none border-foreground/30">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl">引用格式與匯出</CardTitle>
          <div className="flex flex-wrap gap-2">
            <select
              value={style}
              onChange={(event) => setStyle(event.target.value as CitationStyle)}
              className="h-9 rounded-none border border-input bg-background px-3 text-sm"
              aria-label="選擇引用格式"
            >
              {STYLE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyAll()} className="rounded-none">
              {copied ? <Check /> : <Copy />} {copied ? "已複製" : "複製全部"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadAll} className="rounded-none">
              <Download /> 下載
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadRis} className="rounded-none">
              <Download /> RIS
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(style === "ieee" || style === "vancouver") && (
            <div className="mb-4 flex items-center gap-3 text-sm">
              <label htmlFor="project-start-number">起始編號</label>
              <Input
                id="project-start-number"
                type="number"
                min={1}
                max={9999}
                value={startNumber}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10)
                  if (Number.isInteger(value) && value > 0) {
                    setStartNumber(Math.min(value, 9999))
                  }
                }}
                className="h-9 w-24 rounded-none"
              />
            </div>
          )}
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap border bg-secondary/30 p-4 font-heading text-sm leading-7">
            {allText || "目前沒有可匯出的文獻。"}
          </pre>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {project.references.length === 0 ? (
          <Card className="rounded-none border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              此專案目前沒有文獻。請回到首頁轉換後儲存。
            </CardContent>
          </Card>
        ) : (
          project.references.map((reference, index) => (
            <Card key={reference.id} className="rounded-none">
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="mb-1 font-mono text-[11px] font-bold text-[#b84025]">
                    項目 {String(index + startNumber).padStart(2, "0")} · {reference.inputType === "doi" ? "DOI" : "標題"}
                  </p>
                  <CardTitle className="break-words text-lg">{reference.title}</CardTitle>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {[reference.year, reference.journal, reference.doi].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(reference.id)} className="rounded-none">
                    <Pencil /> 編輯
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void deleteReference(reference)} className="rounded-none text-destructive hover:text-destructive">
                    <Trash2 /> 刪除
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {editingId === reference.id ? (
                  <ReferenceEditor
                    projectId={projectId}
                    reference={reference}
                    onSaved={updateReference}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <pre className="overflow-auto whitespace-pre-wrap border bg-secondary/30 p-4 font-heading text-sm leading-7">
                    {citationExportText(exportRecord(reference), style, index, startNumber)}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
      </main>
    </>
  )
}

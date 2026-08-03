"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export interface EditableReference {
  id: string
  title: string
  authors: string[]
  year: number | null
  journal: string | null
  volume: string | null
  issue: string | null
  pages: string | null
  doi: string | null
  publisher: string | null
  url: string | null
}

interface ReferenceEditorProps {
  projectId: string
  reference: EditableReference
  onSaved: (reference: EditableReference) => void
  onCancel: () => void
}

export function ReferenceEditor({
  projectId,
  reference,
  onSaved,
  onCancel,
}: ReferenceEditorProps) {
  const [title, setTitle] = useState(reference.title)
  const [authors, setAuthors] = useState(reference.authors.join("\n"))
  const [year, setYear] = useState(reference.year?.toString() ?? "")
  const [journal, setJournal] = useState(reference.journal ?? "")
  const [volume, setVolume] = useState(reference.volume ?? "")
  const [issue, setIssue] = useState(reference.issue ?? "")
  const [pages, setPages] = useState(reference.pages ?? "")
  const [doi, setDoi] = useState(reference.doi ?? "")
  const [publisher, setPublisher] = useState(reference.publisher ?? "")
  const [url, setUrl] = useState(reference.url ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) {
      setError("標題不可為空白。")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch(
        `/api/projects/${projectId}/references/${reference.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            authors: authors
              .split(/\r?\n/)
              .map((author) => author.trim())
              .filter(Boolean),
            year: year ? Number.parseInt(year, 10) : null,
            journal,
            volume,
            issue,
            pages,
            doi,
            publisher,
            url,
          }),
        }
      )
      const payload = (await response.json()) as {
        reference?: EditableReference
        error?: string
      }
      if (!response.ok || !payload.reference) {
        toast.error(payload.error || "儲存文獻失敗。")
        return
      }
      onSaved(payload.reference)
      toast.success(`已更新「${payload.reference.title}」。`)
    } catch {
      toast.error("無法連線到文獻服務，請稍後再試。")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border border-foreground/30 bg-secondary/30 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-semibold">標題</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-none"
            required
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-semibold">作者（每行一位）</span>
          <Textarea
            value={authors}
            onChange={(event) => setAuthors(event.target.value)}
            className="min-h-24 rounded-none"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">年份</span>
          <Input
            type="number"
            min={1}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="rounded-none"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">期刊／來源</span>
          <Input
            value={journal}
            onChange={(event) => setJournal(event.target.value)}
            className="rounded-none"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">卷</span>
          <Input
            value={volume}
            onChange={(event) => setVolume(event.target.value)}
            className="rounded-none"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">期</span>
          <Input
            value={issue}
            onChange={(event) => setIssue(event.target.value)}
            className="rounded-none"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">頁碼</span>
          <Input
            value={pages}
            onChange={(event) => setPages(event.target.value)}
            className="rounded-none"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">DOI</span>
          <Input
            value={doi}
            onChange={(event) => setDoi(event.target.value)}
            className="rounded-none font-mono text-xs"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">出版者</span>
          <Input
            value={publisher}
            onChange={(event) => setPublisher(event.target.value)}
            className="rounded-none"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">網址</span>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="rounded-none"
          />
        </label>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="rounded-none">
          {saving ? "重新產生格式中…" : "儲存變更"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="rounded-none"
        >
          取消
        </Button>
      </div>
    </form>
  )
}

"use client"

import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useCitationConverter } from "@/hooks/use-citation-converter"
import { buildReferenceItems } from "@/lib/references/save-payload"
import type { StoredReference } from "@/app/projects/[projectId]/page"

interface InlineConverterProps {
  projectId: string
  onSaved: (created: StoredReference[]) => void
}

export function InlineConverter({
  projectId,
  onSaved,
}: InlineConverterProps) {
  const converter = useCitationConverter()
  const [saving, setSaving] = useState(false)
  const [savedSkips, setSavedSkips] = useState<
    Array<{ input: string; reason: string }>
  >([])

  async function saveReferences() {
    if (converter.successfulResults.length === 0) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: buildReferenceItems(converter.successfulResults),
        }),
      })
      const payload = (await response.json()) as {
        created?: StoredReference[]
        skipped?: Array<{ input: string; reason: string }>
        error?: string
      }

      if (!response.ok) {
        toast.error(payload.error || "儲存失敗，請稍後再試。")
        return
      }

      const created = payload.created ?? []
      const skipped = payload.skipped ?? []
      onSaved(created)
      if (skipped.length > 0) {
        toast.success(`已存入 ${created.length} 筆文獻。`, {
          description: `${skipped.length} 筆因 DOI 重複而略過。`,
        })
        setSavedSkips(skipped)
      } else {
        toast.success(`已存入 ${created.length} 筆文獻。`)
        setSavedSkips([])
      }
      converter.clearResults()
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-6 rounded-none border-foreground/30">
      <CardHeader>
        <CardTitle className="text-xl">批次加入文獻</CardTitle>
        <p className="text-sm text-muted-foreground">
          貼上 DOI 或論文標題（每行一筆），轉換後直接存入此專案。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={converter.rawInput}
          onChange={(event) => converter.updateInput(event.target.value)}
          maxLength={7500}
          aria-invalid={Boolean(converter.error)}
          placeholder={"10.3102/0034654315581420\n或每行貼上一個完整論文標題"}
          spellCheck={false}
          className="min-h-32 rounded-none font-mono text-sm"
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>已辨識 {converter.parsedInputs.length} 筆輸入</span>
          {converter.error && (
            <span className="font-semibold text-destructive" role="alert">
              {converter.error}
            </span>
          )}
        </div>

        <Button
          type="button"
          onClick={() => void converter.convert()}
          disabled={converter.loading}
          className="rounded-none"
        >
          {converter.loading ? (
            <>
              正在查找文獻… <LoaderCircle className="animate-spin" />
            </>
          ) : (
            "開始轉換"
          )}
        </Button>

        {converter.results.length > 0 && (
          <div className="space-y-4 border border-foreground/20 bg-secondary/20 p-4">
            {converter.successfulResults.length > 0 && (
              <div className="space-y-3">
                {converter.successfulResults.map((result, index) => (
                  <div key={`${result.input}-${index}`} className="space-y-1">
                    <Badge
                      variant="outline"
                      className="rounded-none font-mono text-[10px] tracking-[0.08em] text-[#b84025]"
                    >
                      ITEM {index + 1} · {result.data.inputType === "doi" ? "DOI" : "標題"}
                    </Badge>
                    <p className="break-words text-sm font-semibold">
                      {result.data.metadata.title}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {[
                        result.data.metadata.year,
                        result.data.metadata.journal,
                        result.data.metadata.doi,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {converter.failedResults.length > 0 && (
              <div className="space-y-1 text-sm text-muted-foreground" role="status">
                {converter.failedResults.map((failure) => (
                  <p key={failure.order} className="break-words">
                    第 {failure.order} 筆：{failure.input} — {failure.message}
                  </p>
                ))}
              </div>
            )}

            <Button
              type="button"
              onClick={() => void saveReferences()}
              disabled={saving || converter.successfulResults.length === 0}
              className="rounded-none"
            >
              存入此專案（{converter.successfulResults.length} 筆）
            </Button>
          </div>
        )}

        {savedSkips.length > 0 && (
          <div className="space-y-1 border-l-4 border-[#b84025] bg-[#fff6ef] px-4 py-3 text-sm text-muted-foreground" role="status">
            <p>以下文獻因 DOI 重複而略過：</p>
            <ul className="list-disc pl-5">
              {savedSkips.map((skipped) => (
                <li key={`${skipped.input}-${skipped.reason}`}>
                  {skipped.input} — {skipped.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

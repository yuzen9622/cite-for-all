"use client"

import { useState } from "react"
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FolderPlus,
  LoaderCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useCitationConverter,
  type InputMode,
} from "@/hooks/use-citation-converter"
import { STYLE_OPTIONS, type CitationStyle } from "@/lib/citations"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/site-header"

interface ProjectSummary {
  id: string
  name: string
  _count: { references: number }
}

export function CitationConverter() {
  const converter = useCitationConverter()
  const failedCount = converter.failedResults.length
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveProjects, setSaveProjects] = useState<ProjectSummary[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [newProjectName, setNewProjectName] = useState("")
  const [saveError, setSaveError] = useState("")
  const [loadingProjects, setLoadingProjects] = useState(false)

  async function openSavePanel() {
    setSaveOpen(true)
    setSaveError("")
    setLoadingProjects(true)

    try {
      const response = await fetch("/api/projects", {
        headers: { "Cache-Control": "no-cache" },
      })
      const payload = (await response.json()) as {
        projects?: ProjectSummary[]
        error?: string
      }

      if (!response.ok || !payload.projects) {
        setSaveError(
          response.status === 401
            ? "請先登入，才能儲存到專案。"
            : payload.error || "無法載入專案。"
        )
        return
      }

      setSaveProjects(payload.projects)
      setSelectedProjectId(payload.projects[0]?.id ?? "")
    } catch {
      setSaveError("無法連線到專案服務，請稍後再試。")
    } finally {
      setLoadingProjects(false)
    }
  }

  async function saveCurrentResults() {
    setSaveError("")
    let projectId = selectedProjectId

    if (!projectId) {
      if (!newProjectName.trim()) {
        setSaveError("請選擇專案，或輸入新專案名稱。")
        return
      }

      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newProjectName.trim() }),
        })
        const payload = (await response.json()) as {
          project?: ProjectSummary
          error?: string
        }
        if (!response.ok || !payload.project) {
          setSaveError(payload.error || "建立專案失敗。")
          return
        }
        projectId = payload.project.id
        setSaveProjects((current) => [
          ...current,
          payload.project as ProjectSummary,
        ])
        setNewProjectName("")
      } catch {
        setSaveError("無法連線到專案服務，請稍後再試。")
        return
      }
    }

    const saved = await converter.saveToProject(projectId)
    if (saved) {
      setSaveOpen(false)
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1480px] px-3 pb-10 sm:px-7">

      <section
        className="grid items-end gap-5 py-10 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.55fr)] md:gap-12 md:py-16"
        aria-labelledby="page-title"
      >
        <div>
          <p className="mb-4 text-xs font-extrabold tracking-[0.14em] text-[#b84025] uppercase">
            Citation converter · 7 formats
          </p>
          <h1
            id="page-title"
            className="max-w-4xl font-heading text-[clamp(3rem,7vw,5.75rem)] leading-[0.94] font-medium tracking-[-0.065em]"
          >
            文獻格式，
            <br />
            一次<span className="text-accent italic">轉對。</span>
          </h1>
        </div>
        <p className="mb-1 max-w-2xl text-base leading-7 text-muted-foreground">
          貼上 DOI、DOI 網址或完整論文標題，即可取得 APA 7th、MLA
          9、Chicago Author–Date、Harvard Cite Them Right、IEEE、Vancouver 與
          BibTeX。
        </p>
      </section>

      <Card className="gap-0 rounded-none border border-foreground/90 bg-card/80 py-0 shadow-[0_20px_60px_rgb(20_36_31/0.10)] backdrop-blur-sm">
        <CardHeader className="flex min-h-[62px] flex-row items-center justify-between gap-4 rounded-none border-b bg-secondary/50 px-3 py-2.5 sm:px-5">
          <Tabs
            value={converter.mode}
            onValueChange={(value) =>
              converter.changeMode(value as InputMode)
            }
          >
            <TabsList className="h-10 rounded-none border bg-card p-1">
              <TabsTrigger
                value="single"
                className="rounded-none px-4 data-active:bg-primary data-active:text-primary-foreground data-active:hover:text-primary-foreground dark:data-active:hover:text-primary-foreground"
              >
                單筆轉換
              </TabsTrigger>
              <TabsTrigger
                value="batch"
                className="rounded-none px-4 data-active:bg-primary data-active:text-primary-foreground data-active:hover:text-primary-foreground dark:data-active:hover:text-primary-foreground"
              >
                批次轉換
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {converter.mode === "batch"
              ? `每行一筆，單次最多 ${converter.MAX_BATCH_SIZE} 筆`
              : "支援 DOI、DOI URL 或 paper title"}
          </p>
        </CardHeader>

        <CardContent className="grid min-h-[620px] grid-cols-1 p-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="border-b p-4 sm:p-7 lg:border-r lg:border-b-0">
            <div className="mb-5 flex items-start justify-between gap-5">
              <div>
                <span className="mb-1 block font-mono text-[11px] font-extrabold tracking-[0.1em] text-[#b84025]">
                  01 / INPUT
                </span>
                <h2 className="font-heading text-2xl font-semibold">
                  {converter.mode === "single"
                    ? "輸入一筆文獻"
                    : "輸入文獻清單"}
                </h2>
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={converter.loadExample}
                className="h-auto px-0 text-[#b84025]"
              >
                填入範例
              </Button>
            </div>

            <label htmlFor="citation-input" className="sr-only">
              DOI 或論文標題
            </label>
            <Textarea
              id="citation-input"
              value={converter.rawInput}
              onChange={(event) => converter.updateInput(event.target.value)}
              maxLength={7500}
              aria-invalid={Boolean(converter.error)}
              placeholder={
                converter.mode === "single"
                  ? "例如：10.3102/0034654315581420"
                  : "10.3102/0034654315581420\n10.1109/tlt.2023.3259013\n或每行貼上一個完整 paper title"
              }
              spellCheck={false}
              className="field-sizing-fixed h-[270px] min-h-[270px] resize-none overflow-auto rounded-none bg-[linear-gradient(rgb(20_36_31/0.055)_1px,transparent_1px)] bg-[length:100%_32px] bg-card px-5 py-4 font-mono text-sm leading-8 shadow-none"
            />

            <div className="mt-2.5 flex min-h-7 justify-between gap-4 text-xs text-muted-foreground">
              <span
                className={cn(
                  converter.error && "font-bold text-destructive"
                )}
                aria-live="polite"
              >
                {converter.error ||
                  (converter.rawInput
                    ? `已辨識 ${converter.parsedInputs.length} 筆輸入`
                    : "若貼上完整引用，系統會優先擷取其中的 DOI")}
              </span>
              <span>{converter.rawInput.length}/7,500</span>
            </div>

            <Button
              type="button"
              size="lg"
              onClick={converter.convert}
              disabled={converter.loading}
              className="mt-5 h-14 w-full justify-between rounded-none border border-foreground bg-accent px-5 text-base font-extrabold text-accent-foreground hover:bg-[#b84025]"
            >
              <span>
                {converter.loading ? "正在查找文獻…" : "開始轉換"}
              </span>
              {converter.loading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ArrowRight />
              )}
            </Button>

            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              未登入時只做即時查詢；登入後可將結果儲存到自己的專案。正式投稿前仍建議依目標期刊規範複核。
            </p>
          </section>

          <section className="min-w-0 max-w-full overflow-hidden bg-card/60 p-4 sm:p-7">
            {converter.results.length ? (
              <>
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                  <div>
                    <span className="mb-1 block font-mono text-[11px] font-extrabold tracking-[0.1em] text-[#b84025]">
                      02 / OUTPUT
                    </span>
                    <h2 className="font-heading text-2xl font-semibold">
                      {converter.successfulResults.length} 筆完成
                      {failedCount > 0 ? `，${failedCount} 筆未顯示` : ""}
                    </h2>
                  </div>
                  {converter.successfulResults.length > 0 && (
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                converter.copyText(
                                  converter.allCitationText(),
                                  "all"
                                )
                              }
                              className="flex-1 rounded-none sm:flex-none"
                            />
                          }
                        >
                          {converter.copied === "all" ? <Check /> : <Copy />}
                          {converter.copied === "all"
                            ? "已複製"
                            : "複製全部"}
                        </TooltipTrigger>
                        <TooltipContent>複製目前格式的所有結果</TooltipContent>
                      </Tooltip>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={converter.downloadAll}
                        className="flex-1 rounded-none sm:flex-none"
                      >
                        <Download />
                        下載{" "}
                        {converter.style === "bibtex" ? ".bib" : ".txt"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={converter.downloadRis}
                        className="flex-1 rounded-none sm:flex-none"
                      >
                        <Download />
                        下載 .ris
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openSavePanel()}
                        disabled={converter.saving}
                        className="flex-1 rounded-none sm:flex-none"
                      >
                        <FolderPlus />
                        儲存到專案
                      </Button>
                    </div>
                  )}
                </div>

                {saveOpen && (
                  <div className="mt-5 border border-foreground/30 bg-secondary/40 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-heading text-lg font-semibold">
                          儲存到專案
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          伺服器會重新產生引用快照，不接受瀏覽器送來的格式化字串。
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSaveOpen(false)}
                      >
                        關閉
                      </Button>
                    </div>

                    {loadingProjects ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        正在載入專案…
                      </p>
                    ) : saveError ? (
                      <div className="mt-4 space-y-3 text-sm">
                        <p className="text-destructive" role="alert">
                          {saveError}
                        </p>
                        {saveError.includes("請先登入") && (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto px-0 font-semibold text-accent underline underline-offset-4"
                            onClick={() => {
                              window.location.href = "/api/auth/signin?callbackUrl=/"
                            }}
                          >
                            前往登入
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                        {saveProjects.length > 0 && (
                          <label className="grid gap-1 text-sm sm:col-span-2">
                            <span className="font-semibold">選擇既有專案</span>
                            <select
                              value={selectedProjectId}
                              onChange={(event) =>
                                setSelectedProjectId(event.target.value)
                              }
                              className="h-10 rounded-none border border-input bg-background px-3"
                            >
                              {saveProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}（{project._count.references} 筆）
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label className="grid gap-1 text-sm">
                          <span className="font-semibold">或建立新專案</span>
                          <Input
                            value={newProjectName}
                            onChange={(event) => {
                              setNewProjectName(event.target.value)
                              if (event.target.value) {
                                setSelectedProjectId("")
                              }
                            }}
                            maxLength={100}
                            placeholder="例如：IEEE ToE 文獻"
                            className="rounded-none"
                          />
                        </label>
                        <Button
                          type="button"
                          onClick={() => void saveCurrentResults()}
                          disabled={converter.saving}
                          className="self-end rounded-none"
                        >
                          {converter.saving ? "儲存中…" : "確認儲存"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {converter.saveMessage && (
                  <p
                    className="mt-3 text-sm font-semibold text-[#5d9a56]"
                    role="status"
                  >
                    {converter.saveMessage}
                  </p>
                )}

                {failedCount > 0 && (
                  <div
                    className="mt-5 border-l-4 border-[#b84025] bg-[#fff6ef] px-4 py-3 text-sm leading-6 text-muted-foreground"
                    role="status"
                  >
                    <p>
                      {failedCount} 筆輸入找不到完全相符且唯一的文獻，為避免誤引，未產生引用：
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {converter.failedResults.map((failure) => (
                        <li key={failure.order} className="break-all">
                          <span>第 {failure.order} 筆：</span>
                          <span className="font-mono text-xs">
                            {failure.input}
                          </span>
                          <span className="block text-muted-foreground">
                            {failure.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {converter.successfulResults.length > 0 && (
                  <Tabs
                    value={converter.style}
                    onValueChange={(value) =>
                      converter.setStyle(value as CitationStyle)
                    }
                    className="my-5"
                  >
                    <TabsList
                      className="grid h-auto w-full grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-0 rounded-none border border-r-0 border-b-0 bg-transparent p-0"
                      style={{ height: "auto" }}
                    >
                      {STYLE_OPTIONS.map((option) => (
                        <TabsTrigger
                          key={option.id}
                          value={option.id}
                          className="h-auto min-h-11 rounded-none border-r border-b px-2 py-2 text-center text-xs leading-tight font-extrabold whitespace-normal data-active:bg-primary data-active:text-primary-foreground data-active:hover:text-primary-foreground dark:data-active:hover:text-primary-foreground"
                        >
                          {option.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}

                {converter.successfulResults.length > 0 &&
                  (converter.style === "ieee" ||
                    converter.style === "vancouver") && (
                    <div className="mb-4 flex items-center gap-3 text-sm">
                      <label htmlFor="citation-start-number">起始編號</label>
                      <Input
                        id="citation-start-number"
                        type="number"
                        min={1}
                        max={9999}
                        step={1}
                        value={converter.startNumber}
                        onChange={(event) =>
                          converter.updateStartNumber(event.target.value)
                        }
                        className="h-9 w-24 rounded-none font-mono text-sm"
                      />
                      <span className="text-xs text-muted-foreground">
                        用於接續既有參考文獻清單的編號
                      </span>
                    </div>
                  )}

                <div className="grid max-h-[min(28rem,60vh)] min-w-0 max-w-full gap-3.5 overflow-auto overscroll-contain pr-1">
                  {converter.successfulResults.map((result, index) => {
                    const output = converter.citationTextAt(
                      result,
                      converter.style,
                      index
                    )
                    const copyId = `item-${index}`

                    return (
                      <Card
                        key={`${result.input}-${index}`}
                        className="min-w-0 max-w-full gap-0 rounded-none border bg-card py-0 shadow-none"
                      >
                        <CardHeader className="min-w-0 rounded-none border-b px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className="mb-1 rounded-none font-mono text-[10px] tracking-[0.08em] text-[#b84025]"
                          >
                            ITEM {String(index + converter.startNumber).padStart(2, "0")} ·{" "}
                            {result.data.inputType.toUpperCase()} ·{" "}
                            {result.data.provenance.provider.toUpperCase()}
                          </Badge>
                          <CardTitle className="min-w-0 pr-14 text-sm font-extrabold [overflow-wrap:anywhere]">
                            {result.data.metadata.title}
                          </CardTitle>
                          <p className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            {[
                              result.data.metadata.year,
                              result.data.metadata.journal,
                              result.data.metadata.doi,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <CardAction>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      converter.copyText(output, copyId)
                                    }
                                    aria-label={`複製第 ${index + 1} 筆引用`}
                                  />
                                }
                              >
                                {converter.copied === copyId ? (
                                  <Check />
                                ) : (
                                  <Copy />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {converter.copied === copyId
                                  ? "已複製"
                                  : "複製此筆"}
                              </TooltipContent>
                            </Tooltip>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="min-w-0 max-w-full overflow-auto p-0">
                          <pre
                            className={cn(
                              "m-0 min-w-0 max-w-full overflow-auto [overflow-wrap:anywhere] whitespace-pre-wrap p-4 font-heading text-[15px] leading-7",
                              converter.style === "bibtex" &&
                                "overflow-x-auto font-mono text-xs leading-6 whitespace-pre"
                            )}
                          >
                            {output}
                          </pre>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="grid min-h-full place-items-center px-6 py-16 text-center">
                <div>
                  <div className="mx-auto mb-5 grid size-[76px] place-items-center rounded-full border border-foreground bg-[#bdd0a7] font-heading text-3xl italic">
                    7
                  </div>
                  <h2 className="font-heading text-2xl font-semibold">
                    一份資料，七種格式
                  </h2>
                  <Separator className="mx-auto my-4 w-16 bg-foreground/30" />
                  <p className="mx-auto max-w-sm text-sm leading-7 text-muted-foreground">
                    完成查詢後可直接切換格式，不必重複輸入。批次結果也能一次複製或下載。
                  </p>
                </div>
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <footer className="flex flex-col justify-between gap-2 pt-5 text-[11px] text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Cite for All · MIT License</span>
        <a
          href="https://citationstyles.org/"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-border underline-offset-4 hover:text-foreground"
        >
          (c) Frank Bennett · citeproc-js implements the Citation Style Language
        </a>
      </footer>
      </main>
    </>
  )
}

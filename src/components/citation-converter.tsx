"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  FolderPlus,
  LoaderCircle,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SignInDialog } from "@/components/auth/sign-in-dialog"
import { useCitationConverter } from "@/hooks/use-citation-converter"
import { savePendingConversion } from "@/lib/anonymous-session"
import { buildReferenceItems } from "@/lib/references/save-payload"
import { sanitizeHtml } from "@/lib/sanitize-html"
import { STYLE_OPTIONS, type CitationStyle } from "@/lib/citations"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/site-header"

interface ProjectOption {
  id: string
  name: string
  _count?: { references: number }
}

const styles = [
  ["apa", "APA 7th"],
  ["mla", "MLA 9"],
  ["chicago", "Chicago"],
  ["harvard", "Harvard"],
  ["ieee", "IEEE"],
  ["vancouver", "Vancouver"],
  ["bibtex", "BibTeX"],
] as const

interface CitationConverterProps {
  showHeader?: boolean
}

export function CitationConverter({
  showHeader = true,
}: CitationConverterProps = {}) {
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user

  const converter = useCitationConverter()
  const failedCount = converter.failedResults.length

  const [projects, setProjects] = React.useState<ProjectOption[]>([])
  const [projectsLoading, setProjectsLoading] = React.useState(false)
  const [savingToProject, setSavingToProject] = React.useState(false)

  // Create & Save state
  const [createAndSaveOpen, setCreateAndSaveOpen] = React.useState(false)
  const [newProjectName, setNewProjectName] = React.useState("")
  const [newProjectDescription, setNewProjectDescription] = React.useState("")
  const [newProjectStyle, setNewProjectStyle] = React.useState("apa")
  const [creatingProject, setCreatingProject] = React.useState(false)
  const [createError, setCreateError] = React.useState("")

  // Fetch projects when user is logged in
  React.useEffect(() => {
    if (!user) return

    let isMounted = true
    async function loadUserProjects() {
      setProjectsLoading(true)
      try {
        const res = await fetch("/api/projects", {
          headers: { "Cache-Control": "no-cache" },
        })
        if (res.ok) {
          const payload = (await res.json()) as { projects?: ProjectOption[] }
          if (isMounted && payload.projects) {
            setProjects(payload.projects)
          }
        }
      } catch {
        // ignore background fetch error
      } finally {
        if (isMounted) setProjectsLoading(false)
      }
    }

    void loadUserProjects()
    return () => {
      isMounted = false
    }
  }, [user])

  async function handleSaveToProject(
    targetProjectId: string,
    targetProjectName: string,
  ) {
    if (converter.successfulResults.length === 0) return

    setSavingToProject(true)
    try {
      const response = await fetch(
        `/api/projects/${targetProjectId}/references`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: buildReferenceItems(converter.successfulResults),
          }),
        },
      )
      const payload = (await response.json()) as {
        created?: unknown[]
        skipped?: Array<{ input: string; reason: string }>
        error?: string
      }

      if (!response.ok) {
        toast.error(payload.error || "儲存失敗，請稍後再試。")
        return
      }

      const createdCount = payload.created?.length ?? 0
      const skippedCount = payload.skipped?.length ?? 0

      // Update local reference count
      setProjects((prev) =>
        prev.map((p) =>
          p.id === targetProjectId
            ? {
                ...p,
                _count: {
                  references: (p._count?.references ?? 0) + createdCount,
                },
              }
            : p,
        ),
      )

      if (skippedCount > 0) {
        toast.success(
          `已存入 ${createdCount} 筆文獻至「${targetProjectName}」。`,
          {
            description: `${skippedCount} 筆因 DOI 重複而略過。`,
            action: {
              label: "查看專案",
              onClick: () => router.push(`/projects/${targetProjectId}`),
            },
          },
        )
      } else {
        toast.success(
          `已存入 ${createdCount} 筆文獻至「${targetProjectName}」。`,
          {
            action: {
              label: "查看專案",
              onClick: () => router.push(`/projects/${targetProjectId}`),
            },
          },
        )
      }
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。")
    } finally {
      setSavingToProject(false)
    }
  }

  function openCreateAndSave() {
    setNewProjectName("")
    setNewProjectDescription("")
    setNewProjectStyle("apa")
    setCreateError("")
    setCreateAndSaveOpen(true)
  }

  async function handleCreateAndSave() {
    const trimmedName = newProjectName.trim()
    if (!trimmedName) {
      setCreateError("請輸入專案名稱。")
      return
    }

    setCreatingProject(true)
    setCreateError("")
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: newProjectDescription || null,
          defaultStyle: newProjectStyle,
        }),
      })
      const payload = (await res.json()) as {
        project?: { id: string; name: string }
        error?: string
      }

      if (!res.ok || !payload.project) {
        setCreateError(payload.error || "建立專案失敗。")
        return
      }

      const createdProject = payload.project

      const saveRes = await fetch(
        `/api/projects/${createdProject.id}/references`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: buildReferenceItems(converter.successfulResults),
          }),
        },
      )
      const savePayload = (await saveRes.json()) as {
        created?: unknown[]
        skipped?: Array<{ input: string; reason: string }>
        error?: string
      }

      if (!saveRes.ok) {
        toast.error(
          `專案「${createdProject.name}」已建立，但存入文獻失敗：${savePayload.error || "請稍後重試。"}`,
        )
        setCreateAndSaveOpen(false)
        router.push(`/projects/${createdProject.id}`)
        return
      }

      setCreateAndSaveOpen(false)
      const createdCount = savePayload.created?.length ?? 0
      const skippedCount = savePayload.skipped?.length ?? 0
      if (skippedCount > 0) {
        toast.success(
          `已建立專案「${createdProject.name}」並存入 ${createdCount} 筆文獻。`,
          {
            description: `${skippedCount} 筆因 DOI 重複而略過。`,
          },
        )
      } else {
        toast.success(
          `已建立專案「${createdProject.name}」並存入 ${createdCount} 筆文獻。`,
        )
      }
      router.push(`/projects/${createdProject.id}`)
    } catch {
      setCreateError("無法連線到專案服務，請稍後再試。")
    } finally {
      setCreatingProject(false)
    }
  }

  return (
    <>
      {showHeader && <SiteHeader />}
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
            貼上 DOI、DOI 網址或完整論文標題，即可取得 APA 7th、MLA 9、Chicago
            Author–Date、Harvard Cite Them Right、IEEE、Vancouver 與 BibTeX。
          </p>
        </section>

        <Card className="gap-0 rounded-none border border-foreground/90 bg-card/80 py-0 shadow-[0_20px_60px_rgb(20_36_31/0.10)] backdrop-blur-sm">
          <CardContent className="grid min-h-[620px] grid-cols-1 p-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="border-b p-4 sm:p-7 lg:border-r lg:border-b-0">
              <div className="mb-5 flex items-start justify-between gap-5">
                <div>
                  <span className="mb-1 block font-mono text-[11px] font-extrabold tracking-[0.1em] text-[#b84025]">
                    01 / INPUT
                  </span>
                  <h2 className="font-heading text-2xl font-semibold">
                    輸入文獻清單
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
                  "10.3102/0034654315581420\n10.1109/tlt.2023.3259013\n或每行貼上一個完整 paper title"
                }
                spellCheck={false}
                className="field-sizing-fixed h-[270px] min-h-[270px] resize-none overflow-auto rounded-none bg-[linear-gradient(rgb(20_36_31/0.055)_1px,transparent_1px)] bg-[length:100%_32px] bg-card px-5 py-4 font-mono text-sm leading-8 shadow-none"
              />

              <div className="mt-2.5 flex min-h-7 justify-between gap-4 text-xs text-muted-foreground">
                <span
                  className={cn(
                    converter.error && "font-bold text-destructive",
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
                <span>{converter.loading ? "正在查找文獻…" : "開始轉換"}</span>
                {converter.loading ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ArrowRight />
                )}
              </Button>

              <p className="mt-4 text-xs leading-6 text-muted-foreground">
                未登入時只做即時查詢；登入後可將文獻直接存入專案、自訂排序並隨時匯出。
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
                                  converter.copyRichText(
                                    converter.allCitationText(),
                                    converter.allCitationHtml(),
                                    "all",
                                  )
                                }
                                className="flex-1 rounded-none sm:flex-none"
                              />
                            }
                          >
                            {converter.copied === "all" ? <Check /> : <Copy />}
                            {converter.copied === "all" ? "已複製" : "複製全部"}
                          </TooltipTrigger>
                          <TooltipContent>
                            複製目前格式的所有結果
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={converter.downloadAll}
                          className="flex-1 rounded-none sm:flex-none"
                        >
                          <Download />
                          下載 {converter.style === "bibtex" ? ".bib" : ".txt"}
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

                        {!user ? (
                          <SignInDialog
                            callbackUrl="/"
                            trigger={
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  savePendingConversion(
                                    converter.rawInput,
                                    converter.successfulResults.length,
                                  )
                                }
                                className="flex-1 rounded-none sm:flex-none"
                              >
                                <FolderPlus className="size-4" />
                                <span>
                                  登入並保存{" "}
                                  {converter.successfulResults.length} 筆
                                </span>
                              </Button>
                            }
                          />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={savingToProject}
                                  className="flex-1 rounded-none sm:flex-none"
                                />
                              }
                            >
                              <FolderPlus className="size-4" />
                              <span>
                                {savingToProject ? "儲存中…" : "存進專案"}
                              </span>
                              <ChevronDown className="ml-1 size-3.5 opacity-70" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>
                                選擇儲存專案
                              </DropdownMenuLabel>
                              {projectsLoading ? (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                  載入專案中…
                                </div>
                              ) : projects.length === 0 ? (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                  尚無專案
                                </div>
                              ) : (
                                projects.map((proj) => (
                                  <DropdownMenuItem
                                    key={proj.id}
                                    onClick={() =>
                                      void handleSaveToProject(
                                        proj.id,
                                        proj.name,
                                      )
                                    }
                                  >
                                    <span className="truncate">
                                      {proj.name}
                                    </span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      {proj._count?.references ?? 0} 筆
                                    </span>
                                  </DropdownMenuItem>
                                ))
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={openCreateAndSave}>
                                <Plus className="size-4" />
                                <span>建立新專案並儲存…</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}
                  </div>

                  {failedCount > 0 && (
                    <div
                      className="mt-5 border-l-4 border-[#b84025] bg-[#fff6ef] px-4 py-3 text-sm leading-6 text-muted-foreground"
                      role="status"
                    >
                      <p>
                        {failedCount}{" "}
                        筆輸入找不到完全相符且唯一的文獻，為避免誤引，未產生引用：
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
                      <TabsList className="h-auto flex-wrap gap-1 rounded-none bg-muted/60 p-1">
                        {STYLE_OPTIONS.map((style) => (
                          <TabsTrigger
                            key={style.id}
                            value={style.id}
                            className="rounded-none px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground"
                          >
                            {style.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  )}

                  {(converter.style === "ieee" ||
                    converter.style === "vancouver") && (
                    <div className="mb-4 flex flex-wrap items-center gap-2 border border-foreground/20 bg-secondary/30 px-3 py-2 text-xs">
                      <span className="font-semibold text-foreground">
                        自訂起始編號：
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={9999}
                        value={converter.startNumber}
                        onChange={(e) =>
                          converter.updateStartNumber(e.target.value)
                        }
                        className="h-7 w-20 rounded-none bg-card px-2 font-mono text-xs"
                      />
                      <span className="text-muted-foreground">
                        {converter.style === "ieee"
                          ? "（預設 [1]，可填 [4] 等連續編號）"
                          : "（預設 1.，可填 4. 等連續編號）"}
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {converter.successfulResults.map((result, index) => {
                      const output = converter.citationTextAt(
                        result,
                        converter.style,
                        index,
                      )
                      const outputHtml = converter.citationHtmlAt(
                        result,
                        converter.style,
                        index,
                      )
                      const copyId = `single-${index}`

                      return (
                        <Card
                          key={`${result.input}-${index}`}
                          className="rounded-none border border-foreground/30 bg-card shadow-xs"
                        >
                          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className="rounded-none font-mono text-[10px] uppercase"
                              >
                                #{index + 1} · {result.data.inputType}
                              </Badge>
                              {result.data.metadata.title && (
                                <CardTitle className="line-clamp-1 font-sans text-xs font-semibold text-muted-foreground">
                                  {result.data.metadata.title}
                                </CardTitle>
                              )}
                            </div>
                            <CardAction>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() =>
                                        converter.copyRichText(
                                          output,
                                          outputHtml,
                                          copyId,
                                        )
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
                            {outputHtml ? (
                              <div
                                className="m-0 min-w-0 max-w-full overflow-auto [overflow-wrap:anywhere] p-4 font-heading text-[15px] leading-7"
                                // citeproc 已跳脫 metadata 文字；此處再經白名單淨化
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(outputHtml),
                                }}
                              />
                            ) : (
                              <pre
                                className={cn(
                                  "m-0 min-w-0 max-w-full overflow-auto [overflow-wrap:anywhere] whitespace-pre-wrap p-4 font-heading text-[15px] leading-7",
                                  converter.style === "bibtex" &&
                                    "overflow-x-auto font-mono text-xs leading-6 whitespace-pre",
                                )}
                              >
                                {output}
                              </pre>
                            )}
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

        {/* Create and Save Dialog for logged in user */}
        <Dialog
          open={createAndSaveOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !creatingProject) {
              setCreateAndSaveOpen(false)
              setCreateError("")
            }
          }}
        >
          <DialogPortal>
            <DialogBackdrop />
            <DialogViewport>
              <DialogPopup className="rounded-none">
                <div className="border border-foreground/30 bg-secondary/40 p-4 sm:p-5">
                  <DialogTitle>建立新專案並儲存</DialogTitle>
                  <DialogDescription className="mt-1">
                    建立專案並將目前轉換的 {converter.successfulResults.length}{" "}
                    筆文獻直接存入。
                  </DialogDescription>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm sm:col-span-2">
                      <span className="font-semibold">專案名稱</span>
                      <Input
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        maxLength={100}
                        placeholder="例如：畢業論文文獻庫"
                        className="rounded-none"
                        autoFocus
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-semibold">描述（選填）</span>
                      <Textarea
                        value={newProjectDescription}
                        onChange={(e) =>
                          setNewProjectDescription(e.target.value)
                        }
                        maxLength={500}
                        placeholder="專案用途…"
                        className="min-h-24 rounded-none"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-semibold">預設引用格式</span>
                      <select
                        value={newProjectStyle}
                        onChange={(e) => setNewProjectStyle(e.target.value)}
                        className="h-10 rounded-none border border-input bg-card px-3 text-sm"
                      >
                        {styles.map(([val, lbl]) => (
                          <option key={val} value={val}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {createError && (
                    <p className="mt-4 text-sm text-destructive" role="alert">
                      {createError}
                    </p>
                  )}

                  <div className="mt-6 flex justify-end gap-2">
                    <DialogClose
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={creatingProject}
                          className="rounded-none"
                        >
                          取消
                        </Button>
                      }
                    />
                    <Button
                      type="button"
                      onClick={() => void handleCreateAndSave()}
                      disabled={creatingProject}
                      className="rounded-none"
                    >
                      {creatingProject ? "建立並儲存中…" : "建立並儲存"}
                    </Button>
                  </div>
                </div>
              </DialogPopup>
            </DialogViewport>
          </DialogPortal>
        </Dialog>

        <footer className="flex flex-col justify-between gap-2 pt-5 text-[11px] text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Cite for All · MIT License</span>
          <a
            href="https://citationstyles.org/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-border underline-offset-4 hover:text-foreground"
          >
            (c) Frank Bennett · citeproc-js implements the Citation Style
            Language
          </a>
        </footer>
      </main>
    </>
  )
}

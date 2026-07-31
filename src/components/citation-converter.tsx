"use client"

import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export function CitationConverter() {
  const converter = useCitationConverter()
  const failedCount =
    converter.results.length - converter.successfulResults.length

  return (
    <main className="mx-auto w-full max-w-[1480px] px-3 pb-10 sm:px-7">
      <header className="flex min-h-16 items-center justify-between border-b border-border sm:min-h-[76px]">
        <div
          className="flex items-baseline gap-2 font-heading text-xl font-bold tracking-[-0.04em]"
          aria-label="Cite for All"
        >
          <span>CITE</span>
          <span className="font-mono text-accent">/</span>
          <span>ALL</span>
        </div>
        <a
          href="https://citationstyles.org/"
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground"
          )}
        >
          <span className="size-2 rounded-full bg-[#5d9a56] shadow-[0_0_0_5px_rgb(93_154_86/0.12)]" />
          <span className="hidden md:inline">
            (c) Frank Bennett · citeproc-js implements the Citation Style
            Language
          </span>
          <span className="md:hidden">(c) Frank Bennett · CSL</span>
          <ExternalLink className="size-3.5" />
        </a>
      </header>

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
              ? "每行一筆，單次最多 15 筆"
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
              輸入內容只用於即時查詢，本站不建立帳號或儲存文獻清單。正式投稿前仍建議依目標期刊規範複核。
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
                    </div>
                  )}
                </div>

                {failedCount > 0 && (
                  <p
                    className="mt-5 border-l-4 border-[#b84025] bg-[#fff6ef] px-4 py-3 text-sm leading-6 text-muted-foreground"
                    role="status"
                  >
                    {failedCount} 筆輸入找不到完全相符且唯一的文獻，為避免誤引，未產生也未顯示引用。
                  </p>
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

                <div className="grid max-h-[min(28rem,60vh)] min-w-0 max-w-full gap-3.5 overflow-auto overscroll-contain pr-1">
                  {converter.successfulResults.map((result, index) => {
                    const output = converter.citationText(
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
                            ITEM {String(index + 1).padStart(2, "0")} ·{" "}
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
  )
}

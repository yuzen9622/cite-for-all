import { readFileSync } from "node:fs"
import path from "node:path"
import { Cite, plugins } from "@citation-js/core"
import "@citation-js/plugin-bibtex"
import "@citation-js/plugin-csl"
import { sentenceCaseTitle } from "@/lib/citation-engine/sentence-case"
import type { CslItem } from "@/lib/citation-engine/types"
import type { CitationStyle } from "@/lib/citations"

const STYLE_FILES: Record<Exclude<CitationStyle, "bibtex">, string> = {
  apa: "apa.csl",
  mla: "modern-language-association.csl",
  chicago: "chicago-author-date.csl",
  harvard: "harvard-cite-them-right.csl",
  ieee: "ieee.csl",
  vancouver: "vancouver.csl",
}

const REGISTERED_STYLE_NAMES = Object.fromEntries(
  Object.keys(STYLE_FILES).map((style) => [style, `cite-for-all-${style}`]),
) as Record<Exclude<CitationStyle, "bibtex">, string>

let assetsRegistered = false

function readEngineAsset(...segments: string[]) {
  return readFileSync(
    path.join(process.cwd(), "src", "lib", "citation-engine", ...segments),
    "utf8",
  )
}

function registerAssets() {
  if (assetsRegistered) {
    return
  }

  const config = plugins.config.get("@csl")

  for (const [style, file] of Object.entries(STYLE_FILES)) {
    config.styles.add(
      REGISTERED_STYLE_NAMES[style as Exclude<CitationStyle, "bibtex">],
      readEngineAsset("styles", file),
    )
  }

  config.locales.add("en-US", readEngineAsset("locales", "locales-en-US.xml"))
  assetsRegistered = true
}

function outputText(value: unknown) {
  if (typeof value !== "string") {
    throw new TypeError("Citation.js returned a non-text result")
  }

  return value.replace(/\r\n/g, "\n").trim()
}

// IEEE 只有「引號內」的標題（期刊論文、會議論文、章節、學位論文、網頁等）
// 採 sentence case；斜體標題（書籍、軟體、標準等）依官方範例保留 Title Case
// （例如 "Robot Vision"、"Handbook of Mathematical Functions"）。
const ITALIC_TITLE_TYPES = new Set([
  "bill",
  "book",
  "graphic",
  "legal_case",
  "legislation",
  "motion_picture",
  "song",
  "standard",
  "software",
])

function shouldSentenceCaseTitle(type: string | undefined) {
  return type ? !ITALIC_TITLE_TYPES.has(type) : true
}

/**
 * IEEE 的文章標題需 sentence case（metadata 供應商常回傳 Title Case），
 * 其餘樣式不處理。text 與 html 兩種輸出共用同一轉換。
 */
function prepareIeeeItem(
  item: CslItem,
  style: Exclude<CitationStyle, "bibtex">,
) {
  return style === "ieee" && item.title && shouldSentenceCaseTitle(item.type)
    ? { ...item, title: sentenceCaseTitle(item.title) }
    : item
}

export function formatBibliography(
  item: CslItem,
  style: Exclude<CitationStyle, "bibtex">,
) {
  registerAssets()
  const citation = new Cite([prepareIeeeItem(item, style)])

  try {
    return outputText(
      citation.format("bibliography", {
        format: "text",
        template: REGISTERED_STYLE_NAMES[style],
        lang: "en-US",
      }),
    )
  } catch (error) {
    throw new Error(`Unable to format ${style} citation`, { cause: error })
  }
}

function extractEntryHtml(html: string) {
  return html
    .replace(/^<div class="csl-bib-body">\s*/i, "")
    .replace(/\s*<\/div>\s*$/i, "")
}

/**
 * 以 CSL 的 HTML 輸出產生含 Rich Text 標記（斜體等）的單筆參考文獻 entry。
 * IEEE/APA/MLA 等樣式需要的斜體（刊名、書名、et al.）只存在於 HTML 格式；
 * `format: "text"` 會把斜體全部剝除。此函式用於 UI 展示與 Rich Text 剪貼簿。
 */
export function formatBibliographyHtml(
  item: CslItem,
  style: Exclude<CitationStyle, "bibtex">,
) {
  registerAssets()
  const citation = new Cite([prepareIeeeItem(item, style)])

  try {
    return extractEntryHtml(
      outputText(
        citation.format("bibliography", {
          format: "html",
          template: REGISTERED_STYLE_NAMES[style],
          lang: "en-US",
        }),
      ),
    )
  } catch (error) {
    throw new Error(`Unable to format ${style} citation`, { cause: error })
  }
}

export function formatBibtex(item: CslItem) {
  registerAssets()
  const citation = new Cite([item])
  return outputText(citation.format("bibtex", { format: "text" }))
}

export function formatAllCitations(item: CslItem) {
  const styles = Object.keys(STYLE_FILES) as Exclude<CitationStyle, "bibtex">[]
  const citations = {} as Record<Exclude<CitationStyle, "bibtex">, string>
  const citationsHtml = {} as Record<Exclude<CitationStyle, "bibtex">, string>

  for (const style of styles) {
    citations[style] = formatBibliography(item, style)
    citationsHtml[style] = formatBibliographyHtml(item, style)
  }

  return {
    citations,
    citationsHtml,
    bibtex: formatBibtex(item),
  }
}

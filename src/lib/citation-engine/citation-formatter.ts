import assets from "./assets.json"
import CSL from "citeproc"
import { cslForOutput } from "./metadata-normalizer"
import { formatBibtex } from "./bibtex"
export { formatBibtex } from "./bibtex"
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
 * APA 與 IEEE 文章共用保守的 sentence-case 處理，保留語言及 nocase 標記。
 */
function prepareStyleItem(
  item: CslItem,
  style: Exclude<CitationStyle, "bibtex">,
) {
  return (style === "apa" ||
    (style === "ieee" && shouldSentenceCaseTitle(item.type))) &&
    item.title &&
    (!item.language || /^en(?:-|$)/i.test(String(item.language)))
    ? {
        ...item,
        title:
          typeof item["sentence-case-title"] === "string"
            ? item["sentence-case-title"]
            : sentenceCaseTitle(item.title),
      }
    : item
}

export function formatBibliography(
  item: CslItem,
  style: Exclude<CitationStyle, "bibtex">,
) {
  return formatBibliographyBatch([item], style).text
}

export function formatBibliographyHtml(
  item: CslItem,
  style: Exclude<CitationStyle, "bibtex">,
) {
  return formatBibliographyBatch([item], style).html
}

export function formatAllCitations(item: CslItem) {
  const styles = Object.keys(STYLE_FILES) as Exclude<CitationStyle, "bibtex">[]
  const citations = {} as Record<Exclude<CitationStyle, "bibtex">, string>
  const citationsHtml = {} as Record<Exclude<CitationStyle, "bibtex">, string>

  for (const style of styles) {
    const output = formatBibliographyBatch([item], style)
    citations[style] = output.text
    citationsHtml[style] = output.html
  }

  return {
    citations,
    citationsHtml,
    bibtex: formatBibtex(item),
  }
}

const engines = new Map<string, InstanceType<typeof CSL.Engine>>()

/** One citeproc run is required for bibliography sorting and year disambiguation. */
export function formatBibliographyBatch(
  items: CslItem[],
  style: Exclude<CitationStyle, "bibtex">,
) {
  if (!items.length)
    return {
      text: "",
      html: "",
      entries: [] as { index: number; text: string; html: string }[],
    }
  const prepared = items.map((item, index) => ({
    ...prepareStyleItem(cslForOutput(item), style),
    id: `entry-${index}`,
  }))
  const byId = new Map(prepared.map((item) => [item.id, item]))
  let engine = engines.get(style)
  if (engine) {
    engine.sys.retrieveItem = (id) => byId.get(id)
    engine.updateItems([])
  } else {
    engine = new CSL.Engine(
      {
        retrieveLocale: () => assets["locales/locales-en-US.xml"],
        retrieveItem: (id) => byId.get(id),
      },
      (assets as Record<string, string>)[`styles/${STYLE_FILES[style]}`],
      "en-US",
      true,
    )
    engines.set(style, engine)
  }
  engine.updateItems(
    prepared.map((item) => item.id),
    style === "ieee" || style === "vancouver",
  )
  engine.setOutputFormat("text")
  const [textParams, textEntries] = engine.makeBibliography()
  engine.setOutputFormat("html")
  const [htmlParams, htmlEntries] = engine.makeBibliography()
  return {
    text: (
      textParams.bibstart +
      textEntries.join("") +
      textParams.bibend
    ).trim(),
    html: (
      htmlParams.bibstart +
      htmlEntries.join("") +
      htmlParams.bibend
    ).trim(),
    entries: htmlEntries.map((html, position) => ({
      index: Number(htmlParams.entry_ids[position][0].replace("entry-", "")),
      text: textEntries[position].trim(),
      html: html.trim(),
    })),
  }
}

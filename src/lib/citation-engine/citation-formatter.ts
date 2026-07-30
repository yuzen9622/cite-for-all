import { readFileSync } from "node:fs"
import path from "node:path"
import { Cite, plugins } from "@citation-js/core"
import "@citation-js/plugin-bibtex"
import "@citation-js/plugin-csl"
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
  Object.keys(STYLE_FILES).map((style) => [style, `cite-for-all-${style}`])
) as Record<Exclude<CitationStyle, "bibtex">, string>

let assetsRegistered = false

function readEngineAsset(...segments: string[]) {
  return readFileSync(
    path.join(process.cwd(), "src", "lib", "citation-engine", ...segments),
    "utf8"
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
      readEngineAsset("styles", file)
    )
  }

  config.locales.add(
    "en-US",
    readEngineAsset("locales", "locales-en-US.xml")
  )
  assetsRegistered = true
}

function outputText(value: unknown) {
  if (typeof value !== "string") {
    throw new TypeError("Citation.js returned a non-text result")
  }

  return value.replace(/\r\n/g, "\n").trim()
}

export function formatBibliography(
  item: CslItem,
  style: Exclude<CitationStyle, "bibtex">
) {
  registerAssets()
  const citation = new Cite([item])

  try {
    return outputText(
      citation.format("bibliography", {
        format: "text",
        template: REGISTERED_STYLE_NAMES[style],
        lang: "en-US",
      })
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
  return {
    citations: {
      apa: formatBibliography(item, "apa"),
      mla: formatBibliography(item, "mla"),
      chicago: formatBibliography(item, "chicago"),
      harvard: formatBibliography(item, "harvard"),
      ieee: formatBibliography(item, "ieee"),
      vancouver: formatBibliography(item, "vancouver"),
    },
    bibtex: formatBibtex(item),
  }
}

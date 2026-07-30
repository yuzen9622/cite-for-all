import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const engineRoot = path.join(projectRoot, "src", "lib", "citation-engine")
const licensesRoot = path.join(projectRoot, "LICENSES")

const revisions = {
  citationJs: "28ce00a6a5dd967baeb7f128f3f6b4a7217e5d46",
  citeprocJs: "73bc1b44bc7d54d0bfec4e070fd27f5efe024ff9",
  cslLocales: "bc0a222b4ca526126faf892c35b2b7b1215c10eb",
  cslStyles: "1de508b010b2643c8b13b082947f1054bc33357f",
}

const styles = [
  { target: "apa.csl", source: "apa.csl" },
  {
    target: "modern-language-association.csl",
    source: "modern-language-association.csl",
  },
  { target: "chicago-author-date.csl", source: "chicago-author-date.csl" },
  {
    target: "harvard-cite-them-right.csl",
    source: "harvard-cite-them-right.csl",
  },
  { target: "ieee.csl", source: "ieee.csl" },
  {
    target: "vancouver.csl",
    source: "nlm-citation-sequence.csl",
  },
]

async function download(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "cite-for-all-csl-sync/1.0" },
  })

  if (!response.ok) {
    throw new Error(`Unable to download ${url}: HTTP ${response.status}`)
  }

  return response.text()
}

async function save(relativePath, url, validator) {
  const content = await download(url)

  if (!validator(content)) {
    throw new Error(`Downloaded content failed validation: ${url}`)
  }

  const target = path.join(projectRoot, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content, "utf8")
  process.stdout.write(`updated ${relativePath}\n`)
}

for (const style of styles) {
  await save(
    path.relative(projectRoot, path.join(engineRoot, "styles", style.target)),
    `https://raw.githubusercontent.com/citation-style-language/styles/${revisions.cslStyles}/${style.source}`,
    (content) =>
      content.includes("<style") &&
      content.includes("creativecommons.org/licenses/by-sa/3.0")
  )
}

await save(
  path.relative(
    projectRoot,
    path.join(engineRoot, "locales", "locales-en-US.xml")
  ),
  `https://raw.githubusercontent.com/citation-style-language/locales/${revisions.cslLocales}/locales-en-US.xml`,
  (content) =>
    content.includes('<locale xmlns="http://purl.org/net/xbiblio/csl"') &&
    content.includes("creativecommons.org/licenses/by-sa/3.0")
)

await save(
  path.relative(projectRoot, path.join(licensesRoot, "citation-js-MIT.md")),
  `https://raw.githubusercontent.com/citation-js/citation-js/${revisions.citationJs}/LICENSE.md`,
  (content) => content.includes("MIT License")
)

await save(
  path.relative(projectRoot, path.join(licensesRoot, "citeproc-js-CPAL-1.0.txt")),
  `https://raw.githubusercontent.com/Juris-M/citeproc-js/${revisions.citeprocJs}/CPAL`,
  (content) => content.includes("Common Public Attribution License Version 1.0")
)

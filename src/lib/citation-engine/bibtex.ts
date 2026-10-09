import type { CslItem, CslName } from "./types"
import { decodeHtmlEntities } from "./title-matcher"

const TYPES: Record<string, string> = {
  "article-journal": "article",
  "article-magazine": "article",
  "article-newspaper": "article",
  book: "book",
  chapter: "incollection",
  "paper-conference": "inproceedings",
  thesis: "phdthesis",
  report: "techreport",
  manuscript: "unpublished",
}

function latex(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return ""
  const escapes: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "^": "\\textasciicircum{}",
    "~": "\\textasciitilde{}",
  }
  const tags: Record<string, string> = {
    i: "\\textit{",
    b: "\\textbf{",
    sup: "\\textsuperscript{",
    sub: "\\textsubscript{",
    span: "{",
  }
  return String(value)
    .split(/(<[^>]*>)/g)
    .map((part) => {
      if (part.startsWith("<")) {
        const tag = part.match(/^<(\/?)(i|b|sup|sub|span)(?:\s[^>]*)?>$/i)
        return tag ? (tag[1] ? "}" : tags[tag[2].toLowerCase()]) : ""
      }
      return decodeHtmlEntities(part).replace(
        /[\\{}&%$#_^~]/g,
        (char) => escapes[char] ?? `\\${char}`,
      )
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

function name(name: CslName): string {
  if (name.literal) return `{${latex(name.literal)}}`
  const family = latex(
    [name["non-dropping-particle"], name.family].filter(Boolean).join(" "),
  )
  const given = latex(
    [name.given, name["dropping-particle"]].filter(Boolean).join(" "),
  )
  // Comma-form protects compound family names from last-token guessing.
  return [family, name.suffix ? latex(name.suffix) : undefined, given]
    .filter((part) => part !== undefined)
    .join(", ")
}

export function citationKey(item: CslItem) {
  const identity =
    item.DOI?.toLowerCase() ??
    JSON.stringify([item.type, item.title, item.author, item.issued])
  let hash = 2166136261
  for (const char of identity)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  const author =
    (item.author?.[0]?.family ?? item.author?.[0]?.literal ?? "ref")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]/g, "") || "ref"
  return `${author}${item.issued?.["date-parts"]?.[0]?.[0] ?? "nd"}_${hash.toString(36)}`
}

/** Conventional BibTeX fields with UTF-8 names, publication month/day, and stable keys. */
export function formatBibtex(item: CslItem) {
  const date = item.issued?.["date-parts"]?.[0]
  const fields: Record<string, unknown> = {
    title: item.title,
    journal: item.type.startsWith("article")
      ? item["container-title"]
      : undefined,
    booktitle: ["chapter", "paper-conference"].includes(item.type)
      ? item["container-title"]
      : undefined,
    year: date?.[0],
    // The EndNote BibTex filter does not recognize a separate day field.
    month: date?.[1]
      ? `${["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][date[1] - 1]}${date[2] ? ` ${date[2]}` : ""}`
      : undefined,
    volume: item.volume,
    number: item.issue,
    pages: item.page?.replace(/[–—-]/g, "--"),
    eid: item.number,
    publisher: item.publisher,
    address: item["publisher-place"],
    edition: item.edition,
    isbn: item.ISBN,
    issn: item.ISSN,
    series: item["collection-title"],
    language: item.language,
    doi: item.DOI,
    url: item.URL,
  }
  const lines: string[] = []
  if (item.author?.length)
    lines.push(`author = {${item.author.map(name).join(" and ")}}`)
  const editors = item.editor as CslName[] | undefined
  if (editors?.length)
    lines.push(`editor = {${editors.map(name).join(" and ")}}`)
  for (const [key, value] of Object.entries(fields)) {
    const escaped = latex(value)
    if (escaped) lines.push(`${key} = {${escaped}}`)
  }
  return `@${TYPES[item.type] ?? "misc"}{${citationKey(item)},\n${lines.join(",\n")}\n}`
}

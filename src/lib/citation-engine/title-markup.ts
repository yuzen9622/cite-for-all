/** Keep only CSL's documented inline markup; never pass provider attributes through. */
export function safeTitleMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, (tag) => {
    const simple = tag.match(/^<\s*(\/?)\s*(i|b|sup|sub)\s*>$/i)
    if (simple) return `<${simple[1]}${simple[2].toLowerCase()}>`
    if (/^<\/span\s*>$/i.test(tag)) return "</span>"
    if (/^<span\s+class=["']nocase["']\s*>$/i.test(tag))
      return '<span class="nocase">'
    return ""
  })
}

/**
 * CSL HTML 引用的最小淨化器。
 *
 * citeproc-js 在 HTML 模式下會把標題／作者等 metadata 內容跳脫
 * （`<script>` → `&#60;script&#62;`），因此輸出本身已安全；這裡再加一層
 * 白名單防禦：只允許引用格式需要的標記（斜體、上下標、小型大寫），
 * 其餘元素一律解除包覆（保留文字）；屬性一律移除，唯一例外是
 * `span` 上精確等於 `font-variant: small-caps` 的 style（事件屬性如
 * `onmouseover`、可夾帶腳本的 style 值都會被移除）。
 */

const ALLOWED_TAGS = new Set([
  "i",
  "em",
  "b",
  "strong",
  "sub",
  "sup",
  "span",
])

function sanitizeNode(node: Element) {
  for (const child of Array.from(node.children)) {
    sanitizeNode(child)
    if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
      child.replaceWith(...Array.from(child.childNodes))
    }
  }

  // 除 span 的 `font-variant: small-caps` 外，一律移除所有屬性。
  // 避免事件屬性（onmouseover/onclick）與可夾帶腳本的 style 值殘留。
  const tag = node.tagName.toLowerCase()
  const style = node.getAttribute("style")
  const keepStyle =
    tag === "span" &&
    style !== null &&
    /^font-variant:\s*small-caps;?$/i.test(style.trim())

  for (const attribute of Array.from(node.attributes)) {
    if (attribute.name === "style" && keepStyle) {
      continue
    }
    node.removeAttribute(attribute.name)
  }
}

export function sanitizeHtml(html: string): string {
  if (typeof document === "undefined") {
    return html
  }

  const doc = new DOMParser().parseFromString(html, "text/html")
  sanitizeNode(doc.body)
  return doc.body.innerHTML
}
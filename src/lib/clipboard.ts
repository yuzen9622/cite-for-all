/** Return the actual clipboard mode so the UI never promises formatting after fallback. */
export async function writeCitationClipboard(
  text: string,
  html?: string,
): Promise<"rich" | "text"> {
  if (html && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ])
      return "rich"
    } catch {
      /* Fall back to plain text where rich clipboard is unavailable. */
    }
  }
  await navigator.clipboard.writeText(text)
  return "text"
}

import type { RecordQuality } from "@/lib/citation-engine/record-quality"

const LABELS: Record<string, string> = {
  author: "作者",
  editor: "編者",
  issued: "出版日期",
  publisher: "出版者",
  "container-title": "期刊／收錄書名",
  "page-or-article-number": "頁碼／文章編號",
  edition: "版次",
  ISBN: "ISBN",
  identity: "文獻身分",
  volume: "卷",
  issue: "期",
  page: "頁碼",
  number: "文章編號",
}
export function CitationQualityNotice({
  quality,
}: {
  quality?: RecordQuality
}) {
  if (!quality || (quality.status === "resolved" && !quality.warnings.length))
    return null
  const labels = (fields: string[]) =>
    fields.map((field) => LABELS[field] ?? field).join("、")
  return (
    <p
      className="px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
      role="status"
    >
      {quality.status === "incomplete" &&
        `來源未提供${labels(quality.missing)}，請核對原文；未提供不代表文獻有誤。`}
      {quality.status === "conflicting" &&
        `來源資料有衝突（${labels(quality.conflicts)}），請核對原文。`}
      {quality.warnings.join(" ")}
    </p>
  )
}

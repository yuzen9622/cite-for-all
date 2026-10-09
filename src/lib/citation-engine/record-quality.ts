import { recordFromCsl } from "./metadata-normalizer"
import { normalizeTitle } from "./title-matcher"
import { titleNeedsReview } from "./sentence-case"
import type { ProviderRecord } from "./types"

export interface RecordQuality {
  status: "resolved" | "incomplete" | "conflicting"
  missing: string[]
  conflicts: string[]
  warnings: string[]
  fields: Record<string, { provider: string; providerId: string }>
}

export function assessRecord(record: ProviderRecord): RecordQuality {
  const c = record.csl
  const required = ["author", "issued"]
  if (["article-journal", "chapter", "paper-conference"].includes(c.type))
    required.push("container-title")
  if (["book", "chapter", "dataset", "report"].includes(c.type))
    required.push("publisher")
  if (c.type === "book") required.push("ISBN", "edition")
  if (
    ["article-journal", "chapter", "paper-conference"].includes(c.type) &&
    !c.page &&
    !c.number
  )
    required.push("page-or-article-number")
  if (c.type === "chapter") required.push("editor")
  const missing = required.filter(
    (key) => !c[key] || (Array.isArray(c[key]) && !c[key].length),
  )
  const conflicts = [...(record.quality?.conflicts ?? [])]
  const warnings: string[] = []
  if (
    titleNeedsReview(
      c.title,
      typeof c.language === "string" ? c.language : undefined,
    )
  )
    warnings.push("標題含可能的專有名詞，已保留原大小寫；請核對句首大寫格式。")
  if (!c.number && /^e[0-9]+$/i.test(c.page ?? ""))
    warnings.push(
      "來源將電子定位碼列在頁碼欄位；尚未確認是否為文章編號，請核對原文。",
    )
  return {
    status: conflicts.length
      ? "conflicting"
      : missing.length
        ? "incomplete"
        : "resolved",
    missing,
    conflicts,
    warnings,
    fields:
      (record.quality?.fields ? { ...record.quality.fields } : undefined) ??
      Object.fromEntries(
        Object.entries(c)
          .filter(([key, value]) => key !== "custom" && value !== undefined)
          .map(([key]) => [
            key,
            { provider: record.provider, providerId: record.providerId },
          ]),
      ),
  }
}

/** Fill only absent fields under a matching DOI and compatible title/type. */
export function mergeRecords(
  base: ProviderRecord,
  incoming: ProviderRecord,
): ProviderRecord {
  const quality = assessRecord(base)
  const csl = { ...base.csl }
  const sameDoi =
    csl.DOI &&
    incoming.csl.DOI &&
    csl.DOI.toLowerCase() === incoming.csl.DOI.toLowerCase()
  if (
    !sameDoi ||
    normalizeTitle(csl.title) !== normalizeTitle(incoming.csl.title) ||
    csl.type !== incoming.csl.type
  ) {
    return {
      ...base,
      quality: {
        ...quality,
        status: "conflicting",
        conflicts: [...new Set([...quality.conflicts, "identity"])],
      },
    }
  }
  for (const [key, value] of Object.entries(incoming.csl)) {
    if (value == null || key === "id") continue
    const current = csl[key]
    if (current == null || (Array.isArray(current) && !current.length)) {
      csl[key] = value as never
      quality.fields[key] = incoming.quality?.fields[key] ?? {
        provider: incoming.provider,
        providerId: incoming.providerId,
      }
    } else if (key === "issued") {
      const a = csl.issued?.["date-parts"]?.[0] ?? []
      const b = incoming.csl.issued?.["date-parts"]?.[0] ?? []
      if (a.every((part, index) => part === b[index]) && b.length > a.length) {
        csl.issued = incoming.csl.issued
        quality.fields[key] = {
          provider: incoming.provider,
          providerId: incoming.providerId,
        }
      } else if (
        b.some((part, index) => a[index] !== undefined && a[index] !== part)
      )
        quality.conflicts.push(key)
    } else if (
      [
        "author",
        "editor",
        "volume",
        "issue",
        "page",
        "number",
        "edition",
      ].includes(key) &&
      JSON.stringify(current) !== JSON.stringify(value)
    ) {
      quality.conflicts.push(key)
    }
  }
  quality.conflicts = [
    ...new Set([...quality.conflicts, ...(incoming.quality?.conflicts ?? [])]),
  ]
  const normalized = recordFromCsl(csl, base.provider, base.providerId)!
  const result = { ...normalized, quality }
  result.quality = assessRecord(result)
  return result
}

export function storedRecordQuality(
  csl: import("./types").CslItem,
): RecordQuality | undefined {
  const custom = csl.custom as { citationIntegrity?: RecordQuality } | undefined
  const quality = custom?.citationIntegrity
  if (
    !quality ||
    !Array.isArray(quality.missing) ||
    !Array.isArray(quality.conflicts) ||
    !Array.isArray(quality.warnings) ||
    !quality.fields ||
    typeof quality.fields !== "object"
  )
    return undefined
  if (
    ![...quality.missing, ...quality.conflicts, ...quality.warnings].every(
      (value) => typeof value === "string",
    )
  )
    return undefined
  return quality
}

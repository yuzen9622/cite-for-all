import { NextResponse } from "next/server"
import { convertCitations } from "@/lib/citation-service"
import { MAX_BATCH_SIZE } from "@/lib/citations"

const MAX_INPUT_LENGTH = 500

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "請提供有效的 JSON 請求。" },
      { status: 400 }
    )
  }

  const inputs =
    body &&
    typeof body === "object" &&
    "inputs" in body &&
    Array.isArray(body.inputs)
      ? body.inputs
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : []

  if (inputs.length === 0) {
    return NextResponse.json(
      { error: "請至少提供一筆 DOI 或論文標題。" },
      { status: 400 }
    )
  }

  if (inputs.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `單次最多可轉換 ${MAX_BATCH_SIZE} 筆文獻。` },
      { status: 400 }
    )
  }

  if (inputs.some((input) => input.length > MAX_INPUT_LENGTH)) {
    return NextResponse.json(
      { error: `單筆輸入不可超過 ${MAX_INPUT_LENGTH} 個字元。` },
      { status: 400 }
    )
  }

  const results = await convertCitations(inputs, request.signal)

  return NextResponse.json(
    {
      results,
      summary: {
        total: results.length,
        succeeded: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

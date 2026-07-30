import { NextResponse } from "next/server";
import type { CitationResult, DoxaCitation } from "../../lib/citations";

const DOXA_CITE_URL = "https://doxa.papersflow.ai/api/public/cite";
const MAX_BATCH_SIZE = 15;
const CONCURRENCY = 3;

interface DoxaError {
  success?: false;
  error?: string;
}

function errorMessage(status: number, upstreamMessage?: string) {
  if (status === 429) {
    return "轉換服務目前使用量較高，請稍候一分鐘再試。";
  }

  if (status === 404) {
    return "找不到符合的文獻，請確認 DOI 或改用完整論文標題。";
  }

  if (status >= 500) {
    return "上游文獻服務暫時無法回應，請稍後再試。";
  }

  return upstreamMessage || "找不到符合的文獻，請確認 DOI 或改用完整論文標題。";
}

async function convertOne(input: string): Promise<CitationResult> {
  try {
    const response = await fetch(DOXA_CITE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ input }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | DoxaCitation
      | DoxaError
      | null;

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        input,
        status: response.status,
        error: errorMessage(
          response.status,
          payload && "error" in payload ? payload.error : undefined,
        ),
      };
    }

    return { success: true, input, data: payload };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return {
      success: false,
      input,
      error: isTimeout
        ? "轉換逾時，請稍後再試。"
        : "目前無法連線到文獻轉換服務，請檢查網路後重試。",
    };
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "請提供有效的 JSON 請求。" },
      { status: 400 },
    );
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
      : [];

  if (inputs.length === 0) {
    return NextResponse.json(
      { error: "請至少提供一筆 DOI 或論文標題。" },
      { status: 400 },
    );
  }

  if (inputs.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `單次最多可轉換 ${MAX_BATCH_SIZE} 筆文獻。` },
      { status: 400 },
    );
  }

  if (inputs.some((input) => input.length > 500)) {
    return NextResponse.json(
      { error: "單筆輸入不可超過 500 個字元。" },
      { status: 400 },
    );
  }

  const results: CitationResult[] = [];

  for (let index = 0; index < inputs.length; index += CONCURRENCY) {
    const chunk = inputs.slice(index, index + CONCURRENCY);
    results.push(...(await Promise.all(chunk.map(convertOne))));
  }

  return NextResponse.json(
    {
      results,
      summary: {
        total: results.length,
        succeeded: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

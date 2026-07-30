import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { performance } from "node:perf_hooks"

const PAPERSFLOW_URL = "https://doxa.papersflow.ai/api/public/cite"

const cases = [
  {
    id: "kulik-doi",
    input: "10.3102/0034654315581420",
    valid: true,
    expectedDoi: "10.3102/0034654315581420",
  },
  {
    id: "kulik-title",
    input:
      "Effectiveness of intelligent tutoring systems: A meta-analytic review",
    valid: true,
    expectedDoi: "10.3102/0034654315581420",
  },
  {
    id: "mao-doi",
    input: "10.1109/tlt.2023.3259013",
    valid: true,
    expectedDoi: "10.1109/tlt.2023.3259013",
  },
  {
    id: "mao-title",
    input:
      "Improving Knowledge Tracing via Considering Two Types of Actual Differences From Exercises and Prior Knowledge",
    valid: true,
    expectedDoi: "10.1109/tlt.2023.3259013",
  },
  {
    id: "nature-doi",
    input: "10.1038/nphys1170",
    valid: true,
    expectedDoi: "10.1038/nphys1170",
  },
  {
    id: "nature-title",
    input: "Measured measurement",
    valid: true,
    expectedDoi: "10.1038/nphys1170",
  },
  {
    id: "zenodo-doi",
    input: "10.5281/zenodo.3727209",
    valid: true,
    expectedDoi: "10.5281/zenodo.3727209",
  },
  {
    id: "missing-doi",
    input: "10.9999/definitely-not-a-real-doi",
    valid: false,
  },
  {
    id: "typo-title",
    input:
      "Effectivness of intelligent tutoring systems: A meta-analytic review",
    valid: false,
  },
  {
    id: "incomplete-title",
    input: "Effectiveness of intelligent tutoring systems",
    valid: false,
  },
]

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

const rounds = Number.parseInt(option("--rounds", "3"), 10)
const selfUrl = option("--self-url", "http://127.0.0.1:3100/api/cite")
const outputPath = option("--output", "")

if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) {
  throw new Error("--rounds must be an integer from 1 to 10")
}

function canonicalDoi(value) {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
        .toLowerCase()
    : null
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(
    0,
    Math.ceil((percentileValue / 100) * sorted.length) - 1
  )
  return Number(sorted[index].toFixed(1))
}

function latencyStats(results) {
  const values = results
    .filter((result) => typeof result.elapsedMs === "number")
    .map((result) => result.elapsedMs)

  if (values.length === 0) {
    return { count: 0, meanMs: null, p50Ms: null, p95Ms: null }
  }

  return {
    count: values.length,
    meanMs: Number(
      (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
    ),
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
  }
}

function normalizedResult(engine, payload) {
  if (engine === "self-hosted") {
    const result = payload?.results?.[0]
    return {
      success: result?.success === true,
      data: result?.success ? result.data : null,
      errorCode: result?.success ? null : result?.code ?? null,
    }
  }

  return {
    success: payload?.success === true,
    data: payload?.success ? payload : null,
    errorCode: payload?.success ? null : payload?.error ?? null,
  }
}

function classifyOutcome(testCase, normalized) {
  const returnedDoi = canonicalDoi(normalized.data?.metadata?.doi)

  if (!testCase.valid) {
    return normalized.success ? "false-positive" : "correct-rejection"
  }

  if (!normalized.success) {
    return "miss"
  }

  return returnedDoi === testCase.expectedDoi
    ? "correct-success"
    : "wrong-match"
}

async function measure(engine, testCase, round) {
  const url = engine === "self-hosted" ? selfUrl : PAPERSFLOW_URL
  const body =
    engine === "self-hosted"
      ? { inputs: [testCase.input] }
      : { input: testCase.input }
  const startedAt = performance.now()

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const payload = await response.json().catch(() => null)
    const elapsedMs = Number((performance.now() - startedAt).toFixed(1))
    const normalized = normalizedResult(engine, payload)

    return {
      engine,
      caseId: testCase.id,
      round,
      valid: testCase.valid,
      httpStatus: response.status,
      elapsedMs,
      success: normalized.success,
      outcome: classifyOutcome(testCase, normalized),
      returnedDoi: canonicalDoi(normalized.data?.metadata?.doi),
      returnedTitle: normalized.data?.metadata?.title ?? null,
      formatCount: normalized.success
        ? Object.keys(normalized.data?.citations ?? {}).length +
          (normalized.data?.bibtex ? 1 : 0)
        : 0,
      errorCode: normalized.errorCode,
    }
  } catch (error) {
    return {
      engine,
      caseId: testCase.id,
      round,
      valid: testCase.valid,
      httpStatus: null,
      elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
      success: false,
      outcome: "transport-error",
      returnedDoi: null,
      returnedTitle: null,
      formatCount: 0,
      errorCode: error instanceof Error ? error.name : "UnknownError",
    }
  }
}

function summarize(engine, results) {
  const engineResults = results.filter((result) => result.engine === engine)
  const validCases = cases.filter((testCase) => testCase.valid)
  const invalidCases = cases.filter((testCase) => !testCase.valid)
  const coveredCases = validCases.filter((testCase) => {
    const attempts = engineResults.filter(
      (result) => result.caseId === testCase.id
    )
    return (
      attempts.length === rounds &&
      attempts.every((result) => result.outcome === "correct-success")
    )
  })
  const rejectedCases = invalidCases.filter((testCase) => {
    const attempts = engineResults.filter(
      (result) => result.caseId === testCase.id
    )
    return (
      attempts.length === rounds &&
      attempts.every((result) => result.outcome === "correct-rejection")
    )
  })

  return {
    validCaseCoverage: {
      covered: coveredCases.length,
      total: validCases.length,
      rate: Number((coveredCases.length / validCases.length).toFixed(4)),
    },
    invalidCaseRejection: {
      rejected: rejectedCases.length,
      total: invalidCases.length,
      rate: Number((rejectedCases.length / invalidCases.length).toFixed(4)),
    },
    outcomeCounts: Object.fromEntries(
      [
        "correct-success",
        "correct-rejection",
        "false-positive",
        "miss",
        "wrong-match",
        "transport-error",
      ].map((outcome) => [
        outcome,
        engineResults.filter((result) => result.outcome === outcome).length,
      ])
    ),
    latency: {
      all: latencyStats(engineResults),
      valid: latencyStats(engineResults.filter((result) => result.valid)),
      firstObserved: latencyStats(
        engineResults.filter((result) => result.round === 1)
      ),
      subsequent: latencyStats(
        engineResults.filter((result) => result.round > 1)
      ),
    },
  }
}

const results = []

for (let round = 1; round <= rounds; round += 1) {
  const rotatedCases = [
    ...cases.slice((round - 1) % cases.length),
    ...cases.slice(0, (round - 1) % cases.length),
  ]

  for (const testCase of rotatedCases) {
    for (const engine of ["self-hosted", "papersflow"]) {
      const result = await measure(engine, testCase, round)
      results.push(result)
      process.stdout.write(
        `${engine.padEnd(11)} r${round} ${testCase.id.padEnd(18)} ` +
          `${String(result.elapsedMs).padStart(7)}ms ${result.outcome}\n`
      )
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  methodology: {
    rounds,
    requestMode: "sequential, engine order alternates by case pair",
    timeoutMs: 30_000,
    selfUrl,
    papersflowUrl: PAPERSFLOW_URL,
    firstObservedDefinition:
      "Round 1 in this run; upstream cache state cannot be controlled.",
    coverageDefinition:
      "A valid case is covered only when every round returns the expected DOI.",
  },
  cases,
  summary: {
    selfHosted: summarize("self-hosted", results),
    papersflow: summarize("papersflow", results),
  },
  results,
}

const serialized = `${JSON.stringify(report, null, 2)}\n`

if (outputPath) {
  const absoluteOutput = path.resolve(outputPath)
  await mkdir(path.dirname(absoluteOutput), { recursive: true })
  await writeFile(absoluteOutput, serialized, "utf8")
  process.stdout.write(`wrote ${absoluteOutput}\n`)
} else {
  process.stdout.write(serialized)
}

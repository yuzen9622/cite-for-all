import { afterEach, describe, expect, it, vi } from "vitest"
import { CrossrefProvider } from "@/lib/citation-engine/providers/crossref-provider"
import { DoiContentProvider } from "@/lib/citation-engine/providers/doi-content-provider"
import { OpenAlexProvider } from "@/lib/citation-engine/providers/openalex-provider"

describe("metadata providers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("requires DOI.org to return the requested canonical DOI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          DOI: "10.1000/another",
          type: "journal-article",
          title: "Another work",
        })
      )
    )

    await expect(
      new DoiContentProvider().getByDoi("10.1000/requested")
    ).resolves.toBeNull()
  })

  it("maps a Crossref search result and joins its subtitle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          message: {
            items: [
              {
                DOI: "10.1000/work",
                type: "journal-article",
                title: ["Main title"],
                subtitle: ["A subtitle"],
                author: [{ given: "Ada", family: "Lovelace" }],
                issued: { "date-parts": [[2024]] },
              },
            ],
          },
        })
      )
    )

    const records = await new CrossrefProvider().searchByTitle(
      "Main title: A subtitle"
    )

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      provider: "crossref",
      metadata: {
        title: "Main title: A subtitle",
        doi: "10.1000/work",
      },
    })
  })

  it("does not call OpenAlex when no API key is configured", async () => {
    vi.stubEnv("OPENALEX_API_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      new OpenAlexProvider().searchByTitle("Any title")
    ).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

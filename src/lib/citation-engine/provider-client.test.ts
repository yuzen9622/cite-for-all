import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchProviderJson } from "@/lib/citation-engine/provider-client"

describe("provider HTTP client", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns null for a provider 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    )

    await expect(
      fetchProviderJson("crossref", "https://example.test/work")
    ).resolves.toBeNull()
  })

  it("retries a 429 response and then returns JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "0" },
        })
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true }, { status: 200 })
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      fetchProviderJson("crossref", "https://example.test/work")
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

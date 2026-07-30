import { describe, expect, it } from "vitest"
import {
  CitationResolver,
  ResolutionError,
} from "@/lib/citation-engine/citation-resolver"
import type {
  MetadataProvider,
  ProviderRecord,
} from "@/lib/citation-engine/types"

function record(title: string, doi: string): ProviderRecord {
  return {
    provider: "crossref",
    providerId: doi,
    csl: {
      id: doi,
      type: "article-journal",
      title,
      DOI: doi,
    },
    metadata: { title, authors: [], doi },
  }
}

describe("CitationResolver", () => {
  it("accepts a DOI only when the returned canonical DOI is identical", async () => {
    const mismatched: MetadataProvider = {
      name: "crossref",
      getByDoi: async () => record("Wrong record", "10.1000/wrong"),
    }
    const matching: MetadataProvider = {
      name: "datacite",
      getByDoi: async () => ({
        ...record("Right record", "10.1000/right"),
        provider: "datacite",
      }),
    }
    const resolver = new CitationResolver({
      doiProviders: [mismatched, matching],
      titleProviders: [],
    })

    await expect(resolver.resolve("10.1000/right")).resolves.toMatchObject({
      inputType: "doi",
      record: { metadata: { title: "Right record" } },
    })
  })

  it("fails closed for an incorrect DOI", async () => {
    const provider: MetadataProvider = {
      name: "crossref",
      getByDoi: async () => null,
    }
    const resolver = new CitationResolver({
      doiProviders: [provider],
      titleProviders: [],
    })

    await expect(resolver.resolve("10.1000/missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })

  it("accepts one exact title and rejects a typo", async () => {
    const provider: MetadataProvider = {
      name: "crossref",
      searchByTitle: async () => [
        record("Knowledge Tracing: A Review", "10.1000/one"),
      ],
    }
    const resolver = new CitationResolver({
      doiProviders: [],
      titleProviders: [provider],
    })

    await expect(
      resolver.resolve("Knowledge Tracing — A Review")
    ).resolves.toMatchObject({ inputType: "title" })
    await expect(
      resolver.resolve("Knowlege Tracing: A Review")
    ).rejects.toBeInstanceOf(ResolutionError)
  })

  it("rejects ambiguous identical titles", async () => {
    const provider: MetadataProvider = {
      name: "crossref",
      searchByTitle: async () => [
        record("Shared title", "10.1000/one"),
        record("Shared title", "10.1000/two"),
      ],
    }
    const resolver = new CitationResolver({
      doiProviders: [],
      titleProviders: [provider],
    })

    await expect(resolver.resolve("Shared title")).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })
})

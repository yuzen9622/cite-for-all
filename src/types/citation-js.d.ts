declare module "@citation-js/core" {
  export class Cite {
    constructor(data?: unknown, options?: Record<string, unknown>)
    data: unknown[]
    format(name: string, options?: Record<string, unknown>): unknown
  }

  interface Register<T = unknown> {
    add(key: string, value: T): Register<T>
    get(key: string): T
    has(key: string): boolean
  }

  interface CslPluginConfig {
    styles: Register<string>
    locales: Register<string>
  }

  export const plugins: {
    config: {
      get(name: "@csl"): CslPluginConfig
    }
  }
}

declare module "@citation-js/plugin-csl"
declare module "@citation-js/plugin-bibtex"

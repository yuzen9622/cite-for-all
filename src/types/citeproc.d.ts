declare module "citeproc" {
  interface Engine {
    sys: { retrieveItem: (id: string) => unknown }
    setOutputFormat(format: string): void
    updateItems(ids: string[], nosort?: boolean): string[]
    makeBibliography(): [
      { bibstart: string; bibend: string; entry_ids: string[][] },
      string[],
    ]
  }
  const CSL: {
    Engine: new (
      sys: {
        retrieveLocale: (lang: string) => string
        retrieveItem: (id: string) => unknown
      },
      style: string,
      lang?: string,
      forceLang?: boolean,
    ) => Engine
  }
  export default CSL
}

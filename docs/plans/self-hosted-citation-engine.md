# 第三輪：移除 PapersFlow 依賴的文獻引用引擎研究與實作計畫

- 日期：2026-07-31
- 狀態：已批准並完成第一版實作
- 範圍：書目解析、查詢、嚴格比對、格式化、授權、UI 串接與驗證

## 1. 結論

可以移除 PapersFlow，而且不需要自己重寫 APA、MLA、Chicago 等規則。

建議採用「自有引用引擎 + 開放書目資料源」：

1. 本專案自行判斷輸入是 DOI 或題名。
2. DOI 優先透過 `doi.org` Content Negotiation 取得標準 CSL-JSON。
3. 題名查詢 Crossref 與 DataCite；OpenAlex 作為可選的廣覆蓋補充來源。跨來源彙整後只接受正規化完全相同且唯一的作品。
4. 所有來源都轉成專案自己的 Canonical CSL-JSON 資料模型。
5. 在 Next.js 伺服器端使用 CSL 處理器與固定版本樣式，本地產生 APA 7、MLA 9、Chicago Author-Date、Harvard Cite Them Right、IEEE、Vancouver。
6. BibTeX 由 CSL-JSON 本地輸出，不再向任何格式化服務請求。
7. 保留目前 `POST /api/cite` 的主要成功回應形狀，讓 UI 不必整頁重寫。

這代表：

- 不再依賴 PapersFlow 的可用性、輸出決策與未知限流。
- 仍會依賴 Crossref、DataCite 或 OpenAlex 的「書目資料」，除非另建數百 GB 至 TB 級的本地索引。
- 引用格式化本身在本專案完成；切換格式不會再次呼叫外部 API。
- 格式正確性取決於「上游 metadata 品質 + 固定 CSL 樣式版本 + CSL processor 行為」，不能宣稱與 PapersFlow 逐字相同。

## 2. 目前 PapersFlow 實際負責的工作

現行實作只有一個真正的供應商耦合點：

- `src/lib/citation-service.ts`
  - 每筆輸入 POST 到 `https://doxa.papersflow.ai/api/public/cite`
  - 同時把「查 metadata」與「產生七種格式」交給 PapersFlow
  - 每批併發 3 筆，逾時 15 秒
- `src/lib/citations.ts`
  - 公開型別直接命名為 `DoxaCitation`
- `src/components/citation-converter.tsx`
  - 顯示 PapersFlow attribution
- `README.md`
  - 架構、API 與免責說明都把 PapersFlow 視為核心

目前 PapersFlow 成功回應可抽象成：

```ts
interface ExistingCitationPayload {
  success: true
  inputType: "doi" | "title"
  metadata: {
    title: string
    authors: string[]
    year?: number
    journal?: string
    volume?: string
    issue?: string
    pages?: string
    doi?: string
    publisher?: string
    url?: string
    type?: string
  }
  citations: {
    apa: string
    mla: string
    chicago: string
    harvard: string
    ieee: string
    vancouver: string
  }
  bibtex: string
}
```

因此「相同功能」不是一個功能，而是五個不同問題：

1. 輸入分類：DOI、DOI URL、完整題名。
2. 書目解析：DOI 對應到作品 metadata。
3. 題名搜尋：只接受能與輸入題名嚴格相等的作品。
4. 正規化：把不同供應商欄位轉成一致資料模型。
5. 格式化：把同一份 metadata 套入六種 CSL 樣式及 BibTeX。

## 3. 官方資料源研究

### 3.1 DOI.org Content Negotiation

DOI Foundation 說明 DOI resolver 可依 `Accept` header 回傳不同 metadata representation，並在不同 DOI Registration Agency 之間路由。對本專案最有用的是：

```http
GET https://doi.org/{doi}
Accept: application/vnd.citationstyles.csl+json
```

優點：

- 一條 DOI 路徑可處理 Crossref、DataCite 等不同註冊機構。
- 回傳格式已接近格式化引擎所需的 CSL-JSON。
- 避免先猜 DOI 屬於哪個註冊機構。

限制：

- 只解決 DOI，不解決題名搜尋。
- 某些 DOI 或 Registration Agency 可能不支援指定 representation，仍需 direct provider fallback。
- 必須處理 redirect、`404`、`406`、`429`、逾時與不完整 metadata。

來源：[DOI Handbook：Content Negotiation](https://www-new.doi.org/doi-handbook/HTML/content-negotiation.html)、[DOI Citation Formatter formats](https://citation.doi.org/docs.html)

### 3.2 Crossref

Crossref 是題名搜尋與學術文章 metadata 的首選來源：

- 公開 REST API 不要求註冊。
- `/v1/works/{doi}` 可取單一 Crossref DOI。
- `/v1/works?query.title=...&rows=5` 可搜尋題名候選。
- 官方建議使用 `mailto` 進入 polite pool、檢查 HTTP status 並快取結果。
- 2025-12-01 起，polite pool 的單筆 DOI 為每秒 10 requests、最高併發 3；列表查詢為每秒 3 requests、最高併發 3。
- 幾乎所有 metadata 可自由重用；abstract 可能仍受作者或出版社著作權限制。本專案不需要儲存 abstract。

本次以使用者的題名實測：

```text
Improving Knowledge Tracing via Considering Two Types of Actual
Differences From Exercises and Prior Knowledge
```

Crossref 前三筆候選為：

1. 正確 DOI `10.1109/tlt.2023.3259013`，score `77.68137`
2. 相近題名，score `46.16259`
3. 相近題名，score `42.78718`

這證明 Crossref 能完成這筆題名查詢，但也證明不能只相信「第一筆」：專案必須逐筆比對正規化題名，只接受完全相同的結果。

來源：[Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)、[Crossref Metadata Retrieval 與授權](https://www.crossref.org/documentation/retrieve-metadata/)、[Crossref 2025 rate limits](https://www.crossref.org/blog/announcing-changes-to-rest-api-rate-limits/)、[Crossref API 使用建議](https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/)

### 3.3 DataCite

DataCite Public REST API 不需驗證即可查詢 Findable 狀態的 DOI：

```http
GET https://api.datacite.org/dois/{doi}
GET https://api.datacite.org/dois?query=...
```

適合補足 dataset、repository output、software、report 等 DataCite DOI。官方目前限流為：

- 未識別：每 IP 每 5 分鐘 500 requests
- `User-Agent` 含 email 或 `mailto`：每 IP 每 5 分鐘 1,000 requests
- 經 `doi.org` Content Negotiation：每 IP 每 5 分鐘 1,000 requests

建議定位：

- DOI：只在 DOI Content Negotiation 失敗時 direct fallback。
- 題名：Crossref 沒有高信心結果時再查，避免每筆固定打兩個服務。

來源：[DataCite REST API introduction](https://support.datacite.org/docs/api)、[單一 DOI 查詢](https://support.datacite.org/docs/api-get-doi)、[Query syntax](https://support.datacite.org/docs/queries)、[DataCite rate limits](https://support.datacite.org/docs/rate-limit)

### 3.4 OpenAlex

OpenAlex 的作品搜尋涵蓋 journal article、book、dataset、thesis 等，支援：

```http
GET https://api.openalex.org/works?search={title}&per_page=5&api_key=...
GET https://api.openalex.org/works?filter=doi:https://doi.org/{doi}&api_key=...
```

但 2026 年的官方政策已要求免費 API key。免費 key 每日有 USD 1 使用額度；官方列出的概略能力是每日 1,000 次 search，單一 entity lookup 不計量。這不適合作為匿名開源部署的唯一必要依賴。

建議定位：

- 設為可選 provider，只有部署者設定 `OPENALEX_API_KEY` 才啟用。
- 用於 Crossref/DataCite 都沒有完全相同題名，或作品沒有 DOI 的情境；若仍無完全相同題名就回傳未找到。
- 回傳的 OpenAlex record 仍需正規化，不可直接洩漏到 API contract。

來源：[OpenAlex API overview](https://developers.openalex.org/)、[Authentication and pricing](https://developers.openalex.org/guides/authentication)、[Works search](https://developers.openalex.org/api-reference/works/list-works)、[DOI filter](https://developers.openalex.org/guides/filtering)

### 3.5 PubMed 不納入第一階段

NCBI E-utilities 可提高醫學領域涵蓋率，但會增加 PubMed ID、XML/JSON mapping、專屬限流與 attribution：

- 無 key 每 IP 每秒最多 3 requests。
- 有 key 預設每秒 10 requests。
- 軟體需呈現 NCBI Disclaimer/Copyright notice。

第一階段先不加入；等真實失敗案例顯示醫學 metadata 覆蓋不足，再以獨立 provider 擴充。

來源：[NCBI E-utilities usage guidelines](https://www.ncbi.nlm.nih.gov/books/NBK25497/)

## 4. 格式化引擎研究

### 4.1 為什麼使用 CSL

Citation Style Language 是 XML 格式的引用樣式規格；處理器把 CSL-JSON metadata 套入樣式後產生 bibliography。這使本專案不必手寫「超過 20 位作者」、「無作者」、「期刊卷期頁碼」、「月份」、「DOI 呈現」等大量分支。

官方 repository 有超過數千個樣式，且 APA、MLA、Chicago、IEEE 等檔案會持續更新。固定使用哪一份樣式，會直接決定輸出內容。

來源：[CSL 1.0.2 specification](https://docs.citationstyles.org/en/v1.0.2/specification.html)、[CSL processors](https://citationstyles.org/developers/#csl-processors)

### 4.2 樣式必須明確命名

第一階段固定以下六份 CSL 檔：

| UI 標籤 | CSL 檔案 | 明確版本含義 |
| --- | --- | --- |
| APA 7th | `apa.csl` | APA Style 7th edition |
| MLA 9 | `modern-language-association.csl` | MLA Handbook 9th edition |
| Chicago Author–Date | `chicago-author-date.csl` | Chicago 18th edition author-date |
| Harvard — Cite Them Right | `harvard-cite-them-right.csl` | Cite Them Right 12th edition |
| IEEE | `ieee.csl` | 官方 repository 的 IEEE generic style |
| Vancouver | `nlm-citation-sequence.csl`（本地檔名 `vancouver.csl`） | 現行官方 repository 的 Vancouver–NLM 獨立父樣式 |

目前 UI 的 `Chicago` 與 `Harvard` 太含糊。Chicago 同時有 author-date、notes-bibliography；Harvard 更不是單一全球標準。第三輪應改成上表的精確標籤。

來源：[APA CSL](https://github.com/citation-style-language/styles/blob/master/apa.csl)、[MLA CSL](https://github.com/citation-style-language/styles/blob/master/modern-language-association.csl)、[Chicago CSL](https://github.com/citation-style-language/styles/blob/master/chicago-author-date.csl)、[Harvard CSL](https://github.com/citation-style-language/styles/blob/master/harvard-cite-them-right.csl)、[IEEE CSL](https://github.com/citation-style-language/styles/blob/master/ieee.csl)、[Vancouver CSL](https://github.com/citation-style-language/styles/blob/master/vancouver.csl)

### 4.3 Citation.js 的適用範圍

建議使用：

- `@citation-js/core`
- `@citation-js/plugin-csl`
- `@citation-js/plugin-bibtex`

原因：

- 接收 CSL-JSON，適合放在正規化層之後。
- CSL plugin 可註冊自訂 CSL XML，而不是只使用內建 APA/Vancouver/Harvard。
- BibTeX plugin 支援從同一份 CSL-JSON 輸出 BibTeX，並處理 label 與 Unicode escape。
- 可以只安裝必要 plugin，不使用會自行連網的 DOI plugin，讓 provider 行為由本專案控制。

來源：[Citation.js repository](https://github.com/citation-js/citation-js)、[CSL plugin configuration](https://www.npmjs.com/package/%40citation-js/plugin-csl)、[BibTeX plugin](https://www.npmjs.com/package/%40citation-js/plugin-bibtex)

### 4.4 不能忽略的授權 gate

授權不是附帶事項，而是實作前 gate：

- Citation.js packages 標示 MIT。
- `@citation-js/plugin-csl` 的實際格式化工作由 `citeproc-js` 完成。
- npm `citeproc` 標示 `CPAL-1.0 OR AGPL-1.0`，不是 MIT。
- citeproc-js 的 CPAL Exhibit B 要求 GUI 顯示 attribution：
  - `(c) Frank Bennett`
  - `citeproc-js implements the Citation Style Language`
  - `https://citationstyles.org/`
- 官方 CSL styles 為 CC BY-SA 3.0：
  - 軟體需清楚提及 CSL project 並連到 `https://citationstyles.org/`
  - 重發 styles 時需保留檔內作者與 contributor metadata

因此實作前必須：

1. 決定 citeproc-js 採 CPAL 或 AGPL 路徑。
2. 不改寫或移除第三方 style metadata。
3. 新增 `THIRD_PARTY_NOTICES.md` 與相應 license 文件。
4. 把目前 `Powered by PapersFlow` 區域改為符合 citeproc-js 與 CSL 的 attribution。
5. 由維護者確認整體專案繼續以 MIT 發布時的相容性；本文件不是法律意見。

若維護者不接受 CPAL/AGPL：

- 可評估 MPL-2.0 的 `citeproc-rs` WebAssembly，但官方 repository 自稱 work-in-progress，且並非 npm 即裝即用；不建議直接作為第一版 production path。
- 可暫時呼叫 DOI/Crosscite formatter，但那只是把 PapersFlow 換成另一個遠端格式化服務，不符合「本地格式化」目標。
- 不建議手寫六套規則；成本與錯誤率都遠高於採用標準 processor。

來源：[citeproc-js repository](https://github.com/Juris-M/citeproc-js)、[npm citeproc license](https://www.npmjs.com/package/citeproc)、[citeproc-js CPAL text](https://raw.githubusercontent.com/Juris-M/citeproc-js/master/CPAL)、[CSL styles license](https://github.com/citation-style-language/styles)、[citeproc-rs status](https://github.com/zotero/citeproc-rs)

## 5. 架構方案比較

| 方案 | Metadata | 格式化 | 優點 | 代價 | 建議 |
| --- | --- | --- | --- | --- | --- |
| A. 現況 | PapersFlow | PapersFlow | 程式少 | 單點依賴、不可控 | 移除 |
| B. 自有引擎 + 開放 API | DOI.org、Crossref、DataCite、可選 OpenAlex | 本地 CSL | 輕量、可測、可換 provider | 仍需外網；需處理限流與授權 | **採用** |
| C. DOI-only | DOI.org | 本地 CSL | 最簡單 | 失去題名搜尋 | 不符合需求 |
| D. 完整離線索引 | 本地 Crossref/OpenAlex snapshot | 本地 CSL | 外部 API 中斷仍可查 | 儲存、索引、更新、搜尋維運很重 | 暫不採用 |

完整離線並不是把 JSON 放進專案：

- Crossref 2026 public data file約 180 million records、壓縮後 208 GB，且只每年免費發布一次。
- OpenAlex snapshot 約 330 GB 壓縮、約 1.6 TB 解壓；免費 snapshot 為季度更新。
- 仍需建 DOI unique index、題名全文索引、增量 upsert、備份、監控與搜尋叢集。

以目前單次最多 15 筆的產品規模，方案 D 的維運成本不成比例。可把 provider interface 設計好，未來另建 metadata service 時直接替換，不需重寫 UI 與 formatter。

來源：[Crossref 2026 public data file](https://www.crossref.org/blog/2026-public-data-file-now-available/)、[Crossref public data guidance](https://crossref.org/learning/public-data-file)、[OpenAlex snapshot format](https://developers.openalex.org/download/snapshot-format)、[OpenAlex download guidance](https://developers.openalex.org/download/overview)

## 6. 目標資料流

```text
POST /api/cite
  -> request validation
  -> input parser
      -> DOI
          -> DOI.org CSL-JSON
          -> fallback: Crossref direct
          -> fallback: DataCite direct
      -> title
          -> Crossref top 5
          -> DataCite top 5
          -> optional: OpenAlex top 5
          -> local exact matcher + cross-provider ambiguity rejection
  -> provider-specific mapper
  -> canonical CSL-JSON
  -> local CSL formatter (6 styles)
  -> local BibTeX formatter
  -> provider-neutral API response
```

每一層只有一個責任：

- provider 不格式化引用。
- formatter 不發網路請求。
- API route 不知道 Crossref/DataCite 欄位。
- React UI 不知道 metadata 來源的原始 schema。

## 7. 題名比對規格

### 7.1 正規化

輸入與候選題名都執行：

1. Unicode `NFKC`
2. 移除 HTML tags、解碼常用 entities
3. 轉小寫
4. Unicode punctuation 與 dash 視為空白
5. 合併連續空白
6. 保留字母與數字，不移除學術關鍵詞

### 7.2 嚴格接受規則

不使用 fuzzy score、edit-distance threshold、provider relevance score 或「最接近候選」自動產生引用。

題名只有一個成功條件：

```text
normalize(userTitle) === normalize(providerTitle)
```

正規化只消除不改變題名語意的表示差異：

- 大小寫
- Unicode 全形／半形
- 不同 dash 與標點
- 多餘空白
- provider 回傳的 HTML tag/entity

以下情況全部視為 `NOT_FOUND`：

- 拼錯一個單字
- 缺少或增加一個有語意的單字
- 省略副標題
- 找到相似題名但不是完整相同題名
- 只有 preprint 或另一版本的近似題名
- 多個完全相同題名，但無法以 DOI 或來源唯一確認

搜尋 provider 可以回傳 top 5 供伺服器內部檢查，但 API 與 UI 都不回傳或顯示這些候選。

### 7.3 DOI 嚴格接受規則

DOI 輸入必須：

1. 通過 DOI syntax validation。
2. 移除 `https://doi.org/`、結尾標點並轉成 canonical lowercase。
3. provider 回傳的 DOI 必須與 canonical input 完全相同。
4. provider 無 DOI、回傳不同 DOI、redirect 到其他作品或 metadata 無法驗證時，全部回傳 `NOT_FOUND`。

不允許使用題名近似度替錯誤 DOI 尋找「可能想輸入的文獻」。

### 7.4 為什麼不能永遠取第一筆

題名可能：

- 只有副標題不同
- 同名但作者或年份不同
- preprint 與正式出版版並存
- 出版社 metadata 有 HTML、大小寫或 Unicode 差異
- 使用者貼入整段 APA reference 而不是純題名

誤配會產生「格式看起來正確、內容卻屬於另一篇文章」的高風險結果。本專案採 fail-closed：無法嚴格證明相同就不產生、不顯示任何引用。

## 8. Provider-neutral domain model

```ts
type InputKind = "doi" | "title"
type MetadataSource = "doi" | "crossref" | "datacite" | "openalex"

interface CanonicalCitation {
  csl: CslItem
  metadata: CitationMetadata
  provenance: {
    source: MetadataSource
    sourceId: string
    resolvedDoi?: string
    match: "exact-doi" | "exact-title"
    retrievedAt: string
  }
}

interface CitationPayload {
  success: true
  inputType: InputKind
  metadata: CitationMetadata
  citations: Record<
    "apa" | "mla" | "chicago" | "harvard" | "ieee" | "vancouver",
    string
  >
  bibtex: string
  provenance: CanonicalCitation["provenance"]
}
```

`CitationMetadata` 可繼續供目前 UI 使用；CSL item 保留在 server-side domain，不直接要求 UI 理解。

## 9. API 相容策略

### 9.1 Request

維持：

```json
{
  "inputs": ["10.3102/0034654315581420", "full paper title"]
}
```

維持單次 15 筆、每筆 500 字元上限。

### 9.2 Success

維持目前前端所讀取的：

```json
{
  "results": [
    {
      "success": true,
      "input": "...",
      "data": {
        "success": true,
        "inputType": "doi",
        "metadata": {},
        "citations": {},
        "bibtex": "...",
        "provenance": {}
      }
    }
  ],
  "summary": {
    "total": 1,
    "succeeded": 1,
    "failed": 0
  }
}
```

`provenance` 是 additive field，不破壞目前 hook。

### 9.3 Failure

新增穩定 machine-readable code：

```ts
type CitationErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "FORMAT_FAILED"
```

失敗結果：

```json
{
  "success": false,
  "input": "...",
  "code": "NOT_FOUND",
  "error": "找不到與輸入完全相符的文獻。"
}
```

HTTP 層仍可回 `200` 表示 batch 已完成；個別項目的 partial failure 留在 `results`。只有 request JSON/limits 不合法才回 `400`。

失敗項目不得包含 metadata、citations、BibTeX 或相似候選；前端不得為失敗項目建立引用卡片。

## 10. 網路、快取與韌性

### 10.1 併發

- batch worker 維持最大 3。
- Crossref list search 最大併發 3，符合 polite pool。
- 同一筆輸入的 provider fallback 依序執行，不同 provider 不做無條件 fan-out。

### 10.2 逾時

- DOI lookup：8 秒
- title search：10 秒
- 整筆 resolve + format：20 秒 hard deadline
- client disconnect 時中止下游 fetch

### 10.3 Retry

- 只重試 `429`、`502`、`503`、`504` 與暫時性網路錯誤。
- 最多 2 次。
- 優先遵守 `Retry-After`，否則 exponential backoff + jitter。
- `400`、`404`、`406` 不重試，直接 fallback 或回應。

### 10.4 Cache

第一階段使用 server process 內的 bounded LRU：

- DOI key：`doi:{normalized-doi}`
- 題名 key：`title:{normalized-title}`
- successful metadata TTL：7 天
- not-found negative cache：15 分鐘
- rate-limit/upstream error：不 cache
- 上限：1,000 筆

部署到 serverless 時，cache 只視為最佳化，正確性不可依賴它。若後續流量需要跨 instance cache，再抽換 Redis adapter。

### 10.5 Provider 身分

新增：

```dotenv
CROSSREF_MAILTO=maintainer@example.org
OPENALEX_API_KEY=
```

- production 建議要求 `CROSSREF_MAILTO`，讓 Crossref polite pool 能聯絡服務維護者。
- `OPENALEX_API_KEY` 可選；未設定就不載入該 provider。
- 不把 email 或 key 傳到 browser。

## 11. 逐檔案實作計畫

所有新增 component 與 TypeScript 檔名維持 kebab-case。

### Phase 0：授權與契約先行

1. `docs/adr/0001-citation-engine-and-licensing.md`
   - 記錄 provider、formatter、授權選擇與不採用方案。
2. `THIRD_PARTY_NOTICES.md`
   - citeproc-js、Citation.js、CSL styles/locales attribution。
3. `LICENSES/`
   - 保留第三方 license 原文。
4. `src/lib/citation-engine/__fixtures__/papersflow-baseline.json`
   - 保存兩筆既有輸出作 migration comparison，不把它當永久 correctness oracle。

Gate：維護者確認 citeproc-js 的 CPAL/AGPL 採用方式後，才安裝依賴。

### Phase 1：建立 domain 與 formatter，不切 production

1. `src/lib/citation-engine/types.ts`
   - provider-neutral 型別、CSL item、error code。
2. `src/lib/citation-engine/input-parser.ts`
   - DOI URL/DOI/題名分類與正規化。
3. `src/lib/citation-engine/title-matcher.ts`
   - 可解釋的 deterministic matching。
4. `src/lib/citation-engine/metadata-normalizer.ts`
   - 共用清理、作者、日期、頁碼、DOI URL mapping。
5. `src/lib/citation-engine/citation-formatter.ts`
   - 註冊固定 CSL styles，輸出六種純文字 bibliography。
6. `src/lib/citation-engine/bibtex-formatter.ts`
   - 輸出 BibTeX；固定 key 與 Unicode policy。
7. `src/lib/citation-engine/styles/*.csl`
   - vendor 六份固定 upstream revision 的完整 style。
8. `src/lib/citation-engine/locales/locales-en-US.xml`
   - vendor 固定 locale。

這階段以本地 CSL fixtures 測試，不呼叫任何 metadata API。

### Phase 2：建立 providers 與 resolver

1. `src/lib/citation-engine/providers/metadata-provider.ts`
   - `getByDoi`、`searchByTitle` interface。
2. `src/lib/citation-engine/providers/doi-content-provider.ts`
   - DOI Content Negotiation。
3. `src/lib/citation-engine/providers/crossref-provider.ts`
   - `/v1/works/{doi}`、`query.title`、polite pool、mapping。
4. `src/lib/citation-engine/providers/datacite-provider.ts`
   - DOI 與 title fallback。
5. `src/lib/citation-engine/providers/openalex-provider.ts`
   - optional provider，只有 env key 才註冊。
6. `src/lib/citation-engine/provider-client.ts`
   - timeout、retry、`Retry-After`、User-Agent、錯誤正規化。
7. `src/lib/citation-engine/citation-cache.ts`
   - bounded LRU 與 TTL。
8. `src/lib/citation-engine/citation-resolver.ts`
   - provider fallback、canonical DOI equality 與 normalized title equality。
9. `src/lib/citation-engine/citation-engine.ts`
   - resolve -> format 的唯一 public entry point。

### Phase 3：切換 API，保留回滾能力

1. `src/lib/citations.ts`
   - `DoxaCitation` 改為 `CitationPayload`。
   - style label 改為精確名稱。
2. `src/lib/citation-service.ts`
   - 先保留 public `convertCitations()`，內部改呼叫 citation engine。
3. `src/app/api/cite/route.ts`
   - 加入 structured error code；失敗結果不回傳 metadata 或 candidates。
4. `.env.example`
   - 加入 provider 設定。

建議短期保留 server-only env：

```dotenv
CITATION_ENGINE_PROVIDER=self-hosted
```

若 production 發現重大格式回歸，可在下一次部署切回舊 adapter；不在單筆請求中雙打 PapersFlow，避免隱性依賴與雙倍流量。

### Phase 4：UI 與文件

1. `src/components/citation-converter.tsx`
   - 移除 PapersFlow 文案。
   - 成功結果可顯示 metadata source。
   - 失敗項目不建立引用卡片、不顯示候選，只顯示簡短的「未找到完全相符文獻」狀態。
   - 顯示 CSL/citeproc attribution。
2. `src/hooks/use-citation-converter.ts`
   - 支援 error code，並排除失敗項目的引用資料。
3. `README.md`
   - 更新架構、環境變數、資料來源、隱私、授權與 API response。
4. `CONTRIBUTING.md`
   - 記錄新增 provider、更新 CSL styles 與 golden fixtures 的流程。

不改目前視覺主題；只替換 attribution、樣式精確標籤與嚴格失敗狀態。

## 12. 測試計畫

建議新增 Vitest，只測 server domain 與 API；不為此階段引入瀏覽器 E2E framework。

### 12.1 Unit

- DOI：
  - bare DOI
  - `https://doi.org/...`
  - 大小寫
  - 結尾句號、括號
  - malformed DOI
- title normalization：
  - Unicode dash
  - 全形符號
  - HTML entity/tag
  - subtitle punctuation
- title matcher：
  - exact match
  - case、Unicode、標點與空白差異仍可 exact-normalized match
  - 一個單字拼錯必須拒絕
  - 缺少副標題必須拒絕
  - same title different year 且無法唯一確認必須拒絕
  - preprint vs version of record 題名不完全相同必須拒絕
  - 多筆近似候選必須拒絕
- provider mapping：
  - personal author
  - organizational author
  - missing issue/page/date
  - journal article/book/chapter/dataset/software
- formatter：
  - 六種 style 均有非空輸出
  - IEEE/Vancouver numbering 可由 batch index 重編
  - BibTeX valid entry type、key、page range 與 Unicode

### 12.2 Contract

所有 provider test 使用保存的 official response fixtures，不依賴即時網路：

- Crossref DOI success、title list、404、429、503
- DataCite DOI success、list、404、429
- DOI Content Negotiation success、406
- OpenAlex enabled/disabled、429

測試 provider response schema 改變時應 fail loudly，不可用大量 optional chaining 靜默產出空 citation。

### 12.3 Golden citations

至少涵蓋：

1. 使用者提供的 Kulik & Fletcher DOI
2. 使用者提供的 Mao et al. DOI
3. 超過 20 位作者的 journal article
4. organizational author
5. 無 DOI article
6. book
7. conference paper
8. DataCite dataset
9. Unicode/CJK 作者與題名
10. 缺 volume/issue/pages

Golden output 固定：

- Citation.js version
- citeproc-js version
- CSL style file checksum
- locale checksum

更新 style 或 processor 時，golden diff 必須人工審查，不可無條件更新 snapshot。

### 12.4 API integration

- batch 15 筆
- partial failure 不影響成功項目
- 錯誤 DOI 回 `NOT_FOUND` 且沒有 citation payload
- 錯誤或近似 title 回 `NOT_FOUND` 且沒有 candidates
- request validation `400`
- upstream timeout
- retry 次數上限
- cache hit 不再呼叫 provider
- OpenAlex key 不存在時不呼叫 OpenAlex

### 12.5 Optional live smoke

以環境旗標執行，不放在一般 CI：

```bash
LIVE_CITATION_TESTS=1 pnpm test:live
```

只測少量固定 DOI/題名，避免對公開 API 造成負擔或讓 CI 因外部服務波動變紅。

## 13. 驗收條件

### 功能

- PapersFlow URL、type、文案與 README 說明全部移除。
- 兩筆使用者範例可由 DOI 與完整題名成功解析。
- 每筆可輸出六種明確 CSL style 與 BibTeX。
- 15 筆 batch 與 partial failure 行為維持。
- IEEE/Vancouver 跨結果連續編號維持。
- DOI 與 title 只接受嚴格相符結果。
- 錯誤或近似輸入不得顯示 metadata、citation、BibTeX 或候選文獻。

### 架構

- provider schema 不可出現在 component 或 route。
- formatter 不可發送網路請求。
- provider 可被 fixture adapter 取代。
- 沒有 `Doxa*` 命名殘留。

### 品質

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- production runtime smoke
- `pnpm audit --prod`
- dependency license report 人工審查

### 開源與透明度

- README 說明查詢會送往哪些 metadata providers。
- 不再把服務宣稱為完全隱私或完全離線。
- CSL、citeproc-js 與 style attribution 可見且完整。
- bundled style 保留原作者、contributors、license。
- 錯誤訊息不洩漏 API key、email、raw upstream body。

## 14. 明確不做

第三輪不包含：

- 自建 Crossref/OpenAlex 全量索引
- PDF/URL scraping
- Google Scholar scraping
- LLM 猜測或補寫缺失 metadata
- 使用者帳號與雲端文獻庫
- 自訂 CSL style editor
- 自動宣稱引用「100% 正確」

## 15. 風險與控制

| 風險 | 影響 | 控制 |
| --- | --- | --- |
| metadata 不完整或錯誤 | 格式正確但內容錯 | provenance、缺欄位測試、投稿前複核提示 |
| 題名誤配 | 引用到錯誤文章 | normalized exact equality；無法唯一確認即 fail-closed |
| provider rate limit | batch 部分失敗 | polite identification、併發 3、cache、retry |
| CSL style upstream 更新 | 輸出突然改變 | vendor 固定 revision、checksum、golden review |
| citeproc-js 授權 | MIT 專案義務不清 | Phase 0 license gate、notices、維護者確認 |
| serverless process cache 不共享 | cache 命中率不穩 | cache 僅為最佳化；日後抽換 Redis |
| OpenAlex key 額度 | optional fallback 不可用 | 預設不依賴、feature-detect |
| provider schema drift | 空欄位或 runtime error | runtime validator、fixture contract tests |

## 16. 實作順序與批准結果

本輪已依下列順序完成：

1. 批准方案 B 與 CPAL-1.0 合規方向。
2. 固定 Citation.js、citeproc-js、CSL styles 與 locale 版本。
3. 完成 canonical CSL、DOI/title resolver、provider、cache 與本地 formatter。
4. 保留 `POST /api/cite` 主要 envelope，加入 provenance 與明確錯誤 code。
5. UI 改為 fail-closed：失敗輸入不建立 citation card。
6. 新增 license copies、第三方聲明、可見 attribution 與開源文件。
7. 以離線測試、production build 與真實 DOI/title smoke 驗證後移除舊 adapter。

批准結果：

1. 採用方案 B：「自有解析與格式化引擎，metadata 使用 DOI.org/Crossref/DataCite，可選 OpenAlex」。
2. citeproc-js 選擇 CPAL-1.0 路徑；專案 UI 顯示 Exhibit B attribution，並附完整 license 與 notices。

## 17. 第一版驗證結果

- 正確 DOI：兩筆使用者範例皆可由 production API 取得七種輸出。
- 正確完整題名：Kulik & Fletcher 題名通過 `title-exact`。
- 錯誤 DOI：回傳 `NOT_FOUND`，沒有 `data`、metadata、citation 或 BibTeX。
- 拼錯題名：回傳 `NOT_FOUND`，沒有候選清單或引用卡片。
- 混合批次：成功項目保留，錯誤項目 fail-closed。
- `pnpm lint`、`pnpm test`、`pnpm build`、`pnpm audit --prod` 與 production smoke 均通過。

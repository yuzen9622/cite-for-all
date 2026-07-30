# Cite for All

以 DOI、DOI 網址或完整論文標題查找文獻，並轉換成 APA 7th、MLA 9、Chicago、Harvard、IEEE、Vancouver 或 BibTeX。支援單筆與最多 15 筆的批次轉換。

## 功能

- DOI、`https://doi.org/...`、paper title 三種輸入
- 單筆與批次轉換；批次採每行一筆
- 同一份查詢結果即時切換七種格式，不需重新呼叫 API
- 批次轉換保留逐筆錯誤，不會因一筆失敗而清空整批
- IEEE 與 Vancouver 批次輸出自動重新編號
- 逐筆複製、全部複製、下載 `.txt` 或 BibTeX `.bib`
- Responsive UI、鍵盤 focus 樣式與 reduced-motion 支援

## 技術架構

- Next.js 16 + React 19
- vinext + Cloudflare Worker deployment
- `POST /api/cite` 作為 server-side proxy
- 上游服務：`https://doxa.papersflow.ai/api/public/cite`

瀏覽器不會直接呼叫 Doxa。這是必要的，因為 Doxa 公開 endpoint 的 CORS 僅允許 PapersFlow 網域。本站 server route 也負責輸入驗證、批次限流與錯誤正規化。

## 本機執行

需求：Node.js `>=22.13.0`

```bash
npm install
npm run dev
```

開啟終端顯示的 Local URL。

## 驗證

```bash
npm run build
npm test
npm run lint
```

## API

Request：

```http
POST /api/cite
Content-Type: application/json
```

```json
{
  "inputs": [
    "10.3102/0034654315581420",
    "Improving Knowledge Tracing via Considering Two Types of Actual Differences From Exercises and Prior Knowledge"
  ]
}
```

Response 會保留輸入順序，`results` 中每筆各自標示 `success`。單次最多 15 筆，每筆最多 500 字元。

## 使用提醒

文獻 metadata 與格式由 PapersFlow 提供。引用產生器能大幅減少手動排版，但正式投稿前仍應依目標期刊或學校採用的 style guide 複核。

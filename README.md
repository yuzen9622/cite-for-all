# Cite for All

開源的文獻引用格式轉換工具。輸入 DOI、DOI URL 或完整論文標題，即可取得 APA 7th、MLA 9、Chicago、Harvard、IEEE、Vancouver 與 BibTeX。

## 功能

- 單筆與批次轉換，批次每行一筆、單次最多 15 筆
- 同一份查詢結果即時切換七種格式，不需重新查詢
- 批次部分失敗時保留其他成功結果
- IEEE 與 Vancouver 批次輸出自動重新編號
- 逐筆複製、全部複製、下載 `.txt` 或 `.bib`
- Responsive UI、keyboard focus 與 reduced-motion 支援

## 技術

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- shadcn/ui
- pnpm
- PapersFlow Doxa citation API

本專案由標準 `create-next-app` 建立：

```bash
pnpm create next-app@latest --src-dir
```

UI 元件透過 shadcn CLI 管理，設定位於 `components.json`。所有自建 React component 檔名使用 kebab-case。

## 本機開發

需求：

- Node.js 20.9 或更新版本
- pnpm 10

```bash
pnpm install
pnpm dev
```

開啟 <http://localhost:3000>。

## 可用指令

```bash
pnpm dev
pnpm lint
pnpm build
pnpm start
```

## API

前端透過同源 `POST /api/cite` 查詢，server route 會驗證輸入並以每批三筆的方式呼叫 Doxa，避免瀏覽器 CORS 限制。

```json
{
  "inputs": [
    "10.3102/0034654315581420",
    "Improving Knowledge Tracing via Considering Two Types of Actual Differences From Exercises and Prior Knowledge"
  ]
}
```

單次最多 15 筆，每筆最多 500 字元。Response 保留輸入順序，並讓每筆結果各自標示 `success`。

## 環境變數

部署時可設定公開網站網址，供 Open Graph metadata 產生正確的絕對 URL：

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

本機未設定時預設為 `http://localhost:3000`。

## 專案結構

```text
src/
├── app/
│   ├── api/cite/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── citation-converter.tsx
│   └── ui/
├── hooks/
│   └── use-citation-converter.ts
└── lib/
    ├── citation-service.ts
    ├── citations.ts
    └── utils.ts
```

## 資料與引用格式

Metadata 與格式化結果由 [PapersFlow](https://papersflow.ai/tools/doi-converter) 提供。產生的引用應在正式投稿前依目標期刊或學校採用的 style guide 複核。

## License

[MIT](LICENSE)

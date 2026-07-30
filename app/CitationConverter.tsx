"use client";

import { useMemo, useState } from "react";
import {
  STYLE_OPTIONS,
  citationText,
  parseCitationInputs,
  type CitationResult,
  type CitationStyle,
} from "./lib/citations";

type InputMode = "single" | "batch";

const EXAMPLES = {
  single: "10.3102/0034654315581420",
  batch:
    "10.3102/0034654315581420\n10.1109/tlt.2023.3259013",
} satisfies Record<InputMode, string>;

interface ApiResponse {
  results?: CitationResult[];
  error?: string;
}

export function CitationConverter() {
  const [mode, setMode] = useState<InputMode>("single");
  const [rawInput, setRawInput] = useState("");
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [results, setResults] = useState<CitationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const parsedInputs = useMemo(
    () => parseCitationInputs(rawInput),
    [rawInput],
  );
  const successfulResults = results.filter((result) => result.success);

  function changeMode(nextMode: InputMode) {
    setMode(nextMode);
    setError("");
    setResults([]);
    setRawInput("");
  }

  async function convert() {
    setError("");

    if (!rawInput.trim()) {
      setError("請先貼上 DOI 或完整論文標題。");
      return;
    }

    if (mode === "single" && parsedInputs.length !== 1) {
      setError("單筆模式一次只能輸入一筆；多筆資料請切換到批次模式。");
      return;
    }

    if (parsedInputs.length > 15) {
      setError("單次最多可轉換 15 筆文獻。");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const response = await fetch("/api/cite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: parsedInputs }),
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.results) {
        setError(payload.error || "轉換失敗，請稍後再試。");
        return;
      }

      setResults(payload.results);
    } catch {
      setError("無法連線到轉換服務，請檢查網路後重試。");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, copyId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(copyId);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("瀏覽器未允許剪貼簿權限，請手動選取文字複製。");
    }
  }

  function allCitationText() {
    return successfulResults
      .map((result, index) => citationText(result, style, index))
      .join("\n\n");
  }

  function downloadAll() {
    const content = allCitationText();
    const extension = style === "bibtex" ? "bib" : "txt";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `citations-${style}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="wordmark" aria-label="Cite for All">
          <span>CITE</span>
          <span className="wordmark-slash">/</span>
          <span>ALL</span>
        </div>
        <a
          className="source-note"
          href="https://papersflow.ai/tools/doi-converter"
          target="_blank"
          rel="noreferrer"
        >
          <span className="source-dot" aria-hidden="true" />
          <span>Powered by PapersFlow</span>
        </a>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Citation converter · 7 formats</p>
          <h1 id="page-title">
            文獻格式，
            <br />
            一次<em>轉對。</em>
          </h1>
        </div>
        <p className="hero-copy">
          貼上 DOI、DOI 網址或完整論文標題，即可取得 APA 7th、MLA
          9、Chicago、Harvard、IEEE、Vancouver 與 BibTeX。
        </p>
      </section>

      <section className="workspace" aria-label="文獻引用轉換工作區">
        <div className="workspace-toolbar">
          <div className="mode-tabs" role="tablist" aria-label="轉換模式">
            <button
              className="mode-tab"
              type="button"
              role="tab"
              aria-selected={mode === "single"}
              onClick={() => changeMode("single")}
            >
              單筆轉換
            </button>
            <button
              className="mode-tab"
              type="button"
              role="tab"
              aria-selected={mode === "batch"}
              onClick={() => changeMode("batch")}
            >
              批次轉換
            </button>
          </div>
          <p className="limit-note">
            {mode === "batch"
              ? "每行一筆，單次最多 15 筆"
              : "支援 DOI、DOI URL 或 paper title"}
          </p>
        </div>

        <div className="workspace-grid">
          <div className="input-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">01 / INPUT</span>
                <h2>{mode === "single" ? "輸入一筆文獻" : "輸入文獻清單"}</h2>
              </div>
              <button
                className="sample-button"
                type="button"
                onClick={() => {
                  setRawInput(EXAMPLES[mode]);
                  setError("");
                }}
              >
                填入範例
              </button>
            </div>

            <label htmlFor="citation-input" className="sr-only">
              DOI 或論文標題
            </label>
            <textarea
              id="citation-input"
              className="citation-input"
              value={rawInput}
              onChange={(event) => {
                setRawInput(event.target.value);
                setError("");
              }}
              maxLength={7500}
              placeholder={
                mode === "single"
                  ? "例如：10.3102/0034654315581420"
                  : "10.3102/0034654315581420\n10.1109/tlt.2023.3259013\n或每行貼上一個完整 paper title"
              }
              spellCheck={false}
            />

            <div className="input-meta" aria-live="polite">
              <span className={error ? "error-text" : ""}>
                {error ||
                  (rawInput
                    ? `已辨識 ${parsedInputs.length} 筆輸入`
                    : "若貼上完整引用，系統會優先擷取其中的 DOI")}
              </span>
              <span>{rawInput.length}/7,500</span>
            </div>

            <button
              className="convert-button"
              type="button"
              onClick={convert}
              disabled={loading}
            >
              <span>{loading ? "正在查找文獻…" : "開始轉換"}</span>
              <span aria-hidden="true">{loading ? "···" : "→"}</span>
            </button>

            <p className="privacy-note">
              輸入內容只用於即時查詢，不會在此專案建立帳號或儲存文獻清單。轉換結果仍建議在正式投稿前依目標期刊規範複核。
            </p>
          </div>

          <div className="result-panel" aria-live="polite">
            {results.length ? (
              <>
                <div className="result-topline">
                  <div>
                    <span className="panel-kicker">02 / OUTPUT</span>
                    <h2>
                      {successfulResults.length} 筆完成
                      {successfulResults.length !== results.length
                        ? `，${results.length - successfulResults.length} 筆失敗`
                        : ""}
                    </h2>
                  </div>
                  {successfulResults.length > 0 && (
                    <div className="result-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => copyText(allCitationText(), "all")}
                      >
                        {copied === "all" ? "已複製" : "複製全部"}
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={downloadAll}
                      >
                        下載 {style === "bibtex" ? ".bib" : ".txt"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="style-picker" aria-label="引用格式">
                  {STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      className="style-button"
                      type="button"
                      aria-pressed={style === option.id}
                      onClick={() => setStyle(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="results-list">
                  {results.map((result, index) => {
                    if (!result.success) {
                      return (
                        <article
                          className="result-card is-error"
                          key={`${result.input}-${index}`}
                        >
                          <div className="result-card-head">
                            <div>
                              <span className="result-index">
                                ITEM {String(index + 1).padStart(2, "0")} · ERROR
                              </span>
                              <h3 className="result-title">{result.input}</h3>
                            </div>
                          </div>
                          <p className="citation-output">{result.error}</p>
                        </article>
                      );
                    }

                    const successIndex = results
                      .slice(0, index)
                      .filter((item) => item.success).length;
                    const output = citationText(result, style, successIndex);
                    const copyId = `item-${index}`;

                    return (
                      <article
                        className="result-card"
                        key={`${result.input}-${index}`}
                      >
                        <div className="result-card-head">
                          <div>
                            <span className="result-index">
                              ITEM {String(index + 1).padStart(2, "0")} ·{" "}
                              {result.data.inputType.toUpperCase()}
                            </span>
                            <h3 className="result-title">
                              {result.data.metadata.title}
                            </h3>
                            <p className="result-meta">
                              {[
                                result.data.metadata.year,
                                result.data.metadata.journal,
                                result.data.metadata.doi,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <button
                            className="copy-one"
                            type="button"
                            onClick={() => copyText(output, copyId)}
                            aria-label={`複製第 ${index + 1} 筆引用`}
                          >
                            {copied === copyId ? "已複製" : "複製"}
                          </button>
                        </div>
                        <pre
                          className={`citation-output ${
                            style === "bibtex" ? "is-bibtex" : ""
                          }`}
                        >
                          {output}
                        </pre>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div>
                  <div className="empty-number" aria-hidden="true">
                    7
                  </div>
                  <h2>一份資料，七種格式</h2>
                  <p>
                    完成查詢後可直接切換格式，不必重複輸入。批次結果也能一次複製或下載。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Cite for All</span>
        <span>Metadata & formatting by PapersFlow · 請於投稿前複核</span>
      </footer>
    </main>
  );
}

<div align="center">
  <img src="logo.png" alt="cite-for-all logo" width="220"/>

  # cite-for-all

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=nextdotjs)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
  [![pnpm](https://img.shields.io/badge/pnpm-10.0%2B-orange?logo=pnpm)](https://pnpm.io/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](Dockerfile)

  **🚀 Turn DOIs and paper titles into clean academic citations in 7 formats instantly 📚**

  [Features](#-features) · [Quick Start](#-quick-start) · [Docker Deployment](#-docker-deployment) · [API Reference](#-api-reference) · [License](#-license)
</div>

---

> **Tired of manually formatting references or wrestling with ad-ridden citation tools?**
> `cite-for-all` converts DOIs, DOI URLs, or full paper titles into APA 7th, MLA 9, Chicago, Harvard, IEEE, Vancouver, and BibTeX in a single click.

---

## 📖 Overview

### The Pain
Copy-pasting paper metadata into separate online formatters one-by-one is tedious, error-prone, and often hidden behind subscription paywalls or rate limits. Switching formatting styles usually means re-querying from scratch.

### The Solution
`cite-for-all` is an open-source, privacy-friendly Web & API tool built with Next.js App Router. It resolves metadata from DOI.org, Crossref, and DataCite, then formats citations locally with Citation.js, citeproc-js, and official Citation Style Language (CSL) files. It does not depend on the PapersFlow API. Optional OAuth login unlocks private projects backed by PostgreSQL; anonymous conversion remains available.

### The Result
Batch convert up to **30 papers at once**, auto-renumber numerical styles (IEEE/Vancouver), and export seamlessly to `.txt`, `.bib`, or `.ris` files in seconds.

---

## ⚡ Features

- 🎯 **7 Major Styles Supported**: APA 7th, MLA 9, Chicago Author–Date, Harvard Cite Them Right, IEEE, Vancouver, and BibTeX.
- 🔎 **Strict Matching**: A DOI must match the DOI returned by the metadata provider; a title must be an exact normalized match. Typos, incomplete titles, and ambiguous titles produce no citation.
- ⚡ **Instant Dynamic Switching**: Toggle between formats instantly without re-fetching data.
- 📦 **Batch Conversion**: Input up to 30 DOIs or paper titles per query (one per line).
- 🛡️ **Partial Failure Resilience**: If one DOI fails in a batch, all valid citations are still successfully returned.
- 🔢 **Smart Re-Numbering**: Automatic sequential indexing for numerical styles like IEEE and Vancouver.
- 💾 **One-Click Export**: Copy single citations, copy all, or download as `.txt` or native `.bib` files.
- ♿ **Accessible UI**: Full keyboard focus navigation, responsive design, and reduced-motion preference support.

---

## 📊 Comparison Matrix

| Feature / Capability | `cite-for-all` | Traditional Citation Sites | Manual Formatting |
| :--- | :---: | :---: | :---: |
| **Instant Multi-Format Switch** | ⚡ Instant (Local) | ❌ Requires Re-query | ❌ Re-write manually |
| **Batch Processing** | ✅ Up to 30 items | ⚠️ Single item only | ❌ Extremely slow |
| **BibTeX Export** | ✅ Native `.bib` | ❌ Rare / Paid | ❌ Manual syntax |
| **Ad-Free & Open Source** | ✅ 100% Free & Open | ❌ Ad-heavy / Paywalled | N/A |
| **Partial Failure Handling** | ✅ Preserves valid items | ❌ Fails entire batch | N/A |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: `20.19.0` or higher
- **pnpm**: `^10.0.0`

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/yuzen9622/cite-for-all.git
cd cite-for-all

# 2. Install dependencies
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cite_for_all pnpm install

# 3. Copy runtime settings and fill in OAuth values when needed
cp .env.example .env

# 4. Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to launch the app.

### Available Scripts

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts local Next.js development server |
| `pnpm build` | Compiles production bundle |
| `pnpm start` | Runs the compiled production server |
| `pnpm lint` | Runs ESLint verification |
| `pnpm test` | Runs the offline Vitest suite |
| `pnpm test:watch` | Runs Vitest in watch mode |
| `pnpm sync:csl` | Re-downloads the pinned official CSL assets and license copies |

---

## 🐳 Docker Deployment

`cite-for-all` provides multi-stage Docker support for fast, lightweight containerized deployments using Node.js Alpine base images and Next.js standalone builds.

### Quick Start with Docker Compose (Recommended)

```bash
# Compose uses the service hostname for PostgreSQL.
cp .env.example .env
sed -i.bak 's#@localhost:5432/#@postgres:5432/#' .env

# Start the application in detached mode
docker compose up -d --build
```

Access the app at [http://localhost:3000](http://localhost:3000).

To stop the container:
```bash
docker compose down
```

### Using Docker CLI

```bash
# 1. Build the production Docker image
docker build -t cite-for-all .

# 2. Run the container
docker run -d \
  -p 3000:3000 \
  -e CROSSREF_MAILTO=you@example.com \
  --name cite-for-all \
  cite-for-all
```

### ☁️ Cloudflare Tunnel Integration

Expose your container securely to the internet without public IP or router configuration:

1. Create a tunnel in [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) (**Networks** ➔ **Tunnels**).
2. Point the tunnel's Public Hostname service to `http://cite-for-all:3000`.
3. Add your token to `.env`:
   ```env
   TUNNEL_TOKEN=eyJh...
   ```
4. Run `docker compose up -d`. The `cloudflared` service will automatically launch and connect.

### Environment Variables in Docker

Environment variables can be defined in `.env` (which `docker-compose.yml` automatically reads) or passed via the `-e` flag:

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP listening port (maps container & host port in Docker Compose) |
| `NODE_ENV` | `production` | Application runtime environment (`production` or `development`) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Base URL for site metadata & canonical links |
| `DATABASE_URL` | PostgreSQL URL | Prisma 7 database connection string; Compose uses the `postgres` hostname |
| `AUTH_SECRET` | *(Required for login)* | Auth.js session secret |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | *(Optional)* | GitHub OAuth application credentials |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | *(Optional)* | Google OAuth application credentials |
| `AUTH_TRUST_HOST` | `true` | Trust the host header supplied by the reverse proxy |
| `CROSSREF_MAILTO` | *(Optional)* | Email passed to Crossref polite pool |
| `OPENALEX_API_KEY` | *(Optional)* | Key for OpenAlex exact-title fallback |
| `TUNNEL_TOKEN` | *(Optional)* | Cloudflare Tunnel authentication token |

---

## 🔌 API Reference

### `POST /api/cite`

Query the server route with up to 30 inputs (DOIs, DOI URLs, or full paper titles). The backend handles at most three items concurrently, resolves canonical metadata, applies strict matching, and formats accepted records locally.

#### Request Body

```json
{
  "inputs": [
    "10.3102/0034654315581420",
    "Improving Knowledge Tracing via Considering Two Types of Actual Differences From Exercises and Prior Knowledge"
  ]
}
```

* **Limits**: Maximum 30 items per array, maximum 500 characters per item.

#### Response Example

```json
{
  "results": [
    {
      "input": "10.3102/0034654315581420",
      "success": true,
      "data": {
        "success": true,
        "inputType": "doi",
        "metadata": {
          "title": "Effectiveness of intelligent tutoring systems: A meta-analytic review",
          "doi": "10.3102/0034654315581420"
        },
        "csl": {
          "id": "10.3102/0034654315581420",
          "type": "article-journal",
          "title": "Effectiveness of intelligent tutoring systems: A meta-analytic review"
        },
        "citations": {
          "apa": "...",
          "mla": "...",
          "chicago": "...",
          "harvard": "...",
          "ieee": "...",
          "vancouver": "..."
        },
        "bibtex": "@article{...}",
        "provenance": {
          "provider": "doi.org",
          "providerId": "10.3102/0034654315581420",
          "match": "doi-exact"
        }
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

An unresolved, misspelled, incomplete, or ambiguous input returns a failed item
with no metadata, citation text, BibTeX, or candidate list:

```json
{
  "success": false,
  "input": "Effectivness of intelligent tutoring systems",
  "status": 404,
  "code": "NOT_FOUND",
  "error": "找不到標題完全相符的文獻，未產生引用。"
}
```

---

## 🌐 Environment Variables

Copy `.env.example` to `.env` (for Docker/Compose) or `.env.local` (for local Node):

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cite_for_all
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_TRUST_HOST=true
NEXT_PUBLIC_SITE_URL=https://your-domain.example
CROSSREF_MAILTO=you@example.com
OPENALEX_API_KEY=
TUNNEL_TOKEN=
```

- `NODE_ENV` defaults to `production`.
- `PORT` defaults to `3000`.
- `DATABASE_URL` is the PostgreSQL connection string used by Prisma 7.
- `AUTH_SECRET` signs Auth.js sessions. `AUTH_GITHUB_*` and `AUTH_GOOGLE_*` enable the corresponding OAuth buttons when both values for a provider are set.
- `AUTH_TRUST_HOST=true` is required when the deployment sits behind a trusted reverse proxy.
- `NEXT_PUBLIC_SITE_URL` defaults to `http://localhost:3000`.
- `CROSSREF_MAILTO` is recommended so Crossref can identify requests and route them through its polite pool.
- `OPENALEX_API_KEY` is optional and only enables an additional exact-title fallback.
- `TUNNEL_TOKEN` is optional for deploying Cloudflare Tunnel automatically.

## 🔐 Login Settings

Login uses GitHub and Google OAuth without passwords or email magic links. Set the provider ID and secret in `.env`; a provider with missing values is not registered, so the rest of the application can still start.

Register these callback URLs in each OAuth application:

- GitHub: `https://your-domain.example/api/auth/callback/github`
- Google: `https://your-domain.example/api/auth/callback/google`

The home-page converter remains available without login. Login is required only for `/projects` and saving references to a project.

## 🗄️ Database

The Docker Compose setup starts PostgreSQL 17 with a healthcheck and named `pgdata` volume. For Compose, use the internal hostname in `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/cite_for_all
```

The app container runs committed migrations with `prisma migrate deploy` before starting Next.js. For a local Node process, use `localhost` instead. Prisma 7 reads the connection URL from the root `prisma.config.ts`; `DATABASE_URL` must be present before running Prisma CLI commands.

---

## 📁 Project Structure

```text
cite-for-all/
├── public/                # Static assets & logo
├── src/
│   ├── app/               # Next.js App Router routes & API endpoints
│   │   ├── api/cite/      # POST /api/cite proxy route
│   │   ├── api/projects/  # Authenticated project/reference endpoints
│   │   ├── projects/      # Project and reference management pages
│   │   ├── globals.css    # Global Tailwind styles
│   │   ├── layout.tsx     # Root layout & OG metadata
│   │   └── page.tsx       # Main page component
│   ├── components/        # React UI components (shadcn/ui + custom)
│   │   ├── citation-converter.tsx
│   │   └── ui/
│   ├── hooks/             # Custom React hooks (useCitationConverter)
│   └── lib/               # Citation service & formatting helpers
│       ├── citation-engine/     # Strict resolver, providers, cache, CSL formatter
│       ├── citation-service.ts  # Batch orchestration and public result mapping
│       ├── export-citations.ts  # Shared text/BibTeX/RIS export formatting
│       ├── references/          # CSL-to-snapshot reference writer
│       ├── db.ts                # Prisma 7 driver-adapter singleton
│       ├── citations.ts
│       └── utils.ts
├── LICENSES/              # Third-party license copies
├── scripts/               # Reproducible CSL asset sync
├── THIRD_PARTY_NOTICES.md
├── .dockerignore          # Excluded pattern rules for Docker
├── components.json        # shadcn UI config
├── docker-compose.yml     # Docker Compose orchestration definition
├── Dockerfile             # Multi-stage Docker build specification
├── package.json
└── tsconfig.json
```

---

## ⚠️ Data & Citation Disclaimer

Metadata comes from DOI.org, Crossref, DataCite, and optionally OpenAlex. Formatting uses Citation.js, citeproc-js, and vendored official CSL assets. Strict matching reduces false positives but does not guarantee that upstream metadata is complete or correct. Always check generated citations against the source publication and your target journal or institution's official style guide before submission.

---

## 🤝 Contributing & Community

Contributions, issues, and feature requests are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add AmazingFeature'`)
4. Push to the Branch (`git checkout -b feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

The original `cite-for-all` source code is distributed under the MIT License.
Citation.js is MIT-licensed; citeproc-js is used under CPAL-1.0; the vendored
CSL styles and locale are CC BY-SA 3.0. See [`LICENSE`](LICENSE),
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), and [`LICENSES/`](LICENSES/).

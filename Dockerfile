FROM node:20-alpine AS base

# Install libc6-compat for compatibility with native modules on Alpine
RUN apk add --no-cache libc6-compat

# Enable pnpm via Corepack
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 1. Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./
COPY prisma.config.ts ./prisma.config.ts
COPY prisma ./prisma

# Prisma 7 loads DATABASE_URL while the postinstall generate hook runs.
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/cite_for_all

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/cite_for_all
ENV AUTH_SECRET=build-only-secret

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build application
RUN pnpm exec prisma generate && pnpm build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and standalone build output
COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma 7 CLI, migration files, and config are outside Next standalone output.
# Copy the complete pnpm-linked tree so the CLI's symlinked packages remain valid.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Citation.js reads vendored CSL assets from process.cwd()/src at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/citation-engine/styles ./src/lib/citation-engine/styles
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/citation-engine/locales ./src/lib/citation-engine/locales

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]

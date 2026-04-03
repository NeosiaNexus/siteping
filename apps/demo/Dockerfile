FROM oven/bun:1.3.11-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/widget/package.json packages/widget/
COPY packages/adapter-prisma/package.json packages/adapter-prisma/
COPY packages/cli/package.json packages/cli/
COPY apps/demo/package.json apps/demo/
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.11-alpine AS builder
RUN apk add --no-cache nodejs
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build workspace packages (widget + adapter must be built before demo)
RUN bun run --filter='@siteping/widget' build && \
    bun run --filter='@siteping/adapter-prisma' build

# Build demo app (Next.js needs node)
RUN cd apps/demo && bun run build

# --- Runner ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/demo/.next/standalone ./
COPY --from=builder /app/apps/demo/.next/static ./apps/demo/.next/static
COPY --from=builder /app/apps/demo/public ./apps/demo/public 2>/dev/null || true

USER nextjs
EXPOSE 3000
CMD ["node", "apps/demo/server.js"]

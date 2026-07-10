FROM node:22.15.0-alpine AS builder

WORKDIR /repo

RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @nostr-watch/rstate...
RUN pnpm --filter @nostr-watch/rstate... build
RUN pnpm --filter @nostr-watch/rstate deploy --legacy --prod /prod/rstate

FROM node:22.15.0-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /prod/rstate ./

RUN addgroup -g 1001 -S cvm && \
    adduser -S cvm -u 1001

USER cvm

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "console.log('CVM running')" || exit 1

CMD ["node", "dist/index.js"]

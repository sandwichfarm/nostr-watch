ARG DENO_VERSION=2.7.5
FROM denoland/deno:bin-${DENO_VERSION} AS deno-bin

FROM debian:bookworm-slim

WORKDIR /app

# Install Deno and runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    unzip \
    sqlite3 \
    netcat-openbsd \
    dnsutils \
    procps \
    wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (pinned version via multi-arch stage)
COPY --from=deno-bin /deno /usr/local/bin/deno
RUN deno --version

# Create data directory
RUN mkdir -p /app/data

# Copy the monorepo (filtered by .dockerignore to only workspace deps)
WORKDIR /app/nostr-watch
COPY . .

# Cache dependencies (deno.lock is preserved for reproducible builds)
WORKDIR /app/nostr-watch/apps/trawler
RUN deno cache --reload src/main.ts

# Run trawler
CMD ["deno", "run", "--allow-all", "--unstable-sloppy-imports", "src/main.ts"]

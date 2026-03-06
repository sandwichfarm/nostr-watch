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

# Install Deno
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Create data directory
RUN mkdir -p /app/data

# Copy the monorepo (filtered by .dockerignore to only workspace deps)
WORKDIR /app/nostr-watch
COPY . .

# Cache dependencies (trawler uses remote esm.sh imports, so no --no-remote)
WORKDIR /app/nostr-watch/apps/trawler
RUN rm -f deno.lock && \
    deno cache --reload src/main.ts || echo "Dependency caching failed, will try at runtime"

# Run trawler
CMD ["deno", "run", "--allow-all", "--unstable-sloppy-imports", "src/main.ts"]

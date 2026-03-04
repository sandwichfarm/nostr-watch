FROM debian:bullseye-slim

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

# First, copy only the deno.lock file (if it exists) to cache dependencies
WORKDIR /app/nostr-watch
COPY apps/trawler/deno.lock* ./apps/trawler/

# Now copy the entire project
COPY . .

# Cache dependencies offline without trying to verify remote
WORKDIR /app/nostr-watch/apps/trawler
RUN deno cache --reload --no-remote src/main.ts || echo "Dependency caching failed, will try at runtime"

# Run trawler
CMD ["deno", "run", "--allow-all", "--unstable-sloppy-imports", "src/main.ts"]

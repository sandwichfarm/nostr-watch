FROM debian:bullseye-slim

WORKDIR /app

# Install all dependencies (superset of clearnet + multinet)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    unzip \
    sqlite3 \
    golang \
    netcat-openbsd \
    iptables \
    iproute2 \
    iputils-ping \
    dnsutils \
    procps \
    git \
    socat \
    redsocks \
    dante-server \
    net-tools \
    wget \
    proxychains4 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && dpkg -l | grep -q dante-server || (echo "ERROR: dante-server not installed" && exit 1) \
    && test -f /usr/sbin/danted || (echo "ERROR: danted binary not found at /usr/sbin/danted" && exit 1) \
    && chmod +x /usr/sbin/danted

# Install websocat for WebSocket testing
RUN wget -q https://github.com/vi/websocat/releases/download/v1.11.0/websocat.x86_64-unknown-linux-musl -O /usr/local/bin/websocat \
    && chmod +x /usr/local/bin/websocat \
    && websocat --version

# Install Deno
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Install hedproxy
ENV GOPATH="/root/go"
ENV PATH="${GOPATH}/bin:${PATH}"
RUN git clone https://github.com/sandwichfarm/hedproxy.git && \
    cd hedproxy && \
    go build -o /usr/local/bin/hedproxy . && \
    chmod +x /usr/local/bin/hedproxy && \
    cd / && \
    rm -rf /hedproxy /root/go /usr/local/go

# Create data directory
RUN mkdir -p /app/data

# Copy entrypoint script
COPY apps/relaymon/.docker/scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Copy default proxy configs (used in multinet mode)
COPY apps/relaymon/.docker/config/danted.conf /etc/danted.conf
COPY apps/relaymon/.docker/config/proxychains.conf /etc/proxychains.conf

# Default to clearnet mode
ENV RELAYMON_MODE=clearnet

# Copy the monorepo (filtered by .dockerignore to only workspace deps)
WORKDIR /app/nostr-watch
COPY . .

# Cache dependencies offline without trying to verify remote
WORKDIR /app/nostr-watch/apps/relaymon
RUN deno cache --reload --no-remote --unstable-sloppy-imports index.ts || echo "Dependency caching failed, will try at runtime"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

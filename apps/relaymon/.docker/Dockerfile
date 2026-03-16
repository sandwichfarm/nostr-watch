ARG DENO_VERSION=2.7.5
FROM denoland/deno:bin-${DENO_VERSION} AS deno-bin

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
ARG WEBSOCAT_VERSION=1.14.1
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)  WARCH="x86_64-unknown-linux-musl" ;; \
      aarch64) WARCH="aarch64-unknown-linux-musl" ;; \
      *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    wget -q "https://github.com/vi/websocat/releases/download/v${WEBSOCAT_VERSION}/websocat.${WARCH}" \
        -O /usr/local/bin/websocat && \
    chmod +x /usr/local/bin/websocat && \
    websocat --version

# Install Deno (pinned version via multi-arch stage)
COPY --from=deno-bin /deno /usr/local/bin/deno
RUN deno --version

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
RUN deno cache --reload --unstable-sloppy-imports index.ts

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

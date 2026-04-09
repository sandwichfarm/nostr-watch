ARG DENO_VERSION=2.7.5
FROM denoland/deno:bin-${DENO_VERSION} AS deno-bin

FROM debian:bookworm-slim

WORKDIR /app

# Install system packages needed by relaymon, trawler, and network tools
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
    xz-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install websocat with architecture detection
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

# Install Deno (pinned version, no @latest)
COPY --from=deno-bin /deno /usr/local/bin/deno
RUN deno --version

# Build hedproxy from source
ENV GOPATH="/root/go"
ENV PATH="${GOPATH}/bin:${PATH}"
RUN git clone https://github.com/sandwichfarm/hedproxy.git /tmp/hedproxy && \
    cd /tmp/hedproxy && \
    go build -o /usr/local/bin/hedproxy . && \
    chmod +x /usr/local/bin/hedproxy && \
    rm -rf /tmp/hedproxy /root/go /usr/local/go

# Install s6-overlay v3.2.2.0 (process supervisor as PID 1)
ARG S6_OVERLAY_VERSION=3.2.2.0
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && rm /tmp/s6-overlay-noarch.tar.xz
RUN ARCH=$(uname -m) && \
    curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${ARCH}.tar.xz" \
        -o /tmp/s6-overlay-arch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-arch.tar.xz && \
    rm /tmp/s6-overlay-arch.tar.xz

# s6 grace times: allow 10 seconds for SQLite WAL checkpoint before container dies
ENV S6_KILL_GRACETIME=10000
ENV S6_SERVICES_GRACETIME=10000

# Copy proxy configs
COPY apps/relaymon/.docker/config/danted.conf /etc/danted.conf
COPY apps/relaymon/.docker/config/proxychains.conf /etc/proxychains.conf

# Copy the monorepo (filtered by .dockerignore)
WORKDIR /app/nostr-watch
COPY . .

# Cache relaymon dependencies
WORKDIR /app/nostr-watch/apps/relaymon
RUN deno cache --reload --unstable-sloppy-imports index.ts

# Cache trawler dependencies
WORKDIR /app/nostr-watch/apps/trawler
RUN deno cache --reload --unstable-sloppy-imports src/main.ts

# Copy s6 service definitions from build context
COPY apps/docker-stacks/start9/s6-services/relaymon /etc/s6-overlay/s6-rc.d/relaymon
COPY apps/docker-stacks/start9/s6-services/trawler /etc/s6-overlay/s6-rc.d/trawler
COPY apps/docker-stacks/start9/s6-services/hedproxy /etc/s6-overlay/s6-rc.d/hedproxy
COPY apps/docker-stacks/start9/s6-services/config-ui /etc/s6-overlay/s6-rc.d/config-ui

# Register services with user bundle
RUN mkdir -p /etc/s6-overlay/s6-rc.d/user/contents.d && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/relaymon && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/trawler && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/hedproxy && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/config-ui

# Service dependency: relaymon waits for hedproxy to be up before starting
RUN mkdir -p /etc/s6-overlay/s6-rc.d/relaymon/dependencies.d && \
    touch /etc/s6-overlay/s6-rc.d/relaymon/dependencies.d/hedproxy

# Ensure run/finish scripts are executable
RUN chmod +x /etc/s6-overlay/s6-rc.d/relaymon/run /etc/s6-overlay/s6-rc.d/relaymon/finish && \
    chmod +x /etc/s6-overlay/s6-rc.d/trawler/run /etc/s6-overlay/s6-rc.d/trawler/finish && \
    chmod +x /etc/s6-overlay/s6-rc.d/hedproxy/run && \
    chmod +x /etc/s6-overlay/s6-rc.d/config-ui/run

# Create persistent data directory
RUN mkdir -p /opt/data

ENV RELAYMON_MODE=clearnet

# s6-overlay is PID 1 — no CMD, all processes managed by service definitions
ENTRYPOINT ["/init"]

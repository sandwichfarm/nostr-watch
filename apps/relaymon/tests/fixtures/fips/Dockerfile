ARG FIPS_IMAGE=fips-test:latest
FROM ${FIPS_IMAGE} AS mesh
FROM denoland/deno:debian-2.9.5
USER root
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 iptables libdbus-1-3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=mesh /usr/local/bin/fips /usr/local/bin/fips
WORKDIR /workspace/apps/relaymon
COPY . /workspace
RUN deno cache --no-lock --no-check --unstable-sloppy-imports tests/fixtures/fips/probe.ts tests/fixtures/fips/relay.ts
ENTRYPOINT ["/bin/sh", "tests/fixtures/fips/start.sh"]

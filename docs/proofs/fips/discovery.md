# FIPS identity discovery verification

Verified on 2026-10-27, starting from `origin/next` at `dde07b98`.

## Scope and discovery path

Trawler parses kinds 2, 3, 10002, and 30002 in `src/parse.ts`, then passes relay
URLs through Nostrings. `relaysFromRelayList` classifies accepted URLs with the
shared network classifier. `processRelayList` stores new URLs using
`seedNewRelay(url, network)` and calls `trawlerInstance.addRelays`. Nostrawl adds
these URLs to its pool; its repeating queue includes them in a subsequent cycle.

The blocker was Nostrings' whole-URL npub rejection. The exception now covers
only a parsed hostname ending in `.fips`, ignoring hostname case and one DNS
root dot. Credentials, raw paths (including dot segments), queries, and
fragments remain subject to npub rejection. Non-FIPS hosts and suffix lookalikes
remain rejected. URI decoding, normalization, and spam rules are unchanged.

The active consumers are Trawler's parser and seeder, Relaymon's seeder and
version-gated qualification sweep, and `internal/seed`. They all use Nostrings.
Trawler's legacy `src/sanitize.ts` has no internal callers, but its exported
qualifier now uses the same exception helper. Both the Nostrings package version
and exported `VERSION` are bumped from 0.6.0 to 0.6.1; a patch changeset is included.

Seed allowlists apply to initial sources. Discovery from relay-list events
still records all accepted network types. Learning an address does not require
mesh access; crawling that address requires FIPS DNS and IPv6 routing.

## Live proof

[discovery.json](discovery.json) records an actual two-node FIPS 0.5.3 mesh run
using newly generated identities. The fixture:

1. Resolves and monitors a full `npub1….fips` hostname, checks WebSocket
   open/read/write and NIP-11, and signs a kind-30166 event with `n=fips`.
2. Starts `apps/trawler/src/main.ts` with an empty database and only an alias
   configured as its FIPS seed: `ws://relay.fips:7777/bootstrap`. The standard
   built-in clearnet seeds remain present but cannot reach the Internet.
3. Sends a signed kind-10002 event advertising the npub URL, an npub path, and
   a `.fips.example.com` lookalike from the alias relay.
4. Checks the actual database contains exactly the valid npub URL with
   `network=fips`.
5. Checks the relay received a new subscription addressed to the npub hostname
   after Trawler started. Earlier monitor requests cannot satisfy this check.
6. Confirms the monitor's wildcard sentinel remains unreachable, with two
   packets counted by the explicit firewall DROP rule.

The network is Docker-internal, with no published ports or host networking.
Public/LAN discovery is disabled; runtime uses cached dependencies and
default-deny firewall rules. Trawler's database, cache, and config live in a
temporary directory. The runner removes both containers, their network, and
private identities. Cleanup was confirmed after the successful run.

Reproduce from the repository root:

```sh
docker build --build-arg FIPS_IMAGE=<local-fips-image> \
  -t nostr-watch-fips-discovery:local \
  -f apps/relaymon/tests/fixtures/fips/Dockerfile .
python3 apps/relaymon/tests/fixtures/fips/run.py \
  --image nostr-watch-fips-discovery:local \
  --output /tmp/fips-discovery-proof.json
```

The recorded run used the locally available ARM64 FIPS image
`dryft-live-fips:9e51375cb496d116-arm64`, containing FIPS revision `f4a5b4a8e6`.
No deployment or private infrastructure was changed.

## Regression results

Environment: Node 26.11.1, Deno 2.9.5, pnpm 10.24.0.

| Check | Result | Coverage |
| --- | --- | --- |
| Nostrings `vitest run` | 54 passed | FIPS hostnames, ports, paths, case, root dots; npub rejection outside the hostname; existing URL/spam rules |
| Nostrings build | Passed | Package TypeScript build |
| Trawler runtime tests | 7 passed | All four relay-list kinds, classification, legacy qualifier, seed filtering, YAML loading |
| Relaymon `test:unit` | 381 passed | FIPS seed persistence, allowlist exclusion, sweep retention/rejection, existing monitor regressions |
| Isolated live fixture | Passed | Actual entrypoint, signed advertisement, database persistence, subsequent crawl, monitoring, denied ingress |

Commands:

```sh
pnpm -F @nostrwatch/nostrings exec vitest run
pnpm -F @nostrwatch/nostrings build
cd apps/trawler
deno test --no-lock --no-check --unstable-sloppy-imports \
  --allow-net --allow-env --allow-read --allow-write --allow-run src/
cd ../relaymon
deno task test:unit
```

Tests use real, checksum-valid npub identities derived from a deterministic
test public key. The live run generates fresh private identities and retains
only public evidence.

## Existing failures and runtime repairs

- The original Trawler `deno task test` had no test modules. With tests added,
  its existing lockfile encounters an integrity mismatch for
  `https://esm.sh/chalk@5.4.1`. Runtime verification uses `--no-lock`; the
  existing lockfile is not rewritten.
- Trawler's checked dependency graph reports four existing errors: an undefined
  `seedNewRelay` in an unused helper, `void | string[]` in `parse.ts`, an undefined
  `RetryManager` type, and SQLite rows returned as `boolean` in the shared DB.
  These same diagnostics were reproduced on unchanged pre-fix source. Runtime
  tests use `--no-check`, as does the existing compiled application workflow.
- Nostrings ESLint reports the same two pre-existing TypeScript parsing errors
  in `relay-urls.test.ts:21` and `relay-urls.ts:24` on both revisions. Its
  TypeScript build and Vitest suite pass.
- Fresh unlocked Trawler startup exposed two runtime compatibility failures.
  `p-queue@latest` no longer exposes `.on()`, so both import aliases now pin
  8.1.0, the version already selected by Trawler's lockfile. The YAML loader
  imports the named `load` export, since the current module has no default
  export. Both repairs are exercised by the live entrypoint proof.

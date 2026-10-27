# FIPS support

## Scope and acceptance

Support the Free Internetworking Peering System across discovery, monitoring,
published observations, consumers, and GUI. The host supplies `.fips` DNS and
IPv6 routing, just as it supplies I2P connectivity. Do not deploy fisherman or
modify its private Ansible repository. FIPS encryption does not imply anonymity;
do not assign Tor/I2P privacy bonuses or classify all ULA IPv6 addresses as FIPS.

## Audit

- `internal/utils/src/network.ts` and `libraries/nocap/src/utils.ts` classify
  discovered URLs. Both feed seeding/cache and monitoring respectively.
- Relaymon config/result validation and interactive filters enumerate networks.
  Seeding and DB queries already consume the detected network dynamically.
- NOCAP WebSocket adapter accepts only specific networks. Info requests already
  use host networking. DNS adapter finishes non-clearnet checks but continues
  into public DoH: return immediately to prevent overlay DNS leakage.
- Announce and status/delta publishers carry network strings dynamically;
  prove that `fips` survives rather than adding redundant publisher branches.
- Relaymon trusted assertions infer a restricted network union. Add FIPS while
  preserving conservative country/privacy scores.
- rstate has duplicated event normalizers, type unions, REST/CVM schemas and
  subscription validation with fixed network enums.
- GUI network filters use observed values and formatters load SVGs by slug.
  Supply FIPS assets and accessible names; prove list/detail/monitor display.
- URL sanitization and Chronicle/Route66 should preserve `.fips` without changes;
  cover them as consumers.

## Test strategy

1. Shared classifier contract: aliases, npub hostnames, uppercase/trailing-dot
   names, ports/paths, misleading suffixes and URL components, existing networks,
   private IPv6, mixed grouping. Run against both classifier implementations.
2. NOCAP: direct host WebSocket transport, NIP-11, read/write, overlay DNS skip
   with zero public requests; existing clearnet/Tor/I2P regressions.
3. Relaymon: config/type acceptance, allowlist seeding, DB network partition,
   kind 30166/10166/1066/30385 network preservation and no anonymity bonuses.
4. rstate: both normalizers, aggregation/network queries, REST/CVM and subscription
   schema acceptance; retain existing network values.
5. GUI: formatter/assets tests and browser screenshots of actual FIPS relay and
   monitor display plus network filtering. Exercise Route66/Chronicle consumers.
6. Run affected full suites/builds/checks. Separate pre-existing failures using
   the base commit, and fix regressions introduced here.
7. If a live mesh fixture is needed, use isolated Linux network namespaces or
   containers, private peering only, no host networking, no discovery/public peers,
   no host service forwarding. Test only the fixture relay's ingress port.

## Delivery

Open a PR against `next`, including test results, monitor proof, GUI screenshots,
host prerequisites, and fixture security boundaries. Completion remains unproven
until those artifacts exist and all required checks pass.

## Delivery state

- Audit and regression strategy completed before implementation.
- Classifiers, direct transport, DNS privacy, Relaymon types/TRA, rstate
  schemas/queries, GUI icons/accessibility, documentation and changeset implemented.
- Unit and integration suites pass, including seeding/DB allowlists and REST/CVM
  parity. Both Chromium and Firefox pass relay/filter/detail/monitor proofs.
- Live two-node mesh proves open/read/write/NIP-11 and signed FIPS observation.
  Default-deny ingress is verified using a container-only sentinel and DROP
  counters. No host services, ports, or public peers were exposed.
- Verification results and public artifacts: `docs/proofs/fips/verification.md`.
  GUI type-check debt is reproduced on the integration base; no diagnostic
  locations were added. The stored baseline was not changed.
- Delivery target: a `feature/fips-support` pull request against `next`.

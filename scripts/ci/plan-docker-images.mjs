#!/usr/bin/env node
/**
 * Plan which Docker images to build/push and with which tags.
 *
 * This is the single source of truth shared by the GitHub Actions workflow
 * (.github/workflows/docker-images.yml) and local verification. It is
 * dependency-free (Node built-ins only) and pure w.r.t. its inputs (env +
 * version files + `git tag`), so the workflow logic can be exercised locally:
 *
 *   GH_EVENT_NAME=push GH_REF_TYPE=branch GH_REF_NAME=next \
 *   GH_SHA=abcdef0123456789 node scripts/ci/plan-docker-images.mjs
 *
 *   GH_EVENT_NAME=push GH_REF_TYPE=tag GH_REF_NAME='relaymon@v0.2.0' \
 *   node scripts/ci/plan-docker-images.mjs
 *
 *   GH_EVENT_NAME=workflow_dispatch IN_MODE=tagged IN_PACKAGE=relaymon \
 *   IN_VERSION=1.2.3 IN_UPDATE_LATEST=auto node scripts/ci/plan-docker-images.mjs
 *
 * Output:
 *   - human-readable plan on stderr
 *   - `matrix=<json>` and `any=<bool>` appended to $GITHUB_OUTPUT (if set)
 *   - the matrix JSON on stdout
 *
 * The matrix JSON is `{ "include": [ { name, context, dockerfile, mode, tags } ] }`
 * where `tags` is a newline-delimited string consumable by
 * docker/build-push-action's `tags:` input.
 */

import { execSync } from "node:child_process";
import { readFileSync, appendFileSync, existsSync } from "node:fs";

// --- Catalog of matrix packages that produce Docker images ----------------
// nocapd is intentionally excluded (deprecated).
const CATALOG = {
  rstate: {
    context: ".",
    dockerfile: "apps/rstate/Dockerfile",
    versionFile: "apps/rstate/package.json",
  },
  trawler: {
    context: ".",
    dockerfile: "apps/trawler/.docker/Dockerfile",
    versionFile: "apps/trawler/deno.json",
  },
  relaymon: {
    context: ".",
    dockerfile: "apps/relaymon/.docker/Dockerfile",
    versionFile: "apps/relaymon/deno.json",
  },
};

const env = process.env;
const DOCKERHUB_NS = env.DOCKERHUB_NS || "nostrwatch";
const GHCR_NS = (env.GHCR_NS || "ghcr.io/sandwichfarm").toLowerCase();
const ALL = Object.keys(CATALOG);

function fail(msg) {
  console.error(`plan-docker-images: ERROR: ${msg}`);
  process.exit(1);
}

function shortSha(sha) {
  return (sha || "").trim().slice(0, 7) || "unknown";
}

function readVersion(versionFile) {
  if (!existsSync(versionFile)) fail(`version file not found: ${versionFile}`);
  const raw = readFileSync(versionFile, "utf8");
  try {
    const v = JSON.parse(raw).version;
    if (v) return String(v);
  } catch { /* fall through to regex for JSONC */ }
  const m = raw.match(/"version"\s*:\s*"([^"]+)"/);
  if (!m) fail(`could not read version from ${versionFile}`);
  return m[1];
}

// Parse a release tag like `relaymon@v0.2.0` or `@nostr-watch/rstate@v0.1.0`.
// Returns { name, version } where name is the package basename, or null.
function parseTag(tag) {
  const m = String(tag).match(/^(.*)@v(\d+\.\d+\.\d+(?:[-+.][0-9A-Za-z-.]+)?)$/);
  if (!m) return null;
  const name = m[1].split("/").pop();
  return { name, version: m[2] };
}

function isPrerelease(version) {
  return version.includes("-");
}

// Compare two release (non-prerelease-aware) versions: returns >0 if a>b.
function cmpVersion(a, b) {
  const pa = a.split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  // Equal core: a non-prerelease outranks a prerelease.
  const apre = isPrerelease(a), bpre = isPrerelease(b);
  if (apre !== bpre) return apre ? -1 : 1;
  return 0;
}

function listTagVersions(name) {
  let out = "";
  try {
    out = execSync("git tag --list", { encoding: "utf8" });
  } catch {
    return []; // no git / no tags available
  }
  const versions = [];
  for (const line of out.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const parsed = parseTag(t);
    if (parsed && parsed.name === name) versions.push(parsed.version);
  }
  return versions;
}

// Decide whether `version` should also move :latest for `name`.
function shouldUpdateLatest(name, version, override) {
  if (override === "true") return true;
  if (override === "false") return false;
  // auto: never let a prerelease take :latest.
  if (isPrerelease(version)) return false;
  const existing = listTagVersions(name).filter((v) => !isPrerelease(v));
  const candidates = existing.concat([version]);
  let max = candidates[0];
  for (const v of candidates) if (cmpVersion(v, max) > 0) max = v;
  return cmpVersion(version, max) >= 0;
}

function devTags(name, sha) {
  const s = shortSha(sha);
  return [
    `${DOCKERHUB_NS}/${name}:dev`,
    `${DOCKERHUB_NS}/${name}:dev-${s}`,
    `${GHCR_NS}/${name}:dev`,
    `${GHCR_NS}/${name}:dev-${s}`,
  ];
}

function taggedTags(name, version, latest) {
  const tags = [
    `${DOCKERHUB_NS}/${name}:${version}`,
    `${GHCR_NS}/${name}:${version}`,
  ];
  if (latest) {
    tags.push(`${DOCKERHUB_NS}/${name}:latest`, `${GHCR_NS}/${name}:latest`);
  }
  return tags;
}

function entry(name, mode, tags) {
  const c = CATALOG[name];
  return { name, context: c.context, dockerfile: c.dockerfile, mode, tags: tags.join("\n") };
}

function plan() {
  const eventName = env.GH_EVENT_NAME || "";
  const refType = env.GH_REF_TYPE || "";
  const refName = env.GH_REF_NAME || "";
  const sha = env.GH_SHA || "";

  // Resolve the effective (mode, package, version, update_latest) from the
  // trigger. workflow_dispatch inputs override; push events are inferred.
  let mode, pkg, version, updateLatest;

  if (eventName === "workflow_dispatch") {
    mode = (env.IN_MODE || "dev").trim();
    pkg = (env.IN_PACKAGE || "all").trim();
    version = (env.IN_VERSION || "").trim();
    updateLatest = (env.IN_UPDATE_LATEST || "auto").trim();
  } else if (refType === "tag") {
    mode = "tagged";
    const parsed = parseTag(refName);
    if (!parsed) return { include: [] }; // not a release tag — nothing to do
    pkg = parsed.name;
    version = parsed.version;
    updateLatest = "auto";
  } else {
    // push to a branch => dev images for every catalog package
    mode = "dev";
    pkg = "all";
    version = "";
    updateLatest = "auto";
  }

  if (mode !== "dev" && mode !== "tagged") fail(`invalid mode: ${mode}`);

  const targets = pkg === "all" ? ALL : [pkg];
  const include = [];

  for (const name of targets) {
    if (!CATALOG[name]) {
      // Unknown package (e.g. a library release tag) — skip silently.
      console.error(`plan-docker-images: skipping non-docker package "${name}"`);
      continue;
    }
    if (mode === "dev") {
      include.push(entry(name, "dev", devTags(name, sha)));
    } else {
      const v = version || readVersion(CATALOG[name].versionFile);
      const latest = shouldUpdateLatest(name, v, updateLatest);
      include.push(entry(name, "tagged", taggedTags(name, v, latest)));
    }
  }

  return { include };
}

const matrix = plan();
const any = matrix.include.length > 0;

console.error("=== Docker image plan ===");
for (const e of matrix.include) {
  console.error(`- ${e.name} [${e.mode}] (context=${e.context}, dockerfile=${e.dockerfile})`);
  for (const t of e.tags.split("\n")) console.error(`    ${t}`);
}
if (!any) console.error("(no images to build for this trigger)");

const out = env.GITHUB_OUTPUT;
if (out) {
  appendFileSync(out, `matrix=${JSON.stringify(matrix)}\n`);
  appendFileSync(out, `any=${any}\n`);
}

console.log(JSON.stringify(matrix));

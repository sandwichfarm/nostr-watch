export * from "./relay-urls.js";
import relayUrls from "./relay-urls.js";

/**
 * Current version of @nostrwatch/nostrings. MUST be kept in sync with
 * package.json on every release. Consumers (notably apps/relaymon) use
 * this to version-gate retroactive sanitization sweeps — bumping this
 * constant triggers a one-shot re-evaluation of every row in the
 * consumer database under the new rules. If you change sanitization
 * logic, bump package.json AND this constant in the same PR.
 */
export const VERSION = "0.6.0";

export default {
  sanitize: { relayUrls }
}
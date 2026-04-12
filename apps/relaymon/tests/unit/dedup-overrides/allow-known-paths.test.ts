import { assert, assertEquals } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { rule } from "../../../src/utils/dedup-overrides/allow-known-paths.ts";

Deno.test("allow-known-paths: rule metadata", () => {
  assertEquals(rule.name, "allow-known-paths");
  assertEquals(rule.action, "allow");
  assertEquals(rule.reason, "known-good path");
});

Deno.test("allow-known-paths: matches /inbox exactly", () => {
  assert(rule.test(new URL("wss://haven.nostrfreedom.net/inbox")));
});

Deno.test("allow-known-paths: matches /inbox/ with trailing slash", () => {
  assert(rule.test(new URL("wss://haven.nostrfreedom.net/inbox/")));
});

Deno.test("allow-known-paths: matches /outbox exactly", () => {
  assert(rule.test(new URL("wss://haven.nostrfreedom.net/outbox")));
});

Deno.test("allow-known-paths: matches /outbox/ with trailing slash", () => {
  assert(rule.test(new URL("wss://haven.nostrfreedom.net/outbox/")));
});

Deno.test("allow-known-paths: does NOT match /inbox/<mutation>", () => {
  assertEquals(rule.test(new URL("wss://haven.nostrfreedom.net/inbox/flint-november")), false);
});

Deno.test("allow-known-paths: does NOT match /outbox/<mutation>", () => {
  assertEquals(rule.test(new URL("wss://haven.nostrfreedom.net/outbox/anchor")), false);
});

Deno.test("allow-known-paths: does NOT match root /", () => {
  assertEquals(rule.test(new URL("wss://haven.nostrfreedom.net/")), false);
});

Deno.test("allow-known-paths: does NOT match unrelated /foo", () => {
  assertEquals(rule.test(new URL("wss://haven.nostrfreedom.net/foo")), false);
});

Deno.test("allow-known-paths: case-sensitive — /INBOX does NOT match", () => {
  assertEquals(rule.test(new URL("wss://haven.nostrfreedom.net/INBOX")), false);
});

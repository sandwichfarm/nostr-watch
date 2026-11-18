import { assertEquals, assertRejects } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { assertPublicTarget, LocalTargetError } from "../../src/utils/targetGuard.ts";

const resolver = (map: Record<string, string[]>) => {
  const calls: string[] = [];
  const resolve = (hostname: string) => {
    calls.push(hostname);
    if (!(hostname in map)) return Promise.reject(new Error("ENOTFOUND"));
    return Promise.resolve(map[hostname]);
  };
  return { resolve, calls };
};

Deno.test("rejects literal local targets without resolving", async () => {
  const { resolve, calls } = resolver({});
  for (const url of [
    "ws://127.0.0.1:6379",
    "ws://0.0.0.0:6379",
    "ws://169.254.169.254",
    "ws://100.64.0.1",
    "ws://[::1]:6379",
    "ws://host.docker.internal:5432",
    "ws://metadata.google.internal",
    "ws://router.lan",
    "not a url",
  ]) {
    await assertRejects(() => assertPublicTarget(url, resolve), LocalTargetError);
  }
  assertEquals(calls, []);
});

Deno.test("rejects public names that resolve to local addresses", async () => {
  const { resolve } = resolver({
    "rebind.example.org": ["127.0.0.1"],
    "meta.example.org": ["169.254.169.254"],
    "mixed.example.org": ["93.184.216.34", "10.0.0.7"],
    "v6.example.org": ["fd00::1"],
    "mapped.example.org": ["::ffff:192.168.1.5"],
    "kubernetes.default.svc": ["10.96.0.1"],
  });
  for (const host of [
    "rebind.example.org",
    "meta.example.org",
    "mixed.example.org",
    "v6.example.org",
    "mapped.example.org",
    "kubernetes.default.svc",
  ]) {
    await assertRejects(() => assertPublicTarget(`wss://${host}/`, resolve), LocalTargetError, "resolves to local address");
  }
});

Deno.test("allows public targets and unresolvable names", async () => {
  const { resolve } = resolver({ "relay.example.org": ["93.184.216.34", "2606:2800:220:1::1"] });
  await assertPublicTarget("wss://relay.example.org/path", resolve);
  await assertPublicTarget("wss://8.8.8.8", resolve);
  await assertPublicTarget("wss://nxdomain.example.org", resolve);
});

Deno.test("does not resolve or reject overlay networks", async () => {
  const { resolve, calls } = resolver({ "relay.fips": ["fd12:3456::1"] });
  await assertPublicTarget("ws://npub1example.fips:7777", resolve);
  await assertPublicTarget("ws://relay.fips", resolve);
  await assertPublicTarget("ws://exampleonionaddress.onion", resolve);
  await assertPublicTarget("ws://example.i2p", resolve);
  assertEquals(calls, []);
});

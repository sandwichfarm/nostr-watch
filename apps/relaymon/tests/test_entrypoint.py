"""Exercise the real shell launcher without Docker, live proxies, or Deno."""

import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import unittest


ENTRYPOINT = Path(__file__).resolve().parents[1] / ".docker/scripts/entrypoint.sh"


class EntrypointTests(unittest.TestCase):
    def run_entrypoint(self, scenario="ready", verify="false", require="false", args=(), mode="multinet", overrides=None):
        with tempfile.TemporaryDirectory(prefix="relaymon-entrypoint-") as directory:
            root = Path(directory)
            bindir = root / "bin"
            bindir.mkdir()
            (root / "app").mkdir()
            # Redirect the image's fixed working directory without adding a production override.
            (root / "bash-env").write_text('''cd() {
  if [[ "$1" == /app/nostr-watch/apps/relaymon ]]; then
    builtin cd "$ENTRYPOINT_TEST_ROOT/app"
  else
    builtin cd "$@"
  fi
}
''')
            shim = '''#!/usr/bin/env python3
import json, os, pathlib, signal, sys, time
root = pathlib.Path(os.environ['ENTRYPOINT_TEST_ROOT'])
tool = pathlib.Path(sys.argv[0]).name
scenario = os.environ['ENTRYPOINT_TEST_SCENARIO']
args = sys.argv[1:]
with (root / 'calls').open('a') as log:
    log.write(json.dumps([tool, args]) + '\\n')
if scenario == 'runtime-env' and tool in ('hedproxy', 'proxychains4', 'deno'):
    assert pathlib.Path.cwd() == root / 'app', pathlib.Path.cwd()
    for name in ('http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY'):
        expected = None if os.environ['RELAYMON_MODE'] == 'multinet' else 'http://inherited-proxy.invalid:1234'
        assert os.environ.get(name) == expected, (tool, name, os.environ.get(name))
if tool == 'sleep':
    time.sleep(0.02)
elif tool in ('netstat', 'ss'):
    print('tcp 0 0 0.0.0.0:12345 0.0.0.0:* LISTEN')
elif tool == 'nc':
    if '-z' in args:
        if 'lokinet' in args: sys.exit(1)
        if scenario == 'missing-tor' and 'tor-proxy' in args: sys.exit(1)
        if scenario == 'missing-i2p' and 'i2pd' in args: sys.exit(1)
    else:
        if scenario == 'hung-sam':
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            time.sleep(60)
        print('HELLO REPLY RESULT=OK VERSION=3.1')
elif tool == 'curl':
    if scenario == 'hung-curl':
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        time.sleep(60)
elif tool == 'getent':
    print('127.0.0.2 tor-proxy')
elif tool == 'websocat':
    if scenario in ('hung-websocket', 'opt-out'):
        (root / 'websocket-pid').write_text(str(os.getpid()))
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        time.sleep(60)
    if scenario == 'failed-websocket': sys.exit(1)
elif tool == 'hedproxy':
    (root / 'hedproxy-pid').write_text(str(os.getpid()))
    time.sleep(60)
elif tool == 'proxychains4':
    assert args[:3] == ['-f', '/etc/proxychains.conf', 'deno'], args
    os.execvp('deno', ['deno', *args[3:]])
elif tool == 'deno':
    if scenario == 'missing-module' and args[0] == 'run' and '--cached-only' in args:
        sys.exit(42)
    if args[0] == 'run': (root / 'app-started').write_text(json.dumps(args))
else:
    raise AssertionError(tool)
'''
            for name in ("sleep", "netstat", "ss", "nc", "curl", "getent", "websocat", "hedproxy", "proxychains4", "deno"):
                path = bindir / name
                path.write_text(shim)
                path.chmod(0o755)
            env = dict(os.environ, PATH=f"{bindir}:{os.environ['PATH']}",
                       BASH_ENV=str(root / "bash-env"), ENTRYPOINT_TEST_ROOT=str(root),
                       ENTRYPOINT_TEST_SCENARIO=scenario, RELAYMON_MODE=mode,
                       VERIFY_CONNECTIVITY=verify, REQUIRE_NETWORK_CONNECTIVITY=require,
                       TOR_BOOTSTRAP_TIMEOUT="1", I2P_BOOTSTRAP_TIMEOUT="1",
                       NETWORK_PROBE_TIMEOUT="1", TOR_WEBSOCKET_TIMEOUT="0.5")
            env.pop("RELAYMON_CACHE_ONLY", None)
            env.update(overrides or {})
            timed_out = False
            with (root / "output").open("w") as output:
                process = subprocess.Popen(["bash", str(ENTRYPOINT), *args], env=env,
                                           stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
                try:
                    try:
                        process.wait(timeout=8)
                    except subprocess.TimeoutExpired:
                        timed_out = True
                    alive = {}
                    for name in ("hedproxy", "websocket"):
                        pidfile = root / f"{name}-pid"
                        if pidfile.exists():
                            try:
                                os.kill(int(pidfile.read_text()), 0)
                                alive[name] = True
                            except ProcessLookupError:
                                alive[name] = False
                finally:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
            calls = [json.loads(line) for line in (root / "calls").read_text().splitlines()] if (root / "calls").exists() else []
            started = json.loads((root / "app-started").read_text()) if (root / "app-started").exists() else None
            return process.returncode, timed_out, calls, started, alive, (root / "output").read_text()

    def test_opt_out_skips_external_probes_and_starts_wrapped_app(self):
        code, timed_out, calls, started, _, output = self.run_entrypoint("opt-out", args=("--label", "two words"))
        self.assertFalse(timed_out, output)
        self.assertEqual(code, 0, output)
        self.assertIsNotNone(started, output)
        self.assertEqual(started[-2:], ["--label", "two words"])
        self.assertFalse(any(tool in ("curl", "websocat") for tool, _ in calls), calls)
        self.assertTrue(any(tool == "proxychains4" for tool, _ in calls), calls)

    def test_explicit_verification_overrides_opt_out(self):
        code, timed_out, calls, started, alive, output = self.run_entrypoint(args=("--verify-network",))
        self.assertFalse(timed_out, output)
        self.assertEqual(code, 0, output)
        self.assertIsNone(started)
        self.assertTrue(any(tool == "websocat" for tool, _ in calls), calls)
        self.assertFalse(alive.get("hedproxy", False), output)

    def test_dependency_cache_uses_application_import_resolution(self):
        code, timed_out, calls, started, _, output = self.run_entrypoint()
        self.assertFalse(timed_out, output)
        self.assertEqual(code, 0, output)
        cache = [args for tool, args in calls if tool == "deno" and args[0] == "cache"]
        self.assertEqual(len(cache), 1, calls)
        self.assertIn("--unstable-sloppy-imports", started)
        self.assertIn("--unstable-sloppy-imports", cache[0])

    def test_cache_only_starts_both_modes_without_precaching(self):
        for mode in ("clearnet", "multinet"):
            with self.subTest(mode=mode):
                code, timed_out, calls, started, _, output = self.run_entrypoint(
                    mode=mode, args=("--label", "two words"), overrides={"RELAYMON_CACHE_ONLY": "true"})
                self.assertFalse(timed_out, output)
                self.assertEqual(code, 0, output)
                flags = (["--allow-all", "--unstable-sloppy-imports"] if mode == "clearnet"
                         else ["--unstable-sloppy-imports", "--allow-all"])
                self.assertEqual(started, ["run", "--cached-only", "--no-lock", "--env-file=/app/.env",
                                           *flags, "index.ts", "-c", "/opt/config.yaml", "--label", "two words"])
                self.assertFalse(any(tool == "deno" and args[0] == "cache" for tool, args in calls), calls)
                self.assertEqual(any(tool == "proxychains4" for tool, _ in calls), mode == "multinet")

    def test_cache_only_unset_or_false_preserves_launch_and_cache_arguments(self):
        for mode in ("clearnet", "multinet"):
            for value in (None, "false"):
                with self.subTest(mode=mode, value=value):
                    overrides = {} if value is None else {"RELAYMON_CACHE_ONLY": value}
                    code, timed_out, calls, started, _, output = self.run_entrypoint(mode=mode, overrides=overrides)
                    self.assertFalse(timed_out, output)
                    self.assertEqual(code, 0, output)
                    flags = (["--allow-all", "--unstable-sloppy-imports"] if mode == "clearnet"
                             else ["--unstable-sloppy-imports", "--allow-all"])
                    self.assertEqual(started, ["run", "--no-lock", "--env-file=/app/.env", *flags,
                                               "index.ts", "-c", "/opt/config.yaml"])
                    cache = [args for tool, args in calls if tool == "deno" and args[0] == "cache"]
                    self.assertEqual(cache, [["cache", "--no-lock", "--unstable-sloppy-imports", "index.ts"]]
                                     if mode == "multinet" else [])

    def test_invalid_cache_only_fails_before_external_commands(self):
        for mode in ("clearnet", "multinet"):
            for value in ("", "TRUE", "1", "true --reload"):
                with self.subTest(mode=mode, value=value):
                    code, timed_out, calls, started, _, output = self.run_entrypoint(
                        mode=mode, overrides={"RELAYMON_CACHE_ONLY": value})
                    self.assertFalse(timed_out, output)
                    self.assertNotEqual(code, 0, output)
                    self.assertIsNone(started)
                    self.assertEqual(calls, [])
                    self.assertIn("RELAYMON_CACHE_ONLY must be true or false", output)

    def test_cache_policy_preserves_runtime_directory_and_proxy_environment(self):
        for mode in ("clearnet", "multinet"):
            for value in (None, "false", "true"):
                with self.subTest(mode=mode, value=value):
                    overrides = {name: "http://inherited-proxy.invalid:1234" for name in
                                 ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY")}
                    if value is not None:
                        overrides["RELAYMON_CACHE_ONLY"] = value
                    code, timed_out, calls, started, _, output = self.run_entrypoint(
                        "runtime-env", mode=mode, overrides=overrides)
                    self.assertFalse(timed_out, output)
                    self.assertEqual(code, 0, output)
                    self.assertIsNotNone(started, output)
                    cache = [args for tool, args in calls if tool == "deno" and args[0] == "cache"]
                    self.assertEqual(len(cache), int(mode == "multinet" and value != "true"), calls)

    def test_verification_never_invokes_deno_with_any_cache_policy(self):
        for value in (None, "false", "true"):
            with self.subTest(value=value):
                overrides = {} if value is None else {"RELAYMON_CACHE_ONLY": value}
                code, timed_out, calls, started, alive, output = self.run_entrypoint(
                    args=("--verify-network",), overrides=overrides)
                self.assertFalse(timed_out, output)
                self.assertEqual(code, 0, output)
                self.assertIsNone(started)
                self.assertFalse(any(tool == "deno" for tool, _ in calls), calls)
                self.assertTrue(any(tool == "websocat" for tool, _ in calls), calls)
                self.assertFalse(alive.get("hedproxy", False), output)

    def test_cache_only_propagates_module_resolution_failure_without_retry(self):
        for mode in ("clearnet", "multinet"):
            with self.subTest(mode=mode):
                code, timed_out, calls, started, _, output = self.run_entrypoint(
                    "missing-module", mode=mode, overrides={"RELAYMON_CACHE_ONLY": "true"})
                self.assertFalse(timed_out, output)
                self.assertEqual(code, 42, output)
                self.assertIsNone(started)
                deno_calls = [args for tool, args in calls if tool == "deno"]
                self.assertEqual(len(deno_calls), 1, calls)
                self.assertEqual(deno_calls[0][:2], ["run", "--cached-only"])

    def test_failed_websocket_verification_fails_and_cleans_up(self):
        code, timed_out, _, started, alive, output = self.run_entrypoint("failed-websocket", args=("--verify-network",))
        self.assertFalse(timed_out, output)
        self.assertNotEqual(code, 0, output)
        self.assertIsNone(started)
        self.assertFalse(alive.get("hedproxy", False), output)

    def test_hung_websocket_is_killed_and_required_startup_fails(self):
        code, timed_out, _, started, alive, output = self.run_entrypoint("hung-websocket", verify="true", require="true")
        self.assertFalse(timed_out, output)
        self.assertNotEqual(code, 0, output)
        self.assertIsNone(started)
        self.assertFalse(alive.get("hedproxy", False), output)
        self.assertFalse(alive.get("websocket", False), output)

    def test_required_bootstrap_probes_have_deadlines(self):
        for scenario in ("missing-tor", "missing-i2p", "hung-curl", "hung-sam"):
            with self.subTest(scenario=scenario):
                code, timed_out, _, started, _, output = self.run_entrypoint(scenario, verify="true", require="true")
                self.assertFalse(timed_out, output)
                self.assertNotEqual(code, 0, output)
                self.assertIsNone(started)

    def test_optional_missing_proxy_does_not_block_app_forever(self):
        code, timed_out, _, started, _, output = self.run_entrypoint("missing-tor")
        self.assertFalse(timed_out, output)
        self.assertEqual(code, 0, output)
        self.assertIsNotNone(started)

    def test_optional_failed_verification_still_starts_the_app(self):
        code, timed_out, _, started, _, output = self.run_entrypoint("failed-websocket", verify="true")
        self.assertFalse(timed_out, output)
        self.assertEqual(code, 0, output)
        self.assertIsNotNone(started)

    def test_invalid_timeouts_cannot_disable_deadlines(self):
        for setting, value in (("TOR_BOOTSTRAP_TIMEOUT", "invalid"),
                               ("I2P_BOOTSTRAP_TIMEOUT", "0"),
                               ("NETWORK_PROBE_TIMEOUT", "0"),
                               ("TOR_WEBSOCKET_TIMEOUT", "0.0")):
            with self.subTest(setting=setting):
                code, timed_out, _, started, _, output = self.run_entrypoint(overrides={setting: value})
                self.assertFalse(timed_out, output)
                self.assertNotEqual(code, 0, output)
                self.assertIsNone(started)
                self.assertIn(setting, output)

    def test_clearnet_start_preserves_arguments_without_proxy(self):
        code, timed_out, calls, started, _, output = self.run_entrypoint(mode="clearnet", args=("--label", "two words"))
        self.assertFalse(timed_out, output)
        self.assertEqual(code, 0, output)
        self.assertEqual(started[-2:], ["--label", "two words"])
        self.assertFalse(any(tool == "proxychains4" for tool, _ in calls))

    def test_clearnet_verification_does_not_launch_the_app(self):
        code, timed_out, _, started, _, output = self.run_entrypoint(mode="clearnet", args=("--verify-network",))
        self.assertFalse(timed_out, output)
        self.assertNotEqual(code, 0, output)
        self.assertIsNone(started)


if __name__ == "__main__":
    unittest.main()

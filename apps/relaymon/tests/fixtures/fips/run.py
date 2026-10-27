#!/usr/bin/env python3
"""Run an isolated two-node FIPS monitoring fixture; remove it on exit."""
import argparse
import json
import os
import signal
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[5]
parser = argparse.ArgumentParser()
parser.add_argument('--image', default='nostr-watch-fips-fixture:local')
parser.add_argument('--output', type=Path)
args = parser.parse_args()
os.umask(0o077)


def interrupted(signum, frame):
    raise SystemExit(128 + signum)


signal.signal(signal.SIGTERM, interrupted)


def run(*command, timeout=60):
    return subprocess.run(command, cwd=ROOT, text=True, capture_output=True,
                          check=True, timeout=timeout).stdout.strip()


# Ephemeral identities, never printed or written into the repository.
identities = json.loads(run('node', '--input-type=module', '-e', '''
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
console.log(JSON.stringify([0, 1].map(() => {
  const secret = generateSecretKey();
  return { nsec: nip19.nsecEncode(secret), npub: nip19.npubEncode(getPublicKey(secret)) };
})));'''))
prefix = 'nw-fips-' + uuid.uuid4().hex[:10]
network = prefix + '-net'
containers = []
created_network = False
proof = {}
try:
    run('docker', 'network', 'create', '--internal', '--subnet', '10.254.239.0/29', network)
    created_network = True
    with tempfile.TemporaryDirectory(prefix=prefix) as directory:
        resolver = Path(directory) / 'resolv.conf'
        resolver.write_text('nameserver 127.0.0.1\noptions timeout:1 attempts:1\n')
        for index, role in enumerate(['monitor', 'relay']):
            peer = 1 - index
            peer_role = ['monitor', 'relay'][peer]
            config = Path(directory) / (role + '.yaml')
            config.write_text(f'''node:
  identity:
    nsec: "{identities[index]['nsec']}"
  rendezvous:
    nostr:
      enabled: false
    lan:
      enabled: false
tun:
  enabled: true
  name: fips0
  mtu: 1280
dns:
  enabled: true
  bind_addr: "127.0.0.1"
  port: 53
transports:
  udp:
    bind_addr: "0.0.0.0:2121"
    mtu: 1472
peers:
  - npub: "{identities[peer]['npub']}"
    alias: "{peer_role}"
    addresses:
      - transport: udp
        addr: "10.254.239.{peer + 2}:2121"
    connect_policy: auto_connect
''')
            name = prefix + '-' + role
            run('docker', 'run', '-d', '--name', name, '--network', network,
                '--ip', f'10.254.239.{index + 2}', '--cap-drop', 'ALL',
                '--cap-add', 'NET_ADMIN', '--cap-add', 'NET_BIND_SERVICE',
                '--device', '/dev/net/tun', '--security-opt', 'no-new-privileges',
                '--sysctl', 'net.ipv6.conf.all.disable_ipv6=0', '--pids-limit', '128',
                '--memory', '512m', '--read-only', '--tmpfs', '/tmp', '--tmpfs', '/run',
                '--mount', f'type=bind,source={config},target=/fixture/node.yaml,readonly',
                '--mount', f'type=bind,source={resolver},target=/etc/resolv.conf,readonly',
                '-e', f'ROLE={role}', '-e', f'PEER_IP=10.254.239.{peer + 2}',
                '-e', f"FIPS_RELAY_NPUB={identities[1]['npub']}", args.image)
            containers.append(name)

        command = ['deno', 'run', '--cached-only', '--no-lock', '--no-check',
                   '--unstable-sloppy-imports', '--allow-all', 'tests/fixtures/fips/probe.ts']
        deadline = time.monotonic() + 60
        while True:
            try:
                output = run('docker', 'exec', containers[0], *command, timeout=20)
                line = next(line for line in output.splitlines() if line.startswith('FIPS_MONITOR_PROOF '))
                proof['monitor'] = json.loads(line.split(' ', 1)[1])
                break
            except (subprocess.SubprocessError, StopIteration):
                for name in containers:
                    running = run('docker', 'inspect', '--format', '{{.State.Running}}', name)
                    if running != 'true':
                        raise RuntimeError(f'Fixture container stopped: {name}')
                if time.monotonic() >= deadline:
                    raise
                time.sleep(1)

        # Run the actual Trawler entrypoint with only an alias seed. The
        # npub-based address must arrive over a relay-list subscription, be
        # persisted as FIPS, and be crawled on a subsequent queue cycle.
        output = run('docker', 'exec', '-w', '/workspace/apps/trawler', containers[0],
                     'deno', 'run', '--cached-only', '--no-lock', '--no-check',
                     '--unstable-sloppy-imports', '--allow-all',
                     'tests/fixtures/fips-discovery.ts', timeout=180)
        line = next(line for line in output.splitlines() if line.startswith('FIPS_DISCOVERY_PROOF '))
        proof['discovery'] = json.loads(line.split(' ', 1)[1])

        output = run('docker', 'exec', containers[1], *command, 'ingress', timeout=10)
        line = next(line for line in output.splitlines() if line.startswith('FIPS_INGRESS_PROOF '))
        proof['ingress'] = json.loads(line.split(' ', 1)[1])
        rules = run('docker', 'exec', containers[0], 'ip6tables', '-L', 'INPUT', '-nv')
        # Require packets to have hit the default DROP policy; absence of a
        # successful connection alone would not prove the ingress test ran.
        import re
        dropped = re.search(r'^\s*(\d+)\s+\S+\s+DROP\s+.*tcp dpt:7778', rules, re.MULTILINE)
        if not dropped or int(dropped.group(1)) < 1:
            raise RuntimeError('No denied ingress packets reached monitor firewall')
        proof['ingress']['monitorDroppedPackets'] = int(dropped.group(1))
        state = json.loads(run('docker', 'inspect', *containers))
        for container in state:
            if container['HostConfig']['NetworkMode'] == 'host' or container['HostConfig']['PortBindings']:
                raise RuntimeError('Fixture exposed host networking or published ports')
        proof['isolation'] = {'internalDockerNetwork': True, 'publishedPorts': [],
                              'hostNetworking': False, 'publicDiscovery': False}
        proof['fipsVersion'] = run('docker', 'exec', containers[0], 'fips', '--version')
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(proof, indent=2) + '\n')
        print(json.dumps(proof, indent=2))
except Exception as error:
    if isinstance(error, subprocess.CalledProcessError):
        print(error.stdout[-6000:])
        print(error.stderr[-6000:])
    for name in containers:
        subprocess.run(['docker', 'logs', '--tail', '15', name], check=False)
        subprocess.run(['docker', 'exec', name, 'tail', '-15', '/tmp/fips.log'], check=False)
    raise
finally:
    for name in containers:
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True, check=False)
    if created_network:
        subprocess.run(['docker', 'network', 'rm', network], capture_output=True, check=False)

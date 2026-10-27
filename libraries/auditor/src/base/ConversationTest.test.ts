import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UniversalWebSocket } from '@nostrwatch/websocket';
import type { ISuite } from './Suite.js';
import { Suite } from './Suite.js';
import { SuiteTest } from './SuiteTest.js';
import { SuiteState } from './SuiteState.js';
import { Emitter } from './Emitter.js';
import { ConversationTest } from './ConversationTest.js';

class Socket {
  CONNECTED = true;
  listeners = new Map<string, Set<Function>>();
  connect = vi.fn(async () => true);
  terminate = vi.fn(() => { this.CONNECTED = false; });
  send = vi.fn();
  fork = vi.fn(() => new Socket());
  on(key: string, listener: Function) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(listener);
  }
  off(key: string, listener: Function) { this.listeners.get(key)?.delete(listener); }
}

function suite(socket = new Socket()): ISuite {
  return { socket, state: new SuiteState(), reset: vi.fn(), testKey: 'unset' } as unknown as ISuite;
}

class Probe extends ConversationTest {
  readonly slug = 'Probe';
  action: (test: Probe) => Promise<void> = async () => this.pass();
  timeoutMs = 25;
  execute() { return this.action(this); }
  open(url?: string) { return this.openSession(url); }
  pass() { this.expect.behavior.toBeOk(true, 'observable assertion'); }
  fail() { this.expect.behavior.toBeOk(false, 'observable failure'); }
  skipped() { this.skip('Prerequisite unavailable'); }
}

afterEach(() => Emitter.removeAllListeners('all:abort'));

describe('ConversationTest', () => {
  it('owns independent sockets and disposes every connection after success', async () => {
    const owner = suite();
    const probe = new Probe(owner);
    let first: Awaited<ReturnType<Probe['open']>>;
    let second: typeof first;
    probe.action = async test => {
      first = await test.open();
      second = await test.open('wss://relay.example/child');
      test.pass();
    };
    await probe.run();
    expect(owner.socket.fork).toHaveBeenNthCalledWith(2, 'wss://relay.example/child');
    expect(first.socket).not.toBe(second.socket);
    expect(first.socket.terminate).toHaveBeenCalledOnce();
    expect(second.socket.terminate).toHaveBeenCalledOnce();
    expect(owner.socket.terminate).not.toHaveBeenCalled();
    expect(probe.resulter.result.pass).toBe(true);
    expect(Emitter.listenerCount('all:abort')).toBe(0);
  });

  it('records execution errors and cleans up sockets', async () => {
    const probe = new Probe(suite());
    let session: Awaited<ReturnType<Probe['open']>>;
    probe.action = async test => { session = await test.open(); throw new Error('broken exchange'); };
    await probe.run();
    expect(probe.resulter.result.failed[0].message).toContain('broken exchange');
    expect(session.socket.terminate).toHaveBeenCalledOnce();
  });

  it('bounds a hung conversation and settles pending waits', async () => {
    const probe = new Probe(suite());
    probe.action = async test => { const session = await test.open(); await session.waitFor(() => false); };
    await probe.run();
    expect(probe.resulter.result.pass).toBe(false);
    expect(probe.resulter.result.failed[0].message).toContain('timed out');
  });

  it('responds to global abort while an asynchronous exchange is pending', async () => {
    const probe = new Probe(suite());
    probe.action = async test => { const session = await test.open(); await session.waitFor(() => false); };
    const running = probe.run();
    Emitter.emit('all:abort');
    await running;
    expect(probe.resulter.result.failed[0].message).toContain('aborted');
  });

  it('does not let a skipped prerequisite mask a later failure', async () => {
    const probe = new Probe(suite());
    probe.action = async test => { test.skipped(); test.fail(); };
    await probe.run();
    expect(probe.resulter.result.pass).toBe(false);
    expect(probe.resulter.result.skipped).toHaveLength(1);
    expect(probe.resulter.result.failed).toHaveLength(1);
  });

  it('does not pass a skipped-only or assertion-free probe', async () => {
    const probe = new Probe(suite());
    probe.action = async test => test.skipped();
    await probe.run();
    expect(probe.resulter.result.pass).toBe(false);
    expect(probe.resulter.result.skipped).toHaveLength(1);
    probe.action = async () => {};
    await probe.run();
    expect(probe.resulter.result.pass).toBe(false);
    expect(probe.resulter.result.failed[0].message).toContain('without assertions');
    expect(probe.resulter.result.skipped).toHaveLength(0);
  });

  it('resets previous assertions when rerun', async () => {
    const probe = new Probe(suite());
    probe.action = async test => test.fail();
    await probe.run();
    probe.action = async test => test.pass();
    await probe.run();
    expect(probe.resulter.result.pass).toBe(true);
    expect(probe.resulter.result.failed).toHaveLength(0);
    expect(probe.resulter.result.passed).toHaveLength(1);
  });
});

describe('Suite sampling prerequisites', () => {
  it('runs independent probes even if the suite sampler obtained no events', async () => {
    class EmptySuite extends Suite {
      get slug() { return 'Empty'; }
      async setup() {}
      async ready() {}
      setTests(tests: Record<string, SuiteTest>) { this.testers = tests; }
    }
    class Dependent extends SuiteTest {
      readonly slug = 'Dependent';
      protected requiresSuiteSamples = true;
    }
    const socket = new Socket();
    const owner = new EmptySuite(socket as unknown as UniversalWebSocket, 'file:///suite');
    const sample = vi.fn(async () => true);
    (owner as any)._sampler = { samplable: true, sample, ingestors: [] };
    const independent = new Probe(owner);
    const dependent = new Dependent(owner);
    owner.setTests({ Dependent: dependent, Probe: independent });
    const result = await owner.test();
    expect(sample).toHaveBeenCalledOnce();
    expect(result.tests.Dependent.skipped).toHaveLength(1);
    expect(result.tests.Dependent.pass).toBe(false);
    expect(result.tests.Probe.passed).toHaveLength(1);
    expect(result.tests.Probe.pass).toBe(true);
    expect(result.pass).toBe(true);
    expect(result.incomplete).toBe(true);
    expect(result.skipped).toBe(false);
  });

  it('keeps an all-skipped suite inconclusive and a real failed assertion failing', async () => {
    class TestSuite extends Suite {
      get slug() { return 'TestSuite'; }
      async setup() {}
      async ready() {}
      setTests(tests: Record<string, SuiteTest>) { this.testers = tests; }
    }
    const owner = new TestSuite(new Socket() as unknown as UniversalWebSocket, 'file:///suite');
    const unavailable = new Probe(owner);
    unavailable.action = async test => test.skipped();
    owner.setTests({ Probe: unavailable });
    const skipped = await owner.test();
    expect(skipped.pass).toBe(false);
    expect(skipped.skipped).toBe(true);
    expect(skipped.incomplete).toBe(true);
    unavailable.action = async test => { test.skipped(); test.fail(); };
    const failed = await owner.test();
    expect(failed.pass).toBe(false);
    expect(failed.skipped).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UniversalWebSocket } from '@nostrwatch/websocket';
import type { ISuite } from './Suite.js';
import { SuiteTest } from './SuiteTest.js';
import { SuiteState } from './SuiteState.js';
import { Emitter } from './Emitter.js';

class Socket {
  CONNECTED = false;
  listeners = new Map<string, Set<Function>>();
  connect = vi.fn(async () => { this.CONNECTED = true; return true; });
  terminate = vi.fn(() => { this.CONNECTED = false; this.emit('close', {}); });
  send = vi.fn();
  on(key: string, listener: Function) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(listener);
  }
  off(key?: string, listener?: Function) {
    if (!key) this.listeners.clear();
    else if (!listener) this.listeners.delete(key);
    else this.listeners.get(key)?.delete(listener);
  }
  emit(key: string, event: any) { for (const listener of [...(this.listeners.get(key) ?? [])]) listener(event); }
}

function owner(socket = new Socket(), requires = ['websocket']): ISuite {
  return { socket, requires, state: new SuiteState(), reset: vi.fn(), setupHandlers: vi.fn(() => socket.off()), testKey: 'unset' } as unknown as ISuite;
}

class DelayedResponse extends SuiteTest {
  readonly slug = 'DelayedResponse';
  protected timeoutMs = 500;
  async prepare() {
    this.socket.on('message', () => {
      this.expect.behavior.toBeOk(true, 'assertion from delayed response');
      this.conclude();
    });
    this.socket.send('request');
  }
}

afterEach(() => Emitter.removeAllListeners('all:abort'));

describe('legacy SuiteTest completion', () => {
  it('blocks delayed request/publish/close callbacks after a test is aborted', async () => {
    const socket = new Socket();
    const test = new DelayedResponse(owner(socket));
    const running = test.run();
    await new Promise(resolve => setTimeout(resolve, 1));
    Emitter.emit('all:abort');
    await running;
    socket.send.mockClear();
    test.REQ([{ limit: 1 }]);
    test.EVENT({} as any);
    test.CLOSE();
    expect(socket.send).not.toHaveBeenCalled();
  });
  it('waits for the response when a custom prepare returns immediately', async () => {
    const socket = new Socket();
    const test = new DelayedResponse(owner(socket));
    let finished = false;
    const running = test.run().then(() => { finished = true; });
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(socket.send).toHaveBeenCalledWith('request');
    expect(finished).toBe(false);
    socket.emit('message', { data: '["EOSE","subscription"]' });
    await running;
    expect(test.resulter.result.pass).toBe(true);
    expect(test.resulter.result.passed[0].message).toBe('assertion from delayed response');
    expect(Emitter.listenerCount('all:abort')).toBe(0);
    expect(socket.listeners.size).toBe(0);
    expect(socket.terminate).toHaveBeenCalledOnce();
  });

  it('does not pass silence or leave a pending completion timer', async () => {
    const socket = new Socket();
    const test = new DelayedResponse(owner(socket));
    (test as any).timeoutMs = 5;
    await test.run();
    expect(test.resulter.result.pass).toBe(false);
    expect(test.resulter.result.failed.some(result => result.message.includes('timed out'))).toBe(true);
    expect(socket.CONNECTED).toBe(false);
    expect(socket.listeners.size).toBe(0);
    expect(Emitter.listenerCount('all:abort')).toBe(0);
  });

  it('preserves default request-to-EOSE completion without socket polling', async () => {
    class DefaultRequest extends SuiteTest {
      readonly slug = 'DefaultRequest';
      test() { this.expect.behavior.toBeOk(true, 'default EOSE path'); }
    }
    const socket = new Socket();
    const suite = owner(socket);
    const test = new DefaultRequest(suite);
    (suite.setupHandlers as ReturnType<typeof vi.fn>).mockImplementation(() => {
      socket.off();
      socket.on('message', () => test._onMessageEose());
    });
    socket.send.mockImplementation(() => queueMicrotask(() => socket.emit('message', {})));
    await test.run();
    expect(test.resulter.result.pass).toBe(true);
    expect(test.resulter.result.passed[0].message).toBe('default EOSE path');
    expect(socket.terminate).toHaveBeenCalledOnce();
    expect(socket.listeners.size).toBe(0);
  });

  it('fails an unsuccessful connection before calling prepare', async () => {
    const socket = new Socket();
    socket.connect.mockImplementation(async () => false);
    const test = new DelayedResponse(owner(socket));
    await test.run();
    expect(test.resulter.result.pass).toBe(false);
    expect(test.resulter.result.failed[0].message).toContain('Could not connect');
    expect(socket.send).not.toHaveBeenCalled();
    expect(socket.listeners.size).toBe(0);
  });

  it.each(['close', 'error'])('settles a premature transport %s as failure', async type => {
    const socket = new Socket();
    const test = new DelayedResponse(owner(socket));
    const running = test.run();
    await new Promise(resolve => setTimeout(resolve, 1));
    socket.emit(type, {});
    await running;
    expect(test.resulter.result.pass).toBe(false);
    expect(test.resulter.result.failed[0].message).toContain(type);
    expect(socket.listeners.size).toBe(0);
  });

  it('settles global abort and leaves the next test on the reused socket alone', async () => {
    const socket = new Socket();
    const first = new DelayedResponse(owner(socket));
    const running = first.run();
    await new Promise(resolve => setTimeout(resolve, 1));
    Emitter.emit('all:abort');
    await running;
    expect(first.resulter.result.failed[0].message).toContain('aborted');
    expect(Emitter.listenerCount('all:abort')).toBe(0);
    const second = new DelayedResponse(owner(socket));
    const next = second.run();
    await new Promise(resolve => setTimeout(resolve, 1));
    socket.emit('message', { data: 'response for next test' });
    await next;
    expect(second.resulter.result.pass).toBe(true);
    expect(first.resulter.result.pass).toBe(false);
  });

  it('cleans up if custom prepare throws', async () => {
    class Throwing extends DelayedResponse {
      async prepare() { throw new Error('prepare broke'); }
    }
    const socket = new Socket();
    const test = new Throwing(owner(socket));
    await test.run();
    expect(test.resulter.result.pass).toBe(false);
    expect(test.resulter.result.failed[0].message).toContain('prepare broke');
    expect(socket.listeners.size).toBe(0);
    expect(Emitter.listenerCount('all:abort')).toBe(0);
  });

  it('does not reconnect or prepare after an abort while sampling', async () => {
    const socket = new Socket();
    const test = new DelayedResponse(owner(socket));
    let finishSample: () => void;
    const sampling = new Promise<void>(resolve => { finishSample = resolve; });
    (test as any).sampler = { samplable: true, sample: vi.fn(() => sampling) };
    const prepare = vi.spyOn(test, 'prepare');
    const running = test.run();
    Emitter.emit('all:abort');
    finishSample();
    await running;
    expect(socket.connect).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(socket.CONNECTED).toBe(false);
    expect(socket.listeners.size).toBe(0);
    expect(Emitter.listenerCount('all:abort')).toBe(0);
    expect(test.resulter.result.failed[0].message).toContain('aborted');
  });

  it('closes a connection that completes after the test was aborted', async () => {
    const socket = new Socket();
    let finishConnection: () => void;
    const connecting = new Promise<void>(resolve => { finishConnection = resolve; });
    socket.connect.mockImplementation(async () => {
      await connecting;
      socket.CONNECTED = true;
      socket.on('message', () => {});
      return true;
    });
    const test = new DelayedResponse(owner(socket));
    const prepare = vi.spyOn(test, 'prepare');
    const running = test.run();
    expect(socket.connect).toHaveBeenCalledOnce();
    Emitter.emit('all:abort');
    finishConnection();
    await running;
    expect(prepare).not.toHaveBeenCalled();
    expect(socket.CONNECTED).toBe(false);
    expect(socket.listeners.size).toBe(0);
    expect(Emitter.listenerCount('all:abort')).toBe(0);
    expect(test.resulter.result.failed[0].message).toContain('aborted');
  });

  it('finishes a non-websocket test after its asynchronous prepare completes', async () => {
    class NoSocket extends SuiteTest {
      readonly slug = 'NoSocket';
      async prepare() {
        await Promise.resolve();
        this.expect.behavior.toBeOk(true, 'prepared without websocket');
      }
    }
    const socket = new Socket();
    const test = new NoSocket(owner(socket, []));
    await test.run();
    expect(test.resulter.result.pass).toBe(true);
    expect(socket.connect).not.toHaveBeenCalled();
    expect(Emitter.listenerCount('all:abort')).toBe(0);
  });
});

import { describe, it, expect, vi } from 'vitest';
import type { UniversalWebSocket } from '@nostrwatch/websocket';
import { MessageSession, MessageTimeoutError } from './MessageSession.js';

class Socket {
  CONNECTED = true;
  listeners = new Map<string, Set<Function>>();
  connect = vi.fn(async () => this.CONNECTED);
  terminate = vi.fn(() => { this.CONNECTED = false; this.emit('close', {}); });
  send = vi.fn();
  on(key: string, listener: Function) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(listener);
  }
  off(key: string, listener: Function) { this.listeners.get(key)?.delete(listener); }
  emit(key: string, event: any) { for (const listener of this.listeners.get(key) ?? []) listener(event); }
  receive(message: any[]) { this.emit('message', { data: JSON.stringify(message) }); }
}

function setup(timeoutMs = 25) {
  const socket = new Socket();
  const session = new MessageSession(socket as unknown as UniversalWebSocket, timeoutMs);
  return { socket, session };
}

describe('MessageSession', () => {
  it('retains immediate responses and correlates history by checkpoint', async () => {
    const { socket, session } = setup();
    await session.connect();
    socket.receive(['EOSE', 'old']);
    const after = session.messages.length;
    socket.send.mockImplementation(() => socket.receive(['EOSE', 'new']));
    session.send(['REQ', 'new', {}]);
    await expect(session.waitFor(message => message[0] === 'EOSE', { after })).resolves.toEqual(['EOSE', 'new']);
    expect(socket.send).toHaveBeenCalledWith('["REQ","new",{}]');
    session.dispose();
  });

  it('waits independently for different subscription IDs', async () => {
    const { socket, session } = setup();
    const first = session.waitFor(message => message[1] === 'one');
    const second = session.waitFor(message => message[1] === 'two');
    socket.receive(['NOTICE', 'unrelated']);
    socket.receive(['EOSE', 'two']);
    socket.receive(['EOSE', 'one']);
    await expect(first).resolves.toEqual(['EOSE', 'one']);
    await expect(second).resolves.toEqual(['EOSE', 'two']);
    session.dispose();
  });

  it('bounds silence with a distinct timeout error', async () => {
    const { session } = setup(5);
    await expect(session.waitFor(() => true)).rejects.toBeInstanceOf(MessageTimeoutError);
    session.dispose();
  });

  it.each(['not json', '{}', 'null'])('fails pending and future waits on invalid frame %s', async data => {
    const { socket, session } = setup();
    const waiting = session.waitFor(() => true);
    socket.emit('message', { data });
    await expect(waiting).rejects.toThrow('Invalid JSON message');
    await expect(session.waitFor(() => true)).rejects.toThrow('Invalid JSON message');
    session.dispose();
  });

  it.each(['close', 'error'])('fails pending waits on premature %s', async type => {
    const { socket, session } = setup();
    const waiting = session.waitFor(() => true);
    socket.emit(type, { code: 1006, reason: 'broken', message: 'broken' });
    await expect(waiting).rejects.toThrow(/Connection (closed|error)/);
    session.dispose();
  });

  it('disposes pending waits, timers, and only its own listeners', async () => {
    const { socket, session } = setup();
    const unrelated = vi.fn();
    socket.on('message', unrelated);
    const waiting = session.waitFor(() => true);
    session.dispose();
    session.dispose();
    await expect(waiting).rejects.toThrow('Conversation disposed');
    expect(socket.terminate).toHaveBeenCalledTimes(1);
    expect(socket.listeners.get('message')).toEqual(new Set([unrelated]));
    expect(socket.listeners.get('close').size).toBe(0);
    expect(socket.listeners.get('error').size).toBe(0);
    await expect(session.connect()).rejects.toThrow('Conversation disposed');
  });

  it('does not confuse predicate errors with transport errors', async () => {
    const { socket, session } = setup();
    const broken = session.waitFor(() => { throw new Error('bad predicate'); });
    socket.receive(['EOSE', 'one']);
    await expect(broken).rejects.toThrow('bad predicate');
    await expect(session.waitFor(message => message[0] === 'EOSE')).resolves.toEqual(['EOSE', 'one']);
    session.dispose();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DeferredWrapper } from './DeferredWrapper.js'
import Deferred from 'promise-deferred'
import { SessionHelper } from './SessionHelper.js'
import { TimeoutHelper } from './TimeoutHelper.js'

describe('DeferredWrapper', () => {
  const url = "wss://test.nostr.watch"
  let deferredWrapper;
  let session;
  let sessionId;
  let timeout;

  beforeEach(() => {
    session = new SessionHelper(url)
    sessionId = session.get()
    timeout = new TimeoutHelper(session)
    deferredWrapper = new DeferredWrapper(session, timeout);
  });

  it('should initialize correctly', () => {
    expect(deferredWrapper.promises).toEqual({});
    expect(deferredWrapper.timeout).toBe(timeout);
    expect(deferredWrapper.$session).toBe(session);
  });

  it('should add a new deferred promise', () => {
    const deferred = deferredWrapper.add('testKey');
    expect(typeof deferred.promise.then).toBe('function')
    expect(deferredWrapper.promises[sessionId]['testKey']).toBeInstanceOf(Deferred);
  });

  it('should resolve a promise', async () => {
    const deferred = deferredWrapper.add('testKey');
    deferredWrapper.resolve('testKey', 'testResult');
    await expect(deferred.promise).resolves.toEqual('testResult');
  });

  it('should reject a promise', async () => {
    const deferred = deferredWrapper.add('testKey');
    const testError = new Error('testError');
    deferredWrapper.reject('testKey', testError);
    await expect(deferred.promise).rejects.toThrow(testError);
  });

  it('should reflect the state of a promise', async () => {
    const promise = deferredWrapper.add('testKey');
    const { state, reflectedPromise } = deferredWrapper.reflect('testKey');
    expect(state.isPending).toBe(true);
    deferredWrapper.resolve('testKey', 'testResult');
    await expect(reflectedPromise).resolves.toEqual('testResult');
    expect(state.isFulfilled).toBe(true);
    expect(state.isPending).toBe(false);
  });

  it('should clear session promises', () => {
    deferredWrapper.add('testKey');
    deferredWrapper.clearSessionPromises();
    expect(deferredWrapper.promises[sessionId]).toBeUndefined();
  });

  it('should create a new promise', () => {
    deferredWrapper.create('testKey');
    expect(deferredWrapper.promises[sessionId]['testKey']).toBeInstanceOf(Deferred);
  });

  it('should get an existing promise', () => {
    deferredWrapper.add('testKey');
    const promise = deferredWrapper.get('testKey');
    expect(promise).toBeInstanceOf(Deferred);
  });

  it('should reset all promises', () => {
    deferredWrapper.add('testKey');
    deferredWrapper.reset();
    expect(deferredWrapper.promises).toEqual({});
  });
});

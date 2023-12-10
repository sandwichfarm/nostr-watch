import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SessionHelper } from './SessionHelper.js'
import murmurhash from 'murmurhash'
import { random } from '../utils.js'
import * as utilsModule from '../utils.js'

describe('SessionHelper', () => {
  let sessionHelper;

  beforeEach(() => {
    sessionHelper = new SessionHelper();
  });

  afterEach(() => {
  });

  it('should initialize with correct values', () => {
    expect(typeof sessionHelper.salt).toBe('number');
    expect(sessionHelper.id).toBeInstanceOf(Object);
  });

  it('keys to change ', () => { 
    const random1 = murmurhash.v3(random(50))
    const random2 = murmurhash.v3(random(50))
    const key1 = murmurhash.v3('key', random1)
    const key2 = murmurhash.v3('key', random2)
    expect(random1 === random2).toBe(false)
    expect(key1 === key2).toBe(false)
  })

  it('murmurhash behaves', () => { 
    const random1 = murmurhash.v3(random(50))
    const random2 = murmurhash.v3(random(50))
    const key1 = murmurhash.v3('key', random1)
    const key2 = murmurhash.v3('key', random2)

    console.log(key1, key2)
    expect(key1 === key2).toBe(false)
  })

  

  it('should create hash ids correctly', () => {
    const expectedSessionId = murmurhash.v3('session', sessionHelper.salt);
    const expectedConnectId = murmurhash.v3('connect', sessionHelper.salt);
    const expectedReadId = murmurhash.v3('read', sessionHelper.salt);
    const expectedWriteId = murmurhash.v3('write', sessionHelper.salt);
    const expectedInfoId = murmurhash.v3('info', sessionHelper.salt);
    const expectedGeoId = murmurhash.v3('geo', sessionHelper.salt);

    expect(sessionHelper.id.session).toEqual(expectedSessionId);
    expect(sessionHelper.id.connect).toEqual(expectedConnectId);
    expect(sessionHelper.id.read).toEqual(expectedReadId);
    expect(sessionHelper.id.write).toEqual(expectedWriteId);
    expect(sessionHelper.id.info).toEqual(expectedInfoId);
    expect(sessionHelper.id.geo).toEqual(expectedGeoId);
  });

  it('should setup new ids on new()', () => {
    const oldIds = Object.assign({}, sessionHelper.id)
    console.log(oldIds)

    sessionHelper.new(); 

    console.log(sessionHelper.new())
    
    expect(sessionHelper.id.session).not.toEqual(oldIds.session);
    expect(sessionHelper.id.connect).not.toEqual(oldIds.connect);
    expect(sessionHelper.id.read).not.toEqual(oldIds.read);
    expect(sessionHelper.id.write).not.toEqual(oldIds.write);
    expect(sessionHelper.id.info).not.toEqual(oldIds.info);
    expect(sessionHelper.id.geo).not.toEqual(oldIds.geo);
  });

  it('should return correct id for get(key)', () => {
    expect(sessionHelper.get('session')).toEqual(sessionHelper.id.session);
    expect(sessionHelper.get('connect')).toEqual(sessionHelper.id.connect);
    expect(sessionHelper.get('read')).toEqual(sessionHelper.id.read);
    expect(sessionHelper.get('write')).toEqual(sessionHelper.id.write);
    expect(sessionHelper.get('info')).toEqual(sessionHelper.id.info);
    expect(sessionHelper.get('geo')).toEqual(sessionHelper.id.geo);
  });

  it('should return session id for get() with no key', () => {
    expect(sessionHelper.get()).toEqual(sessionHelper.id.session);
  });
});

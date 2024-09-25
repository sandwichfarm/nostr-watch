import type { Table } from 'dexie';

export const hashObject = async (obj: Record<string, any>): Promise<string> => {
  const canonicalJson = JSON.stringify(obj, Object.keys(obj).sort());
  const buffer = new TextEncoder().encode(canonicalJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export const nHoursAgo = (hrs: number): number => Math.floor((Date.now() - hrs * 60 * 60 * 1000) / 1000);

export const normalizeUrl = (url: string) => {
  const parsedUrl = new URL(url);
  parsedUrl.search = '';
  parsedUrl.hash = '';
  return parsedUrl.toString();
};

export const allOf = <T>(table: Table<T, any>, multiValueProp: keyof T & string, keys: (T[keyof T & string])[]): Promise<T[]> => {
  if (keys.length === 0) return Promise.resolve([]);

  const [dbKey, ...filteredKeys] = keys;
  return table.where(multiValueProp).equals(dbKey as any).toArray().then((dbResult: T[]) =>
    filteredKeys.reduce((result: T[], key: T[keyof T & string]) =>
      result.filter((doc: T) => Array.isArray(doc[multiValueProp]) && (doc[multiValueProp] as any[]).includes(key)),
      dbResult
    )
  );
};

export const hashString = async (input: string) => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
      return hashHex;
  } else if (typeof require === 'function') {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  } else {
      throw new Error('Environment not supported');
  }
}
// import type { Table } from 'dexie';

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

export const isGeohash = (input: string): boolean => {
  // Geohashes are usually between 1 and 12 characters long and only use base32 (no a, i, l, o).
  const geohashRegex = /^[0-9a-z]{1,20}$/;
  return geohashRegex.test(input);
  return true;
}

export const applyMixins = (derivedCtor: any, baseCtors: any[]) => {
  baseCtors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      // Check for potential method conflicts
      if (!derivedCtor.prototype.hasOwnProperty(name)) {
        Object.defineProperty(
          derivedCtor.prototype,
          name,
          Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
            Object.create(null)
        );
      } else {
        console.warn(`Method ${name} already exists in ${derivedCtor.name} and will not be overwritten.`);
      }
    });
  });
};


export const safeApplyMixins = (derivedCtor: any, baseCtors: any[]) => {
  baseCtors.forEach(baseCtor => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
      // Get the property descriptor for better control over method copying
      const descriptor = Object.getOwnPropertyDescriptor(baseCtor.prototype, name);

      if (!derivedCtor.prototype.hasOwnProperty(name)) {
        // Log what's being copied for debugging
        //console.log(`Copying ${name} from ${baseCtor.name} to ${derivedCtor.name}`);
        
        if (descriptor) {
          // Use defineProperty to preserve method/function behavior, getters, setters, etc.
          Object.defineProperty(derivedCtor.prototype, name, descriptor);
        } else {
          // Default fallback if no descriptor is found (rare case)
          derivedCtor.prototype[name] = baseCtor.prototype[name];
        }
      } else {
        // Log what is skipped due to an existing method with the same name
        //console.log(`Skipping ${name} - already exists in ${derivedCtor.name}`);
      }
    });
  });
};




// export const allOf = <T>(table: Table<T, any>, multiValueProp: keyof T & string, keys: (T[keyof T & string])[]): Promise<T[]> => {
//   if (keys.length === 0) return Promise.resolve([]);

//   const [dbKey, ...filteredKeys] = keys;
//   return table.where(multiValueProp).equals(dbKey as any).toArray().then((dbResult: T[]) =>
//     filteredKeys.reduce((result: T[], key: T[keyof T & string]) =>
//       result.filter((doc: T) => Array.isArray(doc[multiValueProp]) && (doc[multiValueProp] as any[]).includes(key)),
//       dbResult
//     )
//   );
// };

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
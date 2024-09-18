// src/nwcache.ts
import rcache from '@nostrwatch/nwcache';
import configPromise from './config';

let $rcache: any;

export const initializeCache = async (): Promise<any> => {
  if ($rcache) return $rcache;

  const conf = await configPromise;
  if (!conf?.cache_path)
    throw new Error('No LMDB path specified in config');

  $rcache = rcache(conf.cache_path);
  return $rcache;
};

export default initializeCache

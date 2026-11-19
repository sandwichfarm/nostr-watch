export const parseUrl = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch (error) {
    return null;
  }
};

export const normalizeUrl = (url: string): string => {
  return parseUrl(url)?.toString() ?? url;
};

/**
 * Drop repeated URLs, keeping the first spelling of each. URLs that differ
 * only in ways `new URL` normalizes (host case, a bare trailing slash, default
 * port) count as the same; non-strings are dropped.
 */
export const dedupeUrls = (urls: readonly unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    if (typeof url !== 'string') continue;
    const key = normalizeUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(url);
  }
  return result;
};

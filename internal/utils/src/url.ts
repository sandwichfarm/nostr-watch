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
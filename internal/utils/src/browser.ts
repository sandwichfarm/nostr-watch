/// <reference lib="dom" />
export const isBrowser = (): boolean => (typeof window !== 'undefined' && typeof document !== 'undefined');
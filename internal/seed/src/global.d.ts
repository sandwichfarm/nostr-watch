type Config = {
  seed?: string[];
  [key: string]: any;
}

declare module '@nostrwatch/utils' {
  export function extractConfig(caller: string, what: string): Promise<Config>;
  export function loadConfig(what: string): Promise<Config>;
}
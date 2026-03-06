/// <reference lib="deno.ns" />

// Deno-friendly config loader for trawler
// Reads YAML from CONFIG_PATH or ./config.yaml using js-yaml (esm)

import yaml from 'js-yaml';

export async function loadConfig(): Promise<any> {
  const configPath = Deno.env.get('TRAWLER_CONFIG_PATH')
    || Deno.env.get('CONFIG_PATH')
    || './config.yaml';
  try {
    const text = await Deno.readTextFile(configPath);
    const parsed = yaml.load(text) as any;
    return parsed || {};
  } catch (_err) {
    // Return empty object if not found; caller can decide defaults
    return {};
  }
}


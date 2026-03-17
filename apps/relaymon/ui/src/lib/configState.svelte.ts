/**
 * Shared reactive config state for the Relay Monitor config UI.
 * This file uses Svelte 5 runes ($state) — must be named .svelte.ts.
 *
 * Single source of truth for config data across Simple / Advanced / Raw tiers.
 */

import { parse, stringify } from 'yaml';
import { getConfig, saveConfig } from './api.ts';
import type { Config, ConfigMode } from './types.ts';

// ---- Default config skeleton (used when no config file exists yet) ----

const DEFAULT_CONFIG: Config = {
  monitor: {
    slug: 'relaymon',
    info: { name: '', about: '' },
  },
  publisher: {
    relays: [],
  },
  relaymon: {
    networks: ['clearnet'],
    retry: {
      expiry: [
        { max: 2, delay: 60000 },
        { max: 5, delay: 1200000 },
      ],
    },
    seed: {
      interval: 60000,
      sources: [],
      options: {},
    },
    checks: {
      enabled: ['open', 'read', 'info', 'dns'],
      options: {
        expires: 86400000,
        interval: 30000,
        timeout: { open: 30000, read: 5000 },
        max: 200,
        statusInterval: 100,
        checks: [],
      },
    },
  },
  announce: {},
};

// ---- Reactive state ----

function getInitialMode(): ConfigMode {
  try {
    return (localStorage.getItem('config-mode') as ConfigMode) || 'simple';
  } catch {
    return 'simple';
  }
}

export const configState = $state<{
  data: Config | null;
  rawYaml: string;
  dirty: boolean;
  mode: ConfigMode;
  loading: boolean;
  saveError: string | null;
  validationErrors: string[];
  isFirstRun: boolean;
}>({
  data: null,
  rawYaml: '',
  dirty: false,
  mode: getInitialMode(),
  loading: false,
  saveError: null,
  validationErrors: [],
  isFirstRun: false,
});

// ---- Actions ----

/**
 * Load config from the server.
 * Sets isFirstRun=true if the server returns 404 (no config yet).
 */
export async function loadConfig(): Promise<void> {
  configState.loading = true;
  configState.saveError = null;

  try {
    const result = await getConfig();

    if ('error' in result) {
      // Check if this is a 404 (first run) by looking at error message
      if (result.error.includes('404')) {
        configState.isFirstRun = true;
        configState.data = structuredClone(DEFAULT_CONFIG);
        configState.rawYaml = stringify(DEFAULT_CONFIG);
      } else {
        configState.saveError = result.error;
      }
    } else {
      configState.rawYaml = result.yaml;
      try {
        const parsed = parse(result.yaml) as Config;
        configState.data = parsed;
        configState.isFirstRun = false;
      } catch (parseErr: unknown) {
        // YAML parse error — store raw but mark validation error
        configState.data = null;
        configState.validationErrors = [
          parseErr instanceof Error ? parseErr.message : 'Invalid YAML in config file',
        ];
      }
    }
  } finally {
    configState.loading = false;
    configState.dirty = false;
  }
}

/**
 * Save the current config to the server.
 * In 'raw' mode, saves configState.rawYaml directly.
 * In other modes, serializes configState.data to YAML first.
 */
export async function saveCurrentConfig(): Promise<void> {
  configState.loading = true;
  configState.saveError = null;

  try {
    let yamlToSave: string;

    if (configState.mode === 'raw') {
      yamlToSave = configState.rawYaml;
    } else {
      if (!configState.data) {
        configState.saveError = 'No config data to save';
        return;
      }
      yamlToSave = stringify(configState.data);
    }

    const result = await saveConfig(yamlToSave);

    if ('error' in result) {
      configState.saveError = result.error;
    } else {
      configState.dirty = false;
      configState.saveError = null;

      if (configState.isFirstRun) {
        configState.isFirstRun = false;
        try {
          localStorage.setItem('wizard_complete', 'true');
        } catch {
          // Ignore storage errors
        }
      }
    }
  } finally {
    configState.loading = false;
  }
}

/**
 * Update config from a raw YAML string (used by Raw YAML tier).
 * Always updates rawYaml. If parse succeeds, also updates data.
 * If parse fails, adds parse error to validationErrors.
 * Sets dirty=true.
 */
export function setConfigFromYaml(text: string): void {
  configState.rawYaml = text;
  configState.validationErrors = [];

  try {
    const parsed = parse(text) as Config;
    configState.data = parsed;
  } catch (parseErr: unknown) {
    configState.validationErrors = [
      parseErr instanceof Error ? parseErr.message : 'Invalid YAML',
    ];
  }

  configState.dirty = true;
}

/**
 * Update config from a Config object (used by Simple and Advanced tiers).
 * Serializes to YAML and updates both data and rawYaml.
 * Sets dirty=true.
 */
export function setConfigFromObject(config: Config): void {
  configState.data = config;
  configState.rawYaml = stringify(config);
  configState.dirty = true;
}

/**
 * Switch config editing mode.
 * Before switching: syncs data <-> rawYaml bidirectionally to avoid data loss.
 * Persists mode preference in localStorage.
 */
export function setMode(mode: ConfigMode): void {
  // Sync before switch
  if (configState.mode === 'raw' && configState.rawYaml) {
    // Switching FROM raw: parse rawYaml into data
    try {
      configState.data = parse(configState.rawYaml) as Config;
      configState.validationErrors = [];
    } catch {
      // Keep existing data if parse fails — raw YAML is invalid
    }
  } else if (mode === 'raw' && configState.data) {
    // Switching TO raw: serialize data into rawYaml
    configState.rawYaml = stringify(configState.data);
  }

  configState.mode = mode;

  try {
    localStorage.setItem('config-mode', mode);
  } catch {
    // Ignore storage errors
  }
}

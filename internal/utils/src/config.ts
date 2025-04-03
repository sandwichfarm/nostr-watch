import { isBrowser } from './browser';

let yaml: typeof import('js-yaml') | null = null;
let isYamlAvailable = false;

if (typeof window === 'undefined') {
  try {
    const { createRequire } = require('module');
    const requireModule = createRequire(import.meta.url);

    yaml = requireModule('js-yaml');
    isYamlAvailable = true;
  } catch (e) {
    yaml = null;
    isYamlAvailable = false;
  }
} else {
  yaml = null;
  isYamlAvailable = false;
}

let config: any;

interface Options {
  [key: string]: any;
}

export const extractConfig = async (caller: string, provider: string, warn = true): Promise<Options> => {
  let opts: Options = {};
  if (!config) config = await loadConfig();
  await config;
  
  if (config?.[caller]?.[provider]) {
    opts = config[caller][provider];
  } else if (config?.[provider]) {
    opts = config[provider];
  }

  if (warn && Object.keys(opts).length === 0) {
    // logger.warn(`No ${provider} config specified in 'config.${caller}.${provider}' nor in 'config.${provider}'`);
  }

  return opts;
};

export const loadConfig = async (): Promise<any> => {
  if (isBrowser()) {
    console.warn('Cannot use loadConfig() in the browser.');
    return {};
  }

  const handleError = (e: any) => {
    throw new Error('config.yaml not found');
  };

  // Get config path from environment
  const configPath = (typeof Deno !== 'undefined' ? Deno.env.get('CONFIG_PATH') : process.env.CONFIG_PATH) || './config.yaml';
  if (!configPath) return {};

  try {
    let fileContents: string;
    
    if (typeof Deno !== 'undefined') {
      // Deno environment
      fileContents = await Deno.readTextFile(configPath);
    } else {
      // Node.js environment
      const fsp = await import('fs/promises');
      fileContents = await fsp.readFile(configPath, 'utf8');
    }

    if(isYamlAvailable) {
      return yaml?.load(fileContents);
    }
  } catch (error) {
    handleError(error);
  }
};

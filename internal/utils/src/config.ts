import yaml from 'js-yaml';
import Logger from '@nostrwatch/logger';
import { isBrowser } from './browser';

const logger = new Logger('@nostrwatch/utils');

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
    logger.warn(`No ${provider} config specified in 'config.${caller}.${provider}' nor in 'config.${provider}'`);
  }

  return opts;
};

export const loadConfig = async (): Promise<any> => {
  if (isBrowser()) {
    console.warn('Cannot use loadConfig() in the browser.');
    return {};
  }

  let fsp: typeof import('fs/promises') | undefined;

  try {
    const importedFsp = await import('fs/promises');
    fsp = importedFsp.default || importedFsp;
  } catch (error) {
    console.error('Failed to import fs/promises module:', error);
  }

  const handleError = (e: any) => {
    throw new Error('config.yaml not found');
  };

  const configPath = process.env.CONFIG_PATH || './config.yaml';
  if (!configPath) return {};

  try {
    const fileContents = await fsp!.readFile(configPath, 'utf8');
    return yaml.load(fileContents);
  } catch (error) {
    handleError(error);
  }
};

import fs from 'fs';
import fsp from 'fs/promises';
import yaml from 'js-yaml';

let config

export const extractConfig = async (caller, provider, warn=true) => {
  let opts = {}
  if(!config) config = await loadConfig()
  await config
  if(config?.[caller]?.[provider]) 
    opts = config[caller][provider]
  else 
    if(config?.[provider])
      opts = config[provider]
  if(warn && !Object.keys(opts).length === 0)
    logger.warn(`No ${provider} config specified in 'config.${caller}.${provider}' nor in 'config.${provider}'`)
  return opts
}

export const loadConfigSync = function() {
  try {
    const configPath = process.env.CONFIG_PATH || './config.yaml';
    if (!configPath) return {};
    const fileContents = fs.readFileSync(configPath, 'utf8');
    return yaml.load(fileContents);
  } catch (e) {
      console.error("loadConfigSync Error: ", e);
      throw new Error('config.yaml not found')
  }
};

export const loadConfig = async function() {
  const handle_error = (e) => { 
    return new Error('config.yaml not found')
  }
  const configPath = process.env.CONFIG_PATH || './config.yaml';
  if (!configPath) return {};
  const fileContents = await fsp.readFile(configPath, 'utf8').catch(handle_error);
  return yaml.load(fileContents);
};
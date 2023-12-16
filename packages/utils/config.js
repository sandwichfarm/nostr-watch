import fs from 'fs/promises';
import path from 'path'
import yaml from 'js-yaml';

// let config

export const extractConfig = async (caller, provider, warn=true) => {
  let opts = {}
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

export const loadConfigSync = function(){
  try {
    const config = process.env?.CONFIG_PATH? process.env.CONFIG_PATH: './config.yaml'
    if(!config)
      return {}
    const fileContents = fs.readFileSync(configPath, 'utf8');
    return yaml.load(fileContents);
  } catch (e) {
      console.error(e);
      return {};
  }
}

export const loadConfig = async function (){
  try {
    const config = process.env?.CONFIG_PATH? process.env.CONFIG_PATH: './config.yaml'
    console.log('config path:', config)
    if(!config)
      return {}
    const fileContents = await fs.readFile(config, 'utf8');
    let data = yaml.load(fileContents);
    return data;
  } catch (e) {
    console.error(e);
    return {};
  }
}

// config = await loadConfig()
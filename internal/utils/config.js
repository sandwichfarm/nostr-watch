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

export const loadConfig = async function() {
  if(typeof window !== 'undefined') return console.warn('cannot use loadConfig() in the browser.')

  let fsp; 
  try {
      const importedFsp = await import('fs/promises');
      fsp = importedFsp.default || importedFsp;
  } catch (error) {
      console.error('Failed to import fs/promises module:', error);
  }

  const handle_error = (e) => { 
    return new Error('config.yaml not found')
  }
  const configPath = process.env.CONFIG_PATH || './config.yaml';
  if (!configPath) return {};
  const fileContents = await fsp.readFile(configPath, 'utf8').catch(handle_error);
  return yaml.load(fileContents);
};
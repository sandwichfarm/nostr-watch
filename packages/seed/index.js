import fs from 'fs/promises'
import yaml from 'js-yaml'

const STATIC_SEED_FILE = new URL('seed.yaml', import.meta.url);

export const getSeedStatic = async () => {
  try {
    const fileContents = await fs.readFile(STATIC_SEED_FILE, 'utf8');
    const data = yaml.load(fileContents);
    return data?.relays || [];
  } catch (e) {
      console.error(e);
      return null;
  }
}
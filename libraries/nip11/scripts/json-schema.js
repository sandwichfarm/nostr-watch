import fs from 'fs/promises'

import Nip11Schema from '@nostrwatch/nip11-schema'

const main = async () => {
  await fs.writeFile('./dist/schema.json', JSON.stringify(Nip11Schema), 'utf8');
}

main();
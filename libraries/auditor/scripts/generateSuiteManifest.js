import fs from 'fs';
import path from 'path';
import { globSync } from 'glob'; // or another glob library

const nipFiles = globSync('./src/nips/Nip*/index.ts'); 

const entries = nipFiles.map(file => {
  const dirName = path.basename(path.dirname(file)); // e.g. Nip01, Nip11, Nip77
  return `"${dirName}": () => import('${file.replace(/^\.\/src/, 'src')}')`;
});

const manifestContent = `export const nipManifest = {\n  ${entries.join(',\n  ')}\n};\n`;

fs.writeFileSync('./src/nips/manifest.js', manifestContent, 'utf8');
console.log('Generated nip manifest.');
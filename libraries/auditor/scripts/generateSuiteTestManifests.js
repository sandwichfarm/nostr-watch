import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const nipTestDirectories = globSync('./src/nips/Nip*');
const importEntries = nipTestDirectories.map(directory => {
    const nip = path.basename(directory);
    const nipTestIndex = globSync(`${directory}/tests/index.ts`);
    console.log('Processing directory:', nip, directory, `${directory}/tests/index.ts`, nipTestIndex);
    if (!nipTestIndex.length) {
        console.warn(`No test index found for ${nip}`);
        return null;
    }
    // const relativePath = path.relative('./src', ).replace(/\\/g, '/');
    const testImport = `() => import('${nipTestIndex[0]}')`;
    return `  ${nip}: ${testImport}`;
})
.filter(entry => entry !== null)
.join(',\n');

const manifestContent = `export const suiteTests = {\n${importEntries}\n};\n`;
fs.writeFileSync('./src/nips/suite-test-manifest.js', manifestContent, 'utf8');
console.log('Manifest file created successfully at ./src/nips/suite-test-manifest.js');
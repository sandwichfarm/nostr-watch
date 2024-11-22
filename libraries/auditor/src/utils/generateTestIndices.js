import fs from 'fs/promises';
import path from 'path';
import { globby } from 'globby';

const DEFAULT_PATTERN = 'src/nips/**/*/tests/*.ts';

export const generateIndexFiles = async (pattern) => {
  const files = await globby(pattern ?? DEFAULT_PATTERN);

  const directories = [...new Set(files.map(file => path.dirname(file)))];

  await Promise.all(
    directories.map(async (directory) => {
      const filesInDirectory = await globby(`${directory}/*.ts`);

      const imports = filesInDirectory
        .filter((file) => !file.endsWith('index.ts'))
        .map((file) => {
          const nameWithoutExt = path.basename(file, path.extname(file));
          const relativePath = `./${nameWithoutExt}.js`;
          return `export { default as ${nameWithoutExt} } from '${relativePath}';`;
        });

      const content = imports.join('\n');
      const outputFilePath = path.join(directory, 'index.ts');
      await fs.writeFile(outputFilePath, content);
      //console.log(`Generated ${outputFilePath} with imports for each file in ${directory}`);
    })
  );
};

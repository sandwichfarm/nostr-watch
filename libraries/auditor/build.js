import esbuild from 'esbuild';
import { generateIndexFiles } from './src/utils/generateTestIndices.js';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const isWatchMode = process.argv.includes('--watch');

function generateImportsPlugin({ pattern }) {
  return {
    name: 'generate-imports',
    setup(build) {
      build.onStart(async () => {
        await generateIndexFiles(pattern);
      });
    }
  };
}

async function dereferenceSchemas() {
  const schemaFiles = [];
  
  function findSchemaFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findSchemaFiles(fullPath);
      } else if (file.endsWith('.schema.json')) {
        schemaFiles.push(fullPath);
      }
    }
  }

  findSchemaFiles(path.resolve('./dist'));

  // Run dereferencing script on each schema file
  for (const schemaPath of schemaFiles) {
    await new Promise((resolve) => {
      exec(`node ./scripts/derefJsonSchemas.js ${schemaPath} ${schemaPath}`, (error, stdout, stderr) => {
        if (stderr) {
          console.error(`Error processing ${schemaPath}:`, stderr);
        } else {
          // //console.log(`Dereferenced ${schemaPath}:`, stdout);
        }
        resolve();
      });
    });
  }
}

const plugins = [
  generateImportsPlugin({
    pattern: 'src/nips/**/*/tests/*.ts',
  })
];

const browserConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  tsconfig: 'tsconfig.json',
  outfile: 'dist/web.js',
  platform: 'browser',
  plugins: [
    polyfillNode(),
    ...plugins
  ]
};

const serverConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  tsconfig: './tsconfig.json',
  outfile: 'dist/server.js',
  format: 'esm',
  platform: 'node',
  plugins
};

async function build() {
  try {
    const browserContext = await esbuild.context(browserConfig);
    const serverContext = await esbuild.context(serverConfig);

    if (isWatchMode) {
      await Promise.all([
        browserContext.watch(),
        serverContext.watch()
      ]);

      //console.log("Watching for changes in src...");
      watchSrcDirectory();
    } else {
      await Promise.all([browserContext.rebuild(), serverContext.rebuild()]);
      //console.log("Build complete for both web and server targets.");
      await dereferenceSchemas();
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

function watchSrcDirectory() {
  fs.watch('./src', { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.json'))) {
      //console.log(`Source change detected in ${filename}, rebuilding and running dereferenceSchemas...`);
      
      build().then(() => dereferenceSchemas());
    }
  });
}

build();

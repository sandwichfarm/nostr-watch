import { glob } from 'glob';
import esbuild from 'esbuild';
import babel from '@babel/core';
import { generateIndexFiles } from './src/utils/generateTestIndices.js';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promises as fsp } from 'fs';
import parser from '@apidevtools/json-schema-ref-parser';
import DynamicImport from '@rtvision/esbuild-dynamic-import';

const isWatchMode = process.argv.includes('--watch');

function dereferenceJsonSchemasPlugin() {
    return {
        name: 'dereference-json-schemas',
        setup(build) {
            build.onLoad({ filter: /\.schema\.json$/ }, async (args) => {
                try {
                    console.log(`Dereferencing schema: ${args.path}`);
                    const schemaContent = await fsp.readFile(args.path, 'utf8');
                    const schema = JSON.parse(schemaContent);
                    const dereferenced = await parser.dereference(path.resolve(args.path), schema);
                    console.log(`Successfully dereferenced schema: ${args.path}`);
                    return {
                        contents: JSON.stringify(dereferenced, null, 2),
                        loader: 'json'
                    };
                } catch (error) {
                    console.error(`Error dereferencing schema ${args.path}:`, error);
                    throw error;
                }
            });
        }
    };
}

const babelPlugin = {
    name: 'babel',
    setup(build) {
        build.onLoad({ filter: /assert|power-assert/, namespace: 'file' }, async (args) => {
            if (args.path.includes('node_modules')) return;

            const source = await fsp.readFile(args.path, 'utf8');
            const result = await babel.transformAsync(source, {
                babelrc: true,
                presets: [
                    ["@babel/preset-env", { targets: { browsers: "last 2 versions" } }],
                ],
                plugins: [
                    ["babel-plugin-espower"],
                ],
                filename: args.path,
                sourceMaps: true,
            });
            return { contents: result.code, loader: 'js' };
        });
    },
};

const mockPlugin = {
    name: 'mock',
    setup(build) {
        build.onResolve({ filter: /typedarray\.prototype\.slice|es-abstract/ }, () => {
            const mockPath = path.resolve('./mock.js');
            if (!fs.existsSync(mockPath)) {
                fs.writeFileSync(mockPath, 'export default {};');
            }
            return { path: mockPath };
        });
    },
};

const resolveDynamicImportsPlugin = {
    name: 'resolve-dynamic-imports',
    setup(build) {
        const dynamicImportPattern = /.*\/nips\/(Nip\d+)\/index\.js$/;

        build.onResolve({ filter: dynamicImportPattern }, (args) => {
            const resolvedPath = path.resolve('./dist/web', args.path.replace('../', ''));
            return { path: resolvedPath };
        });

        build.onLoad({ filter: dynamicImportPattern }, async (args) => {
            try {
                const source = await fsp.readFile(args.path, 'utf8');
                const transpiled = await esbuild.transform(source, {
                    loader: 'ts',
                    sourcefile: args.path,
                });
                return { contents: transpiled.code, loader: 'js' };
            } catch (error) {
                console.error(`Error loading dynamic import ${args.path}:`, error);
                throw error;
            }
        });
    },
};

function generateImportsPlugin({ pattern }) {
    return {
        name: 'generate-imports',
        setup(build) {
            build.onStart(async () => {
                await generateIndexFiles(pattern);
            });
        },
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

    findSchemaFiles(path.resolve('./src'));

    for (const schemaPath of schemaFiles) {
        const relativePath = path.relative(path.resolve('./src'), schemaPath);
        const outputPath = path.resolve('./dist/server', relativePath);
        const outputDir = path.dirname(outputPath);

        fs.mkdirSync(outputDir, { recursive: true });
        fs.copyFileSync(schemaPath, outputPath);
        console.log(`Copied schema to ${outputPath}`);
    }

    for (const schemaPath of schemaFiles) {
        const relativePath = path.relative(path.resolve('./src'), schemaPath);
        const outputPath = path.resolve('./dist/server', relativePath);

        console.log(`Dereferencing schema: ${outputPath}`);

        await new Promise((resolve, reject) => {
            exec(`node ./scripts/derefJsonSchemas.js ${outputPath} ${outputPath}`, (error, stdout, stderr) => {
                if (stderr) {
                    console.error(`Error processing ${outputPath}:`, stderr);
                }
                if (error) {
                    console.error(`Execution error for ${outputPath}:`, error);
                }
                resolve();
            });
        });
    }
}


const plugins = [
    generateImportsPlugin({
        pattern: 'src/nips/**/*/tests/*.ts',
    }),
];

const additionalNipModules = glob.sync('./src/nips/**/index.ts', {
    absolute: true,
});

console.log('Additional Nip Modules:', additionalNipModules);

const inlineDynamicImportsPlugin = {
    name: 'inline-dynamic-imports',
    setup(build) {
        build.onEnd(async (result) => {
            console.log('Inlining dynamic imports...');
        });
    },
};

const browserConfig = {
    entryPoints: ['src/index.ts', ...additionalNipModules],
    bundle: true,
    outdir: 'dist/web',
    platform: 'browser',
    format: 'esm',
    allowOverwrite: true,
    external: ['src/nips/*/index.js'],
    plugins: [
        babelPlugin,
        mockPlugin,
        polyfillNode({
            globals: { process: true, Buffer: true, global: true },
        }),
        dereferenceJsonSchemasPlugin(),
        DynamicImport({ 
            changeRelativeToAbsolute: true, 
            filter: /src\/base\/Suite.js$/ 
        }),
        inlineDynamicImportsPlugin,
    ],
};

const serverConfig = {
    entryPoints: ['src/index.ts', ...additionalNipModules],
    bundle: true,
    outdir: 'dist/server',
    platform: 'node',
    format: 'esm',
    allowOverwrite: true,
    plugins: [
        babelPlugin,
        mockPlugin,
        resolveDynamicImportsPlugin,
        ...plugins,
        inlineDynamicImportsPlugin,
    ],
};

async function cleanDist() {
    const distWebPath = path.resolve('./dist/web');
    const distServerPath = path.resolve('./dist/server');
    try {
        if (fs.existsSync(distWebPath)) {
            console.log('Clearing dist/web directory...');
            await fsp.rm(distWebPath, { recursive: true, force: true });
            console.log('dist/web directory cleared.');
        }
        if (fs.existsSync(distServerPath)) {
            console.log('Clearing dist/server directory...');
            await fsp.rm(distServerPath, { recursive: true, force: true });
            console.log('dist/server directory cleared.');
        }
    } catch (error) {
        console.error('Error clearing dist directories:', error);
        throw error;
    }
}

async function build() {
    try {
        // await cleanDist();

        if (isWatchMode) {
            const browserContext = await esbuild.context(browserConfig);
            const serverContext = await esbuild.context(serverConfig);

            await Promise.all([
                browserContext.watch(),
                serverContext.watch(),
            ]);

            console.log("Watching for changes in src...");
            watchSrcDirectory();
        } else {
            await esbuild.build(browserConfig);
            console.log("Browser build completed.");

            const nip11Path = path.resolve('./dist/web/nips/Nip11/index.js');
            if (fs.existsSync(nip11Path)) {
                console.log(`Verified existence of ${nip11Path}`);
            } else {
                console.error(`Missing file: ${nip11Path}`);
                throw new Error(`Required file ${nip11Path} is missing.`);
            }

            await dereferenceSchemas();

            await esbuild.build(serverConfig);
            console.log("Server build completed.");

            console.log("Build complete for both web and server targets.");
        }
    } catch (error) {
        console.error("Build failed:", error);
        process.exit(1);
    }
}


function watchSrcDirectory() {
    fs.watch('./src', { recursive: true }, (eventType, filename) => {
        if (filename && (filename.endsWith('.ts') || filename.endsWith('.json'))) {
            build().then(() => dereferenceSchemas());
        }
    });
}

build();

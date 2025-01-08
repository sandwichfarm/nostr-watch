import { glob } from 'glob';
import esbuild from 'esbuild';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';
import fs from 'fs';
import path from 'path';
import { promises as fsp } from 'fs';

const isWatchMode = process.argv.includes('--watch');

const plugins = [];

const browserConfig = {
    entryPoints: ['src/index.ts'],
    bundle: true,
    outdir: 'dist/web',
    platform: 'browser',
    format: 'esm',
    allowOverwrite: true,
    external: ['src/nips/*/index.js'],
    plugins: [
        polyfillNode({
            globals: { process: true, Buffer: true, global: true },
        }),
    ],
};

const serverConfig = {
    entryPoints: ['src/index.ts'],
    bundle: true,
    outdir: 'dist/server',
    platform: 'node',
    format: 'esm',
    allowOverwrite: true,
    plugins: [
        ...plugins,
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
        await cleanDist();

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

import { Nocapd as daemon } from './daemon.js';
import _bluebird from 'bluebird'
// import Segfault from 'segfault'

// Segfault.registerHandler("segfaults.log");

const run = async () => {
  await tracePromises()
  const $d = await daemon()
  globalHandlers()
  return $d
}

const tracePromises = async () => {
  if(process?.env?.NODE_ENV === 'development'){
    await import('bluebird')
    global.Promise = _bluebird

    Promise.config({
      longStackTraces: true,
      warnings: true // Enable warnings for best practices, including possibly unhandled rejections
    });

    Promise.onPossiblyUnhandledRejection(function(error, promise) {
      console.error("Possibly Unhandled Rejection:");
      console.error(error.stack || error);
    });
  }
}

const globalHandlers = () => {
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    // await gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', async (reason, promise) => {
    // console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // await gracefulShutdown('unhandledRejection');
  });

  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  signals.forEach(signal => {
    process.on(signal, async () => await gracefulShutdown(signal));
  });
}

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, closing application...`);
  await $d.stop()
  process.exit(9);
}

const $d = await run()


import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
const dependencies = require('../package.json').dependencies;

for (const dep of Object.keys(dependencies)) {
  if(!dep.startsWith('@nostrwatch')) continue;
  try {
    const packageJsonPath = path.join(nodeModulesPath, dep, 'package.json');
    const packageJson = require(packageJsonPath); // Using require from 'module' for JSON
    console.log(`${dep}: ${packageJson.version}`);
  } catch (error) {
    console.error(`Could not read version for dependency ${dep}: ${error}`);
  }
}
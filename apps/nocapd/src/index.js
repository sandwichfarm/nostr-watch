import chalk from 'chalk'
import { createRequire } from 'module';
import _bluebird from 'bluebird'

import { Nocapd as daemon } from './daemon.js';

const header = () => {
  console.log(chalk.bold(`

@nostrwatch/nocapd  
                                                   dP
                                                   88
88d888b. .d8888b. .d8888b. .d8888b. 88d888b. .d888b88
88'  \`88 88'  \`88 88'  \`"" 88'  \`88 88'  \`88 88'  \`88
88    88 88.  .88 88.  ... 88.  .88 88.  .88 88.  .88
dP    dP \`88888P' \`88888P' \`88888P8 88Y888P' \`88888P8
                                    88               
                                    dP               

`))
}

const run = async () => {
  await tracePromises()
  header()
  await showDependencies()
  const $d = await daemon()
  return $d
}

const tracePromises = async () => {
  if(process?.env?.NODE_ENV === 'development'){
    await import('bluebird')
    global.Promise = _bluebird

    Promise.config({
      longStackTraces: true,
      warnings: true
    });

    Promise.onPossiblyUnhandledRejection(function(error, promise) {
      console.error("Possibly Unhandled Rejection:");
      console.error(error.stack || error);
    });
  }
}

const globalHandlers = ($daemon) => {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  
  signals.forEach(signal => {
    process.on(signal, async () => await gracefulShutdown(signal));
  });

  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
  });
  
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection:', error);
  });  

  $daemon.$q.queue.on('error', async (err) => {
    console.error('Queue Error: ', err);
    gracefulShutdown(err)
  })

  $daemon.$q.queue.on('ioredis:close', async (err) => {
    console.error('Queue: ioredis:close: ', err);
    gracefulShutdown(err)
  })
}

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, closing application...`);
  await $d.stop()
  process.exit(9);
}

const showDependencies = async () => {
  const require = createRequire(import.meta.url);
  const dependencies = require('../package.json').dependencies;
  for (const dep of Object.keys(dependencies)) {
    if(!dep.startsWith('@nostrwatch')) continue;
    const versionImplemented = dependencies[dep].replace(/[^0-9.]/g, '')
    const versionLatest = (await getPackageLatestVersion(dep)).replace(/[^0-9.]/g, '')
    const versionsMatch = versionImplemented === versionLatest
    if(versionsMatch){
      console.log(`${dep}: ${versionImplemented} == ${versionLatest} ✅`);
    }
    else {
      console.log(`${dep}: ${versionImplemented} -> ${versionLatest} ❌ [UPGRADE NEEDED]`);
    }
  }
}

const getPackageLatestVersion = async (packageName) => {
  try {
    const url = `https://registry.npmjs.org/${packageName}/latest`;
    const response = await fetch(url);
    const data = await response.json();
    return data.version;
  } catch (error) {
    console.error('Error fetching latest package version:', error);
    return null;
  }
};

const $d = await run()
globalHandlers($d)





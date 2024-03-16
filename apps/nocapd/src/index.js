import { Nocapd } from './daemon.js';
import _bluebird from 'bluebird'

let $process

const run = () => {
  //check for nocapd directories 
  //check for monitor configs
  //compare monitor config
  $process = daemon()
}

const daemon = () => {
  return Nocapd()
}

if(process?.env?.NODE_ENV === 'development'){
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

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, closing application...`);
  // await nocapd.stop()
  process.exit(0);
}

process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  // await gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // await gracefulShutdown('unhandledRejection');
});

run()

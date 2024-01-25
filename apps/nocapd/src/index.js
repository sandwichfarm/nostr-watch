import { Nocapd } from './daemon.js';

let $process = null

const run = () => {
  //check for nocapd directories 
  //check for monitor configs
  //compare monitor config
  $process = daemon()
}

const daemon = () => {
  return Nocapd()
}

run()

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
import _timestring from "timestring";
import WebSocket from 'ws';

// import { env } from '@nostrwatch/utils'

export const lastTrawledId = (relay) => `LastTrawled:${relay}`
export const retryId = (relay) => `Trawler:${relay}`
export const lastPublishedId = (relay) => `LastPublished:${relay}`
export const excludeKnownRelays = (known, discovered) => {
  return discovered.filter( relay => !known.includes(relay) )
}

// Function to check if a single queue is empty
export const isQueueEmpty = async function(queue) {
    const counts = await queue.getJobCounts("active");
    return counts.active === 0;
    // return counts.active === 0 && counts.delayed === 0 && counts.completed === 0 && counts.failed === 0;
};

export const areAllQueuesEmpty = async function(queues) {
  const checks = await Promise.allSettled(Object.keys(queues).map((key) => isQueueEmpty(queues[key])));
  return checks.every(check => check);
}

export const whenAllQueuesEmpty = function(queues, callback=()=>{}) {
  const checkQueues = async () => {      
      const allEmpty = await areAllQueuesEmpty(queues);
      if (allEmpty) {
          callback(); 
      }
      setTimeout(checkQueues, 100);
  };
  checkQueues();
};

export const isQueueActive = async function(queue) {
  const counts = await queue.getJobCounts("active");
  return counts.active > 0;
};

export const isAnyQueueActive = async function(queues) {
  const checks = await Promise.allSettled(Object.keys(queues).map((key) => isQueueActive(queues[key])));
  return checks.some(check => check);
};

export const whenAnyQueueIsActive = function(input, callback=()=>{}) {
      const check = async () => {
          let anyActive;
          if (Array.isArray(input))
              anyActive = await isAnyQueueActive(input)
          else
              anyActive = await isQueueActive(input);
          if (anyActive)
              callback();
          else
              setTimeout(check, 1000);
      };
      check();
};

export const countItemsInObjectOfArrays = function(objectOfArrays) {
  const counts = {};
  for (const key in objectOfArrays) {
      counts[key] = objectOfArrays[key].length;
  }
  return counts;
}

export const timestringSeconds = (str) => Math.round(_timestring(str)/1000)

export const checkOnline = async function(relay, timeout = 10000) {
  return new Promise(resolve => {
    const ws = new WebSocket(relay)
    const to = setTimeout(() => ws.close(), timeout)
    ws.on('open', () => { 
      clearTimeout(to)
      ws.close()
      resolve(true)
    })
    ws.on('error', () => {
      ws.close()
      resolve(false)
    })
  })
}

export const delay = async (ms) => new Promise(resolve => setTimeout(resolve, ms))
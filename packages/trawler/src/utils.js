import _timestring from "timestring";
import WebSocket from 'ws';

export const lastTrawledId = (relay) => `LastTrawled:${relay}`
export const retryId = (relay) => `Trawler:${relay}`
export const lastCheckedId = (relay) => `LastChecked:${relay}`

export const excludeKnownRelays = (known, discovered) => {
  return discovered.filter( relay => !known.includes(relay) )
}

export const chunkArray = function(arr, chunkSize) {
  if (chunkSize <= 0) {
    throw new Error("Chunk size must be greater than 0.");
  }

  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    result.push(chunk);
  }

  return result;
}

// Function to check if a single queue is empty
export const isQueueEmpty = async function(queue) {
    const counts = await queue.getJobCounts("active");
    // console.log('isQueueEmpty', counts)
    return counts.active === 0;
    // return counts.active === 0 && counts.delayed === 0 && counts.completed === 0 && counts.failed === 0;
};

export const areAllQueuesEmpty = async function(queues) {
  const checks = await Promise.all(Object.keys(queues).map((key) => isQueueEmpty(queues[key])));
  return checks.every(check => check);
}

// Function to wait until a single queue is empty
export const whenAllQueuesEmpty = function(queues, callback) {
  const checkQueues = async () => {      
      const allEmpty = await areAllQueuesEmpty(queues);
      // console.log('whenAllQueuesEmpty: checking queues', Object.keys(queues), allEmpty)  
      if (allEmpty) {
          callback(); // Trigger the callback when all queues are empty
      }
      setTimeout(checkQueues, 100); // Recheck after a specified interval
  };
  checkQueues();
};


// Function to check if a single queue has active jobs
export const isQueueActive = async function(queue) {
  const counts = await queue.getJobCounts("active");
  // console.log('active', counts.active)
  return counts.active > 0;
};

// Function to check if any queue is active
export const isAnyQueueActive = async function(queues) {
  const checks = await Promise.all(Object.keys(queues).map((key) => isQueueActive(queues[key])));
  return checks.some(check => check);
};

// Unified function to wait until a queue or any queue in an array is active
export const whenAnyQueueIsActive = function(input) {
    return new Promise(resolve => {
        const check = async () => {
            let anyActive;
            if (Array.isArray(input))
                anyActive = await isAnyQueueActive(input)
            else
                anyActive = await isQueueActive(input);
            if (anyActive)
                resolve();
            else
                setTimeout(check, 1000); // Check every second, for example
        };
        check();
    });
};


export const countItemsInObjectOfArrays = function(objectOfArrays) {
  const counts = {};

  // Iterate over each key in the object and count the elements in its array
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
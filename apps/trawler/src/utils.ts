/// <reference lib="deno.ns" />

import _timestring from "timestring";
import WebSocket from 'ws';

interface Queue {
  getJobCounts: (type: string) => Promise<{ active: number }>;
}

interface Queues {
  [key: string]: Queue;
}

export const delay = async (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const timestringSeconds = (str: string): number => 
  Math.round(_timestring(str) / 1000);

export const lastTrawledId = (relay: string): string => 
  `LastTrawled:${relay}`;

export const retryId = (relay: string): string => 
  `Trawler:${relay}`;

export const lastPublishedId = (relay: string): string => 
  `LastPublished:${relay}`;

export const excludeKnownRelays = (known: string[], discovered: string[]): string[] => 
  discovered.filter(relay => !known.includes(relay));

export const isQueueEmpty = async (queue: Queue): Promise<boolean> => {
  const counts = await queue.getJobCounts("active");
  return counts.active === 0;
};

export const areAllQueuesEmpty = async (queues: Queues): Promise<boolean> => {
  const checks = await Promise.allSettled(
    Object.keys(queues).map((key) => isQueueEmpty(queues[key]))
  );
  return checks.every(check => check.status === 'fulfilled' && check.value);
};

export const whenAllQueuesEmpty = (queues: Queues, callback: () => void = () => {}): void => {
  const checkQueues = async () => {
    const allEmpty = await areAllQueuesEmpty(queues);
    if (allEmpty) {
      callback();
    } else {
      setTimeout(checkQueues, 100);
    }
  };
  checkQueues();
};

export const isQueueActive = async (queue: Queue): Promise<boolean> => {
  const counts = await queue.getJobCounts("active");
  return counts.active > 0;
};

export const isAnyQueueActive = async (queues: Queues): Promise<boolean> => {
  const checks = await Promise.allSettled(
    Object.keys(queues).map((key) => isQueueActive(queues[key]))
  );
  return checks.some(check => check.status === 'fulfilled' && check.value);
};

export const whenAnyQueueIsActive = (input: Queue | Queue[], callback: () => void = () => {}): void => {
  const check = async () => {
    let anyActive: boolean;
    if (Array.isArray(input)) {
      anyActive = await isAnyQueueActive(input.reduce((acc, queue) => ({ ...acc, [Math.random()]: queue }), {}));
    } else {
      anyActive = await isQueueActive(input);
    }
    if (anyActive) {
      callback();
    } else {
      setTimeout(check, 1000);
    }
  };
  check();
};

export const countItemsInObjectOfArrays = (objectOfArrays: { [key: string]: any[] }): { [key: string]: number } => {
  const counts: { [key: string]: number } = {};
  for (const key in objectOfArrays) {
    counts[key] = objectOfArrays[key].length;
  }
  return counts;
};

export const checkOnline = async (relay: string, timeout = 10000): Promise<boolean> => {
  return new Promise(resolve => {
    const ws = new WebSocket(relay);
    const to = setTimeout(() => ws.close(), timeout);
    ws.on('open', () => {
      clearTimeout(to);
      ws.close();
      resolve(true);
    });
    ws.on('error', () => {
      ws.close();
      resolve(false);
    });
  });
}; 
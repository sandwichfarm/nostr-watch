// src/lib/testWorker.ts
import { loadWorker } from './loadWorker';

async function testWorker() {
  try {
    const worker = await loadWorker();
    
    worker.onmessage = (event) => {
      console.log('Main thread received message:', event.data);
    };

    worker.postMessage({ id: '1', method: 'set', request: { data: 'test' } });
    worker.postMessage({ id: '2', method: 'remove', request: { data: 'test' } });
  } catch (error) {
    console.error('Failed to load worker:', error);
  }
}

testWorker();

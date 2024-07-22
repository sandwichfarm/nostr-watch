// src/lib/loadWorker.ts
export async function loadWorker() {
  console.log('Loading worker...');
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  console.log('Worker loaded:', worker);
  return worker;
}

import { monitorDb } from "@nostrwatch/idb";

let failure = false
let error: Error | undefined;

const onErr = (_error: Error) => { 
  failure = true
  error = _error
  console.error('Worker: Error setting monitor data', error)
}

self.addEventListener('message', (e) => {
  console.log('Worker received message:', e.data);
  const { id, method, request } = e.data;
  if (method === 'set') {
    set(id, request);
  }
  if (method == 'remove') {
    remove(id, request);
  }
});

const set = async (id: string, request: any) => {
  console.log('Worker: set', id);
  try {
    await monitorDb.monitors.put(request.monitor).catch(onErr);
  } catch (error) {
    console.error('Worker: Error setting monitor data', error);
    failure = true;
  }
  postMessage({ id, method: 'set', subject: request.monitorPubkey, success: !failure, error });
};

const remove = async (id: string, request: string) => {
  console.log('Worker: remove', id);
  try {
    await monitorDb.monitors.delete(request).catch(onErr);
  } catch (error) {
    console.error('Worker: Error removing monitor data', error);
    failure = true
  }
  postMessage({ id, method: 'remove', subject: request, success: !failure, error });
};
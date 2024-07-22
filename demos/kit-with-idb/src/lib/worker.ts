self.addEventListener('message', (e) => {
  console.log('Worker received message:', e.data);
  const { id, method, request } = e.data;
  if (method === 'set') {
    set(id, request);
  }
  if (method === 'remove') {
    remove(id, request);
  }
});

const set = async (id, request) => {
  console.log('Worker: set', id);
  try {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    postMessage({ id, method: 'set', success: true });
  } catch (error) {
    console.error('Worker: Error setting data', error);
    postMessage({ id, method: 'set', success: false, error });
  }
};

const remove = async (id, request) => {
  console.log('Worker: remove', id);
  try {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    postMessage({ id, method: 'remove', success: true });
  } catch (error) {
    console.error('Worker: Error removing data', error);
    postMessage({ id, method: 'remove', success: false, error });
  }
};
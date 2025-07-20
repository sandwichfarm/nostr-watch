export async function waitForSync(maxWait = 1000, checkInterval = 50): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    
    // Give event loop time to process all pending async operations
    await new Promise(resolve => setImmediate(resolve));
  }
}

export async function waitUntil(
  condition: () => boolean,
  maxWait = 1000,
  checkInterval = 50
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    if (condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  return false;
}
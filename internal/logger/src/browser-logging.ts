export default (name: string) => {
  return {
    error: (message: string) => console.error(`[${name}] ERROR: ${message}`),
    warn: (message: string) => console.warn(`[${name}] WARN: ${message}`),
    info: (message: string) => console.info(`[${name}] INFO: ${message}`),
    debug: (message: string) => console.debug(`[${name}] DEBUG: ${message}`),
  };
};
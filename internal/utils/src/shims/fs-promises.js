export default {
  readFile: async () => {
    throw new Error('fs/promises is not available in the browser.');
  },
};
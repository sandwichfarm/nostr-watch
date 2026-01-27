export const Storage = {
    async set<T>(key: string, value: T, sync = false): Promise<void> {
      return new Promise((resolve) => {
        const storageArea = sync ? chrome.storage.sync : chrome.storage.local;
        storageArea.set({ [key]: value }, () => resolve());
      });
    },
  
    async get<T>(key: string, sync = false): Promise<T | null> {
      return new Promise((resolve) => {
        const storageArea = sync ? chrome.storage.sync : chrome.storage.local;
        storageArea.get([key], (result) => resolve(result[key] ?? null));
      });
    },
  
    async remove(key: string, sync = false): Promise<void> {
      return new Promise((resolve) => {
        const storageArea = sync ? chrome.storage.sync : chrome.storage.local;
        storageArea.remove(key, () => resolve());
      });
    }
};
  
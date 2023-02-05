import { defineStore } from 'pinia'

export const useStatusStore = defineStore(
  'status', 
  {
    state: () => ({ 
      historyNode: null,
      api: null
    }),
    getters: {
    },
    actions: {
    },
    share: {
    },
  }
)
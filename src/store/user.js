import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({ 
    favorites: [],
    pubKey: "",
    events: []
  }),
  getters: {
    getFavorites: (state) => state.favorites,
  },
  actions: {
    setFavorite: (relay) => !this.favorites.includes(relay) ? this.favorites.push(relay) : false
  },
})
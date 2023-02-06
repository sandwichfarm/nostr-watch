import { defineStore } from 'pinia'

export const useFilterStore = defineStore('filters', {
  state: () => ({ 
    enabled: false,
    show: {},
    isValid: new Object(),
    rules: new Object(),
    meta: new Object()
  }),
  getters: {
    getRules: state => haystackRef => {
      return state.rules?.[haystackRef]
    },
    getRule: state => (haystackRef, needle) => {
      return state.rules?.[haystackRef]?.filter( rule => rule === needle )
    },
  },  
  actions: {
    addRule(haystackRef, needle, unique, reset){
      if(unique)
        this.rules[haystackRef] = new Array()

      if(reset)
        this.rules[reset] = new Array()

      if( !(this.rules[haystackRef] instanceof Array) )
        this.rules[haystackRef] = new Array()

      const needleMatch = this.getRule(haystackRef, needle)

      if(needleMatch?.length)
        return
      
      this.rules[haystackRef].push(needle)
    },
    removeRule(haystackRef, needle){
      this.rules[haystackRef] = this.rules[haystackRef].filter( rule => rule !== needle )
    },
  },
})
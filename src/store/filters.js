import { defineStore } from 'pinia'

export const useFilterStore = defineStore('filters', {
  state: () => ({ 
    enabled:          false,
    alwaysEnabled:    new Object(),
    hide:             new Object(),
    isValid:          new Object(),
    rules:            new Object(),
    meta:             new Object(),
  }),
  getters: {
    getRuleGroups: state => Object.keys(state.rules) || [],
    getRules: state => haystackRef => {
      return state.rules?.[haystackRef]
    },
    getRule: state => (haystackRef, needle) => {
      return state.rules?.[haystackRef]?.filter( rule => rule === needle )
    },
    get: state => (key1, key2, key3) => {
      if(key3)
        return state[key1][key2][`${key3}`]
      if(key2)
        return state?.[key1]?.[key2]
      if(key1)
        return state?.[key1]
    },
  },  
  actions: {
    reset(ref){
      if(!ref){
        Object.keys(this.rules).forEach( haystackKey => {
          this.rules[haystackKey].forEach( needleKey => {
            this.removeRule(haystackKey, needleKey)
          })
        })
      } else if(this.rules?.[ref]) {
        this.rules[ref].forEach( needleKey => {
          this.removeRule(ref, needleKey)
        })
      }
    },
    set(value, key1, key2, key3){
      //console.log('setting!', value, key1, key2, key3)
      if(typeof value === 'undefined')
        return

      if(!this?.[key1])
        this[key1] = new Object()
      if(!this?.[key1]?.[key2])
        this[key1][key2] = new Object()

      this[key1][key2][key3] = value
      //console.log('set!', this?.[key1], this?.[key1]?.[key2], this?.[key1]?.[key2]?.[key3], value, key1, key2, key3)
    },
    addRule(haystackRef, needle, unique, reset, alwaysEnabled){
      if(unique)
        this.rules[haystackRef] = new Array()

      if(reset)
        this.rules[reset] = new Array()

      if( !(this.rules[haystackRef] instanceof Array) )
        this.rules[haystackRef] = new Array()

      const needleMatch = this.getRule(haystackRef, needle)

      if(needleMatch?.length)
        return
      
      if(alwaysEnabled)
        this.alwaysEnabled[haystackRef] = true
      
      this.rules[haystackRef].push(needle)
    },
    removeRule(haystackRef, needle){
      if(this.alwaysEnabled?.[haystackRef])
        return
      this.rules[haystackRef] = this.rules[haystackRef].filter( rule => rule !== needle )
    },
  },
})
import { defineStore } from 'pinia'

export const useSortingStore = defineStore('sort', {
  state: () => ({ 
    enabled:  new Object(),
    mode:     new Object(),
    modes:    [
      0, //sorting disabled
      1, //ascending
      2, //descending
    ]
  }),
  getters: {
    get: state => key => state.mode[key],
  },  
  actions: {
    create(key){
      this.mode[key] = 0
    },
    remove(key){
      delete this.mode[key]
    },
    enable(key){
      this.enabled[key] = true
    },
    disable(key){
      this.enabled[key] = false 
    },
    toggle(key){
      this.enabled[key] = !this.enabled[key]
    },
    next(key){
      const prog = this.mode[key]+1
      if(this.modes.includes(prog))
        this.mode[key] = prog
      else 
        this.mode[key] = 0
    },
    prev(key){
      const prog = this.mode[key]-1
      if(this.modes.includes(prog))
        this.mode[key] = prog
      else 
        this.mode[key] = 2
    }
  },
})
import { defineStore } from 'pinia'

export const useTaskStore = defineStore('tasks', {
  state: () => ({ 
    //queue
    pending: new Array(),
    completed: new Array(),
    active: new Object(),

    //legacy
    processing: new Object(),
    processed: new Object(),
    currentTask: new Object(),
  }),
  getters: {
    //legacy 
    getProcessed: (state) => (key) => {
      if( !(state.processed[key] instanceof Array) )
        state.processed[key] = new Array()
      return state.processed[key]
    },
    isProcessing: (state) => (key) => state.processing[key],
    isAnyProcessing: (state) => Object.keys(state.processing).filter( key => state.processing[key] ),
    isProcessed: (state) => (key, relay) => state.getProcessed(key).includes(relay),

    //queue/lists
    getPending: (state) => state.pending,
    getActive: (state) => state.active,
    getActiveSlug: (state) => state.active.id,
    getCompleted: (state) => state.completed,
    //queue/states
    isActive: (state) => Object.keys( state.active ).length > 0,
    isIdle: (state) => Object.keys( state.active ).length == 0,
    arePending: (state) => state.pending.length > 0,
    //
    // getRate: (state) => (key) => state.rate[key],
  },
  actions: {
    //queue
    addJob(job){
      this.pending.push(job)
      if( this.isIdle )
        this.startNextJob()
    },
    startNextJob(){
      if( this.isActive ) 
        this.completed.push(this.active)
      if( this.arePending ) {
        this.active = this.pending[0]
        this.pending.shift()
      }
      else {
        this.active = {}
      }
    },
    clearJobs(type){
      this[type] = new Array()
    },
    cancelJob( id ){
      const index = this.pending.findIndex( job => job.id === id )
      this.removeJob( index )
    },
    removeJob( index ){
      this.pending.splice( index, 1 )
    },
    //legacy
    startProcessing(key) { 
      this.processing[key] = true 
      this.currentTask[key] = key
    },
    finishProcessing(key) { 
      this.processed[key] = new Array()
      this.processing[key] = false 
      this.currentTask[key] = null
    },
    addProcessed(key, relay){
      if( !(this.processed[key] instanceof Array) )
        this.processed[key] = new Array()
      if(!this.processed[key].includes(relay))
        this.processed[key].push(relay)
    },
    
  },
})
import { defineStore } from 'pinia'

export const useTaskStore = defineStore('tasks', {
  state: () => ({ 
    lastUpdate: new Object(),

    //processing cache
    processing: new Object(),
    processed: new Object(),
    currentTask: new String(),

    //queue
    pending: new Array(),
    completed: new Array(),
    active: new Object(),
  }),
  getters: {
    getLastUpdate: (state) => (key) => state.lastUpdate[key],

    //legacy 
    getProcessed: (state) => (key) => {
      if( !(state.processed[key] instanceof Array) )
        state.processed[key] = new Array()
      return Array.from(new Set(state.processed[key]))
    },
    isProcessing: (state) => (key) => state.processing[key],
    isProcessed: (state) => (key, relay) => state.getProcessed(key).includes(relay),
    isAnyProcessing: (state) => Object.keys(state.processing).filter( key => state.processing[key] ).length ? true : false,

    //queue/lists
    getPending: (state) => state.pending,
    getActive: (state) => state.active,
    getActiveSlug: (state) => state.active.id,
    getCompleted: (state) => state.completed,

    //queue/states
    isActive: (state) => Object.keys( state.active ).length > 0,
    isIdle: (state) => Object.keys( state.active ).length == 0,
    arePending: (state) => state.pending.length > 0,
  },
  actions: {
    updateNow(key){ this.lastUpdate[key] = Date.now() },
    //queue
    addJob(job){
      if(job?.unique){
        let exists
        exists = this.active.id === job.id
        if(!exists)
          exists = this.pending.filter( j => j.id === job.id).length ? true : false
        if(exists)
          return
      }
      this.pending.push(job)
      if( this.isIdle )
        this.startNextJob()
    },
    startNextJob(){
      console.log('task, isactive?', this.isActive)
      if( this.arePending ) {
        this.active = this.pending[0]
        this.pending.shift()
        this.startProcessing(this.active)
      }
      else {
        console.log('completing active...')
        this.active = {}
      }
    },
    completeJob(){
      console.log('compelteJob', this.active.id, this.active)
      this.updateNow(this.active.id)
      this.finishProcessing(this.active.id)
      this.completed.push(this.active)
      this.startNextJob()
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
    startProcessing(job) { 
      this.addJob(job)
      this.processing[job.id] = true 
      this.currentTask = job.id
    },
    finishProcessing(key) { 
      this.processed[key] = new Array()
      this.processing[key] = false 
      this.currentTask = null
    },
    addProcessed(key, relay){
      if( !(this.processed[key] instanceof Array) )
        this.processed[key] = new Array()
      if(!this.processed[key].includes(relay))
        this.processed[key].push(relay)
    },
    
  },
  share: {
    // An array of fields that the plugin will ignore.
    omit: ['pending', 'completed', 'active'],
    // Override global config for this store.
    enable: true,
  },
},
{
  persistedState: {
    // includePaths: ['lastUpdate', 'processed', 'processing', 'currentTask']
    excludePaths: ['pending', 'completed', 'active'],
  }
})
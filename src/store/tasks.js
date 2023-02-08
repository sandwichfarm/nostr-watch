import { defineStore } from 'pinia'

export const useTaskStore = defineStore(
  'tasks', 
  {
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
    getLastUpdate: (state) => (key) => state.lastUpdate?.[key] ? state.lastUpdate?.[key] : false,

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
    isTaskActive: state => slug => state.getActiveSlug === slug,
    isTaskPending: state => slug => {
      if(this?.active?.id === slug)
        return true
      if(state.pending?.filter( job => job.id === slug )?.length) 
        return true
    },
    isActive: (state) => Object.keys( state.active ).length > 0,
    isIdle: (state) => Object.keys( state.active ).length == 0,
    arePending: (state) => state.pending.length > 0,
  
  },
  actions: {
    updateNow(key){ 
      //console.log('update timestamp', key)
      this.lastUpdate[key] = Date.now() 
    },
    //queue
    addJob(job){
      //console.log('add job', job.id, 'is pending:', this.isTaskPending(job.id), 'active:', this?.active?.id)
      if(job?.unique && this.isTaskPending(job.id))
        return
      this.pending.push(job)
      if( this.isIdle )
        this.startNextJob()
    },
    startNextJob(){
      //console.log('starting next job')
      if( this.arePending ) {
        this.active = this.pending[0]
        this.pending.shift()
        this.startProcessing(this.active)
        //console.log('start next job', this.active)
      }
      else {
        //console.log('jobs idle')
        this.active = {}
      }
    },
    completeJob(slug){
      //console.log('complete job', slug, this.active.id !== slug)
      if(this.active.id !== slug) {
        //console.log(slug, 'is not active!', this.active.id, '')
        return
      }
      this.updateNow(this.active.id)
      this.finishProcessing(this.active.id)
      this.completed.push(this.active)
      setTimeout( this.startNextJob, 50)
    },
    clearJobs(type){
      //console.log('clear jobs', type)
      this[type] = new Array()
    },
    cancelJob( id ){
      //console.log('cancel jobs', id)
      const index = this.pending.findIndex( job => job.id === id )
      this.removeJob( index )
    },
    removeJob( index ){
      //console.log('remove job', index)
      this.pending.splice( index, 1 )
    },

    //legacy
    startProcessing(job) { 
      // this.addJob(job)
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
  persistedState: {
    // includePaths: ['lastUpdate', 'processed', 'processing', 'currentTask']
    excludePaths: ['pending', 'completed', 'active'],
  }
})
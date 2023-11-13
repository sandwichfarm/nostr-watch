import { defineStore } from 'pinia'

export const useJobStore = defineStore(
  'jobs', 
  {
  state: () => ({ 
    lastUpdate:   new Object(),
    uncommitted:   new Object(),
    processed:    new Object(),
    //queue
    pending:      new Array(),
    completed:    new Array(),
    active:       new Object(),
  }),
  getters: {
    getLastUpdate: (state) => (key) => state.lastUpdate?.[key] ? state.lastUpdate?.[key] : false,

    //legacy 
    getProcessed: (state) => (key) => {
      if( !(state.processed[key] instanceof Array) )
        state.processed[key] = new Array()
      return Array.from(new Set(state.processed[key]))
    },

    isProcessed: (state) => (slug, key) => state.getProcessed(slug).includes(key),

    //queue/lists
    getPending: (state) => state.pending,
    getActive: (state) => state.active,
    getActiveSlug: (state) => state.active.id,
    getCompleted: (state) => state.completed,

    //queue/slug/states
    isJobActive: state => slug => state.getActiveSlug === slug,
    isJobPending: state => slug => {
      if(this?.active?.id === slug)
        return true
      if(state.pending?.filter( job => job.id === slug )?.length) 
        return true
      return false
    },
    isJobCompleted: state => slug => {
      if(state.completed?.filter( job => job.id === slug )?.length )
        return true
    },

    //queue/global/states
    isActive: (state) => Object.keys( state.active ).length > 0,
    isIdle: (state) => Object.keys( state.active ).length == 0,
    arePending: (state) => state.pending.length > 0,
  
  },
  actions: {
    addProcessed(slug, key){
      if( !(this.processed[slug] instanceof Array) )
        this.processed[slug] = new Array()
      if(!this.processed[slug].includes(key))
        this.processed[slug].push(key)
    },
    addUncommitted(slug, relay){
      if(!(this.uncommitted?.[slug] instanceof Array))
        this.resetUncommitted(slug)
      this.uncommitted[slug].push(relay)
    },
    removeUncommittedFromProcessed(slug){
      if(!(this.uncommitted?.[slug] instanceof Array))
        return 
      console.log('before removal',  this.processed[slug].length)
      this.processed[slug] = this.processed[slug].filter( relay => !this.uncommitted[slug].includes(relay))
      console.log('after removal',  this.processed[slug].length)
      this.resetUncommitted(slug)
    },
    resetUncommitted(slug){
      this.uncommitted[slug] = new Array()
    },
    updateNow(key){ 
      this.lastUpdate[key] = Date.now() 
    },
    //queue
    async addJob(job){
      if(job?.unique && this.isJobPending(job.id))
        return
      this.pending.push(job)
      if( this.isIdle )
        this.startNextJob()
    },
    async startNextJob(){
      if( this.arePending ) {
        this.active = this.pending[0]
        this.pending.shift()
        this.runJob()
      }
      else {
        this.active = {}
      }
    },
    async runJob(){
      const handler = this.active.handler
      if(this.active.handler instanceof AsyncFunction)
        await handler()
      else 
        handler()
    },
    completeJob(slug){
      if(this.active.id !== slug)
        return
      this.updateNow(this.active.id)
      this.processed[slug] = new Array()
      this.completed.push(this.active)
      setTimeout( this.startNextJob, 50)
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
  },
  share: {
    // An array of fields that the plugin will ignore.
    omit: ['pending', 'completed', 'active'],
    // Override global config for this store.
    enable: true,
  },
  persistedState: {
    // includePaths: ['lastUpdate', 'processed', 'processing', 'currentJob']
    excludePaths: ['pending', 'completed', 'active'],
  }
})

const AsyncFunction = (async () => {}).constructor
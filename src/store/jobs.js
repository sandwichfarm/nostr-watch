import { defineStore } from 'pinia'

export const useJobStore = defineStore(
  'jobs', 
  {
  state: () => ({ 
    lastUpdate:   new Object(),
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
    updateNow(key){ 
      ////console.log('update timestamp', key)
      this.lastUpdate[key] = Date.now() 
    },
    //queue
    async addJob(job){
      if(job?.unique && this.isJobPending(job.id))
        return
      console.log('add job', job.id, 'is pending:', this.isJobPending(job.id), 'active:', this?.active?.id)
      this.pending.push(job)
      if( this.isIdle )
        this.startNextJob()
    },
    async startNextJob(){
      console.log('starting next job', this.pending?.[0]?.id, this.pending?.[0]?.handler)
      if( this.arePending ) {
        this.active = this.pending[0]
        //console.log('started', this.active.id)
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
      console.log('complete job', slug, this.active.id !== slug)
      if(this.active.id !== slug)
        return
      this.updateNow(this.active.id)
      this.processed[slug] = new Array()
      this.completed.push(this.active)
      setTimeout( this.startNextJob, 50)
    },
    clearJobs(type){
      ////console.log('clear jobs', type)
      this[type] = new Array()
    },
    cancelJob( id ){
      ////console.log('cancel jobs', id)
      const index = this.pending.findIndex( job => job.id === id )
      this.removeJob( index )
    },
    removeJob( index ){
      ////console.log('remove job', index)
      this.pending.splice( index, 1 )
    },
    addProcessed(slug, key){
      if( !(this.processed[slug] instanceof Array) )
        this.processed[slug] = new Array()
      if(!this.processed[slug].includes(key))
        this.processed[slug].push(key)
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
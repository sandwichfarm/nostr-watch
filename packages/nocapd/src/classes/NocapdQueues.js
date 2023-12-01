export class NocapdQueues {
  constructor(){
    /** @type {object} */
    this.managers = {}
    /** @type {BullQueue} */
    this.queue = null 
    /** @type {BullQueueEvents} */
    this.events = null 
    /** @type {WorkerManager} */
    this.managers = null 
    /** @type {Scheduler} */ 
    this.scheduler = null
  }

  pause(q){
    if(q)
      return this.queue?.[q].pause()
    Object.keys(this.queue).forEach(q => this.queue[q].pause())
  }

  start(q){
    if(q)
      return this.queue?.[q].start()
    Object.keys(this.queue).forEach(q => this.queue[q].start())
  }

  drain(q){
    if(q)
      return this.queue?.[q].drain()
    Object.keys(this.queue).forEach(q => this.queue[q].drain())
  }

  obliterate(q){
    if(q)
      return this.queue?.[q].obliterate()
    Object.keys(this.queue).forEach(q => this.queue[q].obliterate())
  }
}
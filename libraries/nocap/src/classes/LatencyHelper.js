import { performance } from 'perf_hooks';

export class LatencyHelper {
  constructor($Session){
    this.setup()
    this.$session = $Session
  }

  setup(){
    this.begin = {}
    this.end = {}
  }

  reset(){
    this.setup()
  }

  session(){
    return this.$session.get()
  }

  start(key){
    if(!this.begin?.[this.session()])
      this.begin[this.session()] = {}
    this.begin[this.session()][key] = performance.now()
  }

  finish(key){
    if(!this.end?.[this.session()])
      this.end[this.session()] = {}
    this.end[this.session()][key] = performance.now()
  }

  duration(key){
    return this.end[this.session()][key] - this.begin[this.session()][key]
  }
}
import { QueueService } from './QueueService'

type Workers = { [key: string]: any }
type WorkerCallbacks = { [key: string]: Function }
type WorkersCallbacks = { [key: string ]: WorkerCallbacks }

export class WorkerService {

  private _$workers: Workers;
  private _callbacks: WorkersCallbacks;

  constructor($QueueService: QueueService ){  }
  
  set worker($worker: any){
    this._$workers[$worker.constructor.name] = $worker;
  }

  get workers(): Workers {
    return this._$workers;
  }

  pause(name: string){
    this.workers[name].pause();
  }

  resume(name: string){
    this.workers[name].resume();
  }

  pauseAll(){
    Object.keys(this._$workers).forEach( this.pause.bind(this) )
  }

  resumeAll(){
    Object.keys(this._$workers).forEach( this.resume.bind(this) )
  }

  private bindWorkerEvents(worker: any){
    Object.keys(this._callbacks).forEach( (worker: string) => {
      
    })
  }

  on(event: string, cb: Function){
    this._callbacks[event] = cb;
  }

  private cbcall(...args: any[]){
    if(!this._callbacks) return;
    this._callbacks?.[args[0]]?.call(this, args.slice(1));
  }

}
import { Job } from '../types/Job'
import { NWDQueue } from '../models/NWDQueue'
import { NWDWorker } from '../models/NWDWorker'

export class QueueService {
  
  private _$queue: NWDQueue = null;
  private _$worker: NWDWorker = null;
  private _queue_events: any;
  
  constructor(){}

  set worker($worker: WorkerService){
    this._$worker = $worker;
  }

  get worker(): WorkerService {
    return this._$worker;
  }

  addJob(){

  }

  getJob(){
    console.log('Job retrieved')
  }
}
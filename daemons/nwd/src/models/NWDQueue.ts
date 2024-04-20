import { PluginDataAccess } from './NWDPlugin';
import { Job } from '../types/Job';
import { NWDWorker } from './NWDWorker';

type QueueConfig = {};
type Jobs = { [key: string]: Job }

export class NWDQueue {

  protected static _name: string = "myqueue";
  protected static _limit: number = 1;
  protected static _type: string = "queue";
  protected static _access: PluginDataAccess = {};
  protected static _requires: string[] = [];
  protected static _supports_events: string[] = ['completed', 'failed', 'drained']
  protected static _config: QueueConfig = {};
  
  private _jobs: Jobs;
  private _active_jobs: Set<Job> = false;

  constructor(){}

  protected populate(){
    this._jobs= this._populate()
  }

  protected work(job: Job){
    this.$worker._work(job)
  }

  // override
  protected _work(job: Job): Job {}
  protected _populate(): Jobs { return {} }
  protected on_completed(job: Job){}
  protected on_failed(job: Job){}
}a
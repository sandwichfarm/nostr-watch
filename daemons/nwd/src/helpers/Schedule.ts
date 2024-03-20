import { CronJob } from 'cron';

type Crons = { [key: string]: CronJob }

export class Cron {
  private _jobs: Crons;

  constructor(){}

  add(name: string, onTick: Function, cronTime: string){
    this._jobs[name] = new CronJob({ onTick, cronTime });
  }

  stop(name: string){
    this._jobs[name].stop();
  }

  stopAll(){
    Object.keys(this._jobs).forEach( this.stop.bind(this) );
  }

  remove(name: string){ 
    this.stop(name)
    delete this._jobs[name]
  }

  removeAll(){
    this.stopAll()
    this._jobs = {} as Crons
  }
}
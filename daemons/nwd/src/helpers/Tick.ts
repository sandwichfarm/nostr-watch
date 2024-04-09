class NWDTick {
  private _timer: ReturnType<typeof setInterval>
  private _fns: { [key: string]: Function }

  constructor(every: number = 1000*60){
    this._timer = setInterval( this.run.bind(this), every)
  }

  public add(name: string, fn: Function){
    this._fns[name] = fn;
  }

  private run(){
    Object.keys(this._fns).forEach(key => {
      this._fns[key]()
    })
  }
}
export class Auditor {

  data = new Map()

  constructor(){}

  pass(code){
    this.data.set(code, { pass: true })
  }

  fail(code, result){
    this.data.set(code, { ...result, pass:false })
  }

  get(code){
    return this.data.get(code)
  }

  dump(){
    return Object.fromEntries(this.data.entries())
  }

  tag(){
    return this.data.entries().map( a => ['audit', a[0], ...a[1].values()])
  }
}
export class Counter {
  constructor($session, checks) {
    this.checks = checks;
    this.$session = $session;
    this.counts = {};
    this.init()
  }

  init(){
    this.checks.forEach(check => {
      this.setup()
      this[check] = {}
      this[check].add = (count) => this.add(check, count)
      this[check].subtract = (count) => this.subtract(check, count)
      this[check].get = () => this.get(check)
    })
  }

  add(check, count) {
    this.setup()
    if (!this.checks[this.session()].includes(check)) throw new Error(`Invalid check ${check}`);
    if (!this.counts[this.session()][check]) this.counts[this.session()][check] = 0;
    this.counts[this.session()][check] += count;
  }

  subtract(check, count) {
    this.setup()
    if (!this.checks[this.session()].includes(check)) throw new Error(`Invalid check ${check}`);
    if (!this.counts[this.session()][check]) this.counts[this.session()][check] = 0;
    this.counts[this.session()][check] -= count;
  }

  get(check) {
    this.setup()
    if (!this.checks[this.session()].includes(check)) throw new Error(`Invalid check ${check}`);
    return this.counts[this.session()][check];
  }

  total() {
    this.setup()
    return this.checks[this.session()].reduce((total, check) => total + this.get(check), 0);
  }

  session(){
    return this.$session.get()
  }

  setup(){
    if(!this.checks?.[this.session()])
      this.checks[this.session()] = {}
  }
}
export class Schema {

  constructor(data={}) {
    if(this?.defaults)
      Object.assign(this, this.defaults)
    const classKeys = Object.getOwnPropertyNames(this.__proto__).concat(Object.keys(this));
    const filteredData = Object.keys(data).reduce((acc, key) => {
        if (!classKeys.includes(key)) {
            acc[key] = data[key];
        }
        return acc;
    }, {});
    Object.assign(this, filteredData);
  }

  static parseSelect(){
    const OBJ = this.defaults
    const OBJSLUG = this.name
    const fn = (key) => {
      if(!key)
        key = Object.keys(OBJ)
      if(key instanceof Object && !(key instanceof Array))
        return key
      if(key == 'id')
        key = '#'
      if(typeof key === 'string')
        key = [key]
      const select = { [OBJSLUG]: {} }
      key.push('#')
      for (const k of key) {
        select[OBJSLUG][k] = (value,{root}) => {  root[k] = value; }
      }
      return select
    }
    return fn
  }
}
export class Validator {
  validate(key, value){
    if(typeof this?.defaults?.[key] === 'undefined')
      throw new Error(`${this.constructor.name} does not have property '${key}'`)
    if(value && typeof this.defaults[key] !== typeof value)
      throw new Error(`${this.constructor.name} property ${key} is not of type ${typeof value}`)
  }

  _set(key, value) {
    this.validate(key, value)
    this[key] = value
  }

  setMany(obj){
    Object.keys(obj).forEach(key => {
      this._set(key, obj[key])
    })
  }

  _get(key) {
    this.validate(key)
    return this[key]
  }

  getMany(keys){
    return keys.reduce((acc, key) => {
      acc[key] = this.get(key)
      return acc
    }, {})
  }

  _raw(keys=null){
    keys = keys? keys : Object.keys(this)
    return { ...keys.reduce((acc, key) => {
      if(key !== 'defaults')
        acc[key] = this[key]
      return acc
    }, {}) }
  }

  reset(initalValues={}){
    Object.assign(this, this.defaults, initalValues)
  }
  
}
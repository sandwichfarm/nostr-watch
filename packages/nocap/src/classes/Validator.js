export class Validator {
  validate(key, value){
    // console.log(this)
    // console.log('validator', key, value)
    // if(!this?.[key])
    //   throw new Error(`${this.constructor.name} does not have property ${key}`)
    if(value && typeof this.defaults[key] !== typeof value)
      throw new Error(`${this.constructor.name} property ${key} is not of type ${typeof value}`)
  }

  set(key, value) {
    this.validate(key, value)
    this[key] = value
  }

  get(key) {
    this.validate(key)
    return this[key]
  }

  setMany(obj){
    Object.keys(obj).forEach(key => {
      this.set(key, obj[key])
    })
  }

  dump(){
    return { ...Object.keys(this).reduce((acc, key) => {
      if(key === 'defaults')
        return acc
      acc[key] = this[key]
      return acc
    }, {}) }
  }
}
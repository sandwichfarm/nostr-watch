const Pool = function(relays){
    if( !(relays instanceof Array) )
        console.warn('relays argument must be an instance of Array')
    this.pool = null
    this.relays = relays
    this.handlers = {}
    this.subids = {}
    this.connected = false
}

Pool.prototype.open = function(){
    if(this.connected) {
        console.warn(`Pool is already connected, disconnect first, or call another function`)
        return
    }
    this.pool = new RelayPool(this.relays)
    this.pool.on('open', (relay) => this.cb(relay))
}
Pool.prototype.close = function(){
    this.pool.unsubscribe()
    this.pool.close()
    this.connected = false
}
Pool.prototype.cb = function(handle){
    Object.entries(this.handlers[handle]).forEach( handler => {
        const fn = handler[1]
        fn(relay)
    })
}
Pool.prototype.subscribe = function(filters){
    if(!this.connected) {
        console.warn(`Pool is not yet connected, cannot subscribe to a closed pool`)
        return
    }
    this.cb(handle)
    this.pool.subscribe(this.subids[key], })
}
Pool.prototype.addHandler = function(which, key, fn){
    if( !( this.handlers[which] instanceof Object ) )
        this.handlers[which] = new Object()

    if( typeof this.handlers[which][key] !== 'undefined') {
        //console.log(`${which}:${key} is already defined. Cannot set.`)
        return 
    }
    this.handlers[which][key] = fn
}

Pool.prototype.removeHandler = function(which, key){
    delete this.handlers[which][key]
}

export default Pool
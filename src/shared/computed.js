export default {
    isExpired: function(){
        return !this.store.tasks.getLastUpdate('relays') || Date.now() - this.store.tasks.getLastUpdate('relays') > this.store.prefs.expireAfter
    },
}
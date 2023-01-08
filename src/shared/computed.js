export default {
    isExpired: function(){
        return !this.store.relays.getLastUpdate || Date.now() - this.store.relays.getLastUpdate > this.store.prefs.expireAfter
    },
}
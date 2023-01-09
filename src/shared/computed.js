export default {
    isExpired: function(){
        return (slug) => !this.store.tasks.getLastUpdate(slug) || Date.now() - this.store.tasks.getLastUpdate(slug) > this.store.prefs.expireAfter
    },
}
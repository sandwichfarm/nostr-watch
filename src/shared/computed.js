import {useRoute} from 'vue-router'

export default {
    isExpired: function(){
        return (slug) => !this.store.tasks.getLastUpdate(slug) || Date.now() - this.store.tasks.getLastUpdate(slug) > this.store.prefs.expireAfter
    },
    path: function() { return useRoute().path },
    relayFromUrl() {
        const protocol = this.$route.params.protocol ? this.$route.params.protocol : 'wss'
        return `${protocol}://${this.$route.params.relayUrl}`
    },
    isSingle(){
        return typeof this.$route.params.relayUrl !== 'undefined'
    }
}
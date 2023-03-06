import {useRoute} from 'vue-router'

export default {
    timeSince: function() {
        return date => {
            let seconds = Math.floor((new Date() - date) / 1000),
                interval = seconds / 31536000;
            if (interval > 1)
                return Math.floor(interval) + " years";
            interval = seconds / 2592000;
            if (interval > 1)
                return Math.floor(interval) + " months";
            interval = seconds / 86400;
            if (interval > 1)
                return Math.floor(interval) + " days";
            interval = seconds / 3600;
            if (interval > 1)
                return Math.floor(interval) + " hours";
            interval = seconds / 60;
            if (interval > 1)
                return Math.floor(interval) + " minutes";
            return Math.floor(seconds) + " seconds";
        }   
        
    },
    getPaidRelayPublication(){
        return (publication, showUnit)=> {
            let unit = '',
                str = ''
            
            if(showUnit)
                unit = ' sats'

            if(publication?.unit === 'msats')
                str = parseInt(publication.amount) >= 1000 ? `${str}${Math.floor(publication.amount/1000)} ${unit}` : `${publication.amount} ${publication.unit}`
            else if(publication?.unit === 'sats')
                str = `${str}${publication.amount}${unit}`
            else if(publication?.amount && publication?.unit)
                str = `${str}${publication?.amount} ${showUnit ? publication?.unit : ''}` 

            if(publication?.kind) 
                str = `${str} per kind ${publication.kind} event`
            else 
                str = `${str} per event.`

            return str
        }
    },
    getPaidRelayAdmission(){
        return (result, showUnit)=> {
            if(!this.isPayToRelay(result.url))
                return
            let unit = ''
            if(showUnit)
                unit = 'sats'
            if(result?.info?.fees?.admission?.[0]?.unit === 'msats')
                return `${Math.floor(result?.info?.fees?.admission?.[0].amount/1000)} ${unit}`
            else if(result?.info?.fees?.admission?.[0]?.unit === 'sats')
                return `${result?.info?.fees?.admission?.[0].amount} ${unit}`
            else if(result?.info?.fees?.admission?.[0]?.amount && result?.info?.fees?.admission?.[0]?.unit)
                return `${result?.info?.fees?.admission?.[0]?.amount} ${result?.info?.fees?.admission?.[0]?.unit}` 
        }
    },
    isPayToRelay(){
        return relay => {
            if(this.store.results.get(relay)?.info?.limitation?.payment_required)
                return true
        }
    },
    isExpired: function(){
        return (slug, expireAfter) => {
            if(!expireAfter)
                expireAfter = this.store.prefs.expireAfter
            return !this.store.jobs.getLastUpdate(slug) || Date.now() - this.store.jobs.getLastUpdate(slug) > expireAfter
        }
    },
    path: function() { return useRoute().path },
    relayFromUrl() {
        const protocol = this.$route.params.protocol ? this.$route.params.protocol : 'wss'
        return `${protocol}://${this.$route.params.relayUrl}`
    },
    isSingle(){
        return typeof this.$route.params.relayUrl !== 'undefined'
    },
    getUptimeColor(){
        return result => {
            return {
            'text-green-600/100 dark:text-green-600/80': result?.uptime >= 98,
            'text-green-600/80 dark:text-green-400/50': result?.uptime >= 95 && result?.uptime < 98,
            'text-yellow-600 dark:text-yellow-400/90': result?.uptime >= 90 && result?.uptime < 95,
            'text-orange-500': result?.uptime >= 80 && result?.uptime < 90,
            'text-red-400 dark:text-red-600': result?.uptime < 80,
            }
        }
    },
    isFirstVisit(){
        return      (!this.store.jobs.lastUpdate['relays/seed'] && !this.store.prefs.clientSideProcessing)
                ||  ( !this.store.jobs.lastUpdate['relays/check'] && this.store.prefs.clientSideProcessing)
    },
    showBasicData(){
        return this.isFirstVisit && this.store.jobs.getActiveSlug !== 'relays/seed' && !this.pendingFirstCompletion
        // return this.isFirstVisit 
    },
    pendingFirstCompletion(){
        return !this.store.jobs.lastUpdate['relays/seed'] && !this.store.jobs.lastUpdate['relays/check'] && this.$route.path === '/find/relays'
        // return this.isFirstVisit 
    },
    nipSignature(){
        return (key) => key.toString().length == 1 ? `0${key}` : key
    },

    nipFormatted(){
        return (key) => `NIP-${this.nipSignature(key)}`
    },

    nipLink(){
        return (key) => `https://github.com/nostr-protocol/nips/blob/master/${this.nipSignature(key)}.md`
    },
}
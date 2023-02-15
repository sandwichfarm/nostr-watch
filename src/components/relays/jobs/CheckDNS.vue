<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
  <span class="text-inherit">
    <span class="text-inherit">
      <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      checking dns {{ this.store.jobs.getProcessed(this.slug).length }}/{{ this.relays.length }}
    </span>
  </span>
  </span> 
</template>

<script>
import { defineComponent } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import doh from 'dohjs'

const localMethods = {
  CheckDNS(force){  
    console.log('invalidating', this.slug)

    if( (!this.isExpired(this.slug, 24*60*60*1000) && !force) && !this.isSingle )
      return
    
    console.log('invalidating DNS', 'expired', this.slug, this.jobDNS)

    this.queueJob(
      this.slug, 
      async () => await this.jobDNS,
      true
    )
  },
  async jobDNS(single){
    // alert('dns')
    if(single) {
      this.getDNS(single).then( dns => {
        this.store.relays.dns = Object.assign(this.store.relays.dns, { [single]: dns } )
      })
      .catch( err => console.error(err) )
    }
    this.relays = this.store.relays.getAll
    const relays = this.relays.filter( relay => !this.store.jobs.processed[this.slug]?.includes(relay))
    const relayChunks = this.chunk(100, relays)
    //console.log('chunks', )
    let promises = [],
        dnsAcc = {}
    for(let c=0;c<relayChunks.length;c++) {
      const relays = relayChunks[c]
      relays.forEach( async (relay) => {
        const promise = new Promise( resolve => {
          dnsAcc[relay] = {}
          this.getDNS(relay)
            .then( (dns) => {
              dnsAcc[relay] = dns
              // console.log('dns', dnsAcc)
              this.store.jobs.addProcessed(this.slug, relay)
              resolve()
            })
            .catch( err => console.error(err) )
        })
        promises.push(promise)
      })
      await Promise.all(promises)
      this.store.relays.dns = Object.assign(this.store.relays.dns, dnsAcc)
      promises = []
      dnsAcc = {} 
    }
    this.store.jobs.completeJob(this.slug)
  },
  async getDNS(relay){
    const result = {}
    result.ipv4 = []
    result.ipv6 = []
    const ipv4 = await this.resolver.query(new URL(relay).hostname, 'A')
    const ipv6 = await this.resolver.query(new URL(relay).hostname, 'AAAA')
    if(ipv4?.answers?.length)
      ipv4.answers.forEach(ans => result.ipv4.push(ans.data)) //change to map
    if(ipv6?.answers?.length)
      ipv6.answers.forEach(ans => result.ipv6.push(ans.data))
    return result
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.jobs.getLastUpdate(this.slug)+this.store.prefs.duration)) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.jobs.getLastUpdate(this.slug)) || Date.now()
  },
}

export default defineComponent({
  name: 'CheckDNS',
  components: {},
  data() {
    return {
      slug: 'relays/dns',
      relays: this.store.relays.getAll,
      interval: null,
      resolver: null
    }
  },
  setup(){
    return { 
      store : setupStore(),
    }
  },
  created(){
  },
  unmounted(){
    clearInterval(this.interval)
  },
  beforeMount(){},
  mounted(){  
    this.resolver = new doh.DohResolver('https://1.1.1.1/dns-query')
    console.log('resolver', this.resolver)
    if(this.isSingle){
      this.slug = `relays/dns/${this.relayFromUrl}`
      this.CheckDNS(true, this.relayFromUrl)
    }
    else if(this.store.jobs.isJobActive(this.slug))
      this.CheckDNS(true)
    else
      this.CheckDNS()
  },
  updated(){},
  methods: Object.assign(RelayMethods, localMethods),
  computed: Object.assign(SharedComputed, {}),
  props: {},
})
</script>

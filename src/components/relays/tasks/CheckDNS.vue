<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="text-inherit">
  <span class="text-inherit">
    <span class="text-inherit">
      <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      checking dns {{ this.store.tasks.getProcessed(this.slug).length }}/{{ this.relays.length }}
    </span>
  </span>
  </span> 
</template>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import doh from 'dohjs'

const localMethods = {
  invalidateDNS(force){  
    console.log('invalidating', this.slug)

    if( !this.isExpired(this.slug, 24*60*60*1000) && !force )
      return
    
    console.log('invalidating DNS', 'expired', this.slug, this.jobDNS)

    this.queueJob(
      this.slug, 
      this.jobDNS,
      true
    )
  },
  async checkDNS(relay){
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
  async jobDNS(){
    // alert('dns')
    this.relays = this.store.relays.getAll
    const relays = this.relays.filter( relay => !this.store.tasks.processed[this.slug]?.includes(relay))
    const relayChunks = this.chunk(100, relays)
    //console.log('chunks', )
    let promises = [],
        dnsAcc = {}
    for(let c=0;c<relayChunks.length;c++) {
      const relays = relayChunks[c]
      relays.forEach( async (relay) => {
        const promise = new Promise( resolve => {
          dnsAcc[relay] = {}
          this.checkDNS(relay)
            .then( (dns) => {
              dnsAcc[relay] = dns
              // console.log('dns', dnsAcc)
              this.store.tasks.addProcessed(this.slug, relay)
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
    this.store.tasks.completeJob(this.slug)
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.store.prefs.duration)) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.tasks.getLastUpdate(this.slug)) || Date.now()
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
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
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
    if(this.store.tasks.isTaskActive(this.slug))
      this.invalidateDNS(true)
    else
      this.invalidateDNS()
    // this.invalidateTask()
    // this.interval = setInterval( this.invalidateTask, 1000 )
  },
  updated(){},
  methods: Object.assign(RelayMethods, localMethods),
  computed: Object.assign(SharedComputed, {
    getDynamicTimeout: function(){
      return this.averageLatency*this.relays.length
    },
  }),
  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
  },
})
</script>

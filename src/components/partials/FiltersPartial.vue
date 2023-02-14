<template>
  <div class="ml-1 hidden lg:block">
    <div class="mb-4 block">
      <div 
        class="mr-3  my-4 cursor-pointer inline-block"
        @click="toggleFilterEnabled">
        <span class="py-1 px-2 bg-black/30 block" v-if="!store.filters.enabled">Enable Filters</span>
        <span class="py-1 px-2 bg-white/30 block" v-if="store.filters.enabled" >Disable Filters</span>
      </div>

      <span class="mr-3 py-1 px-2 bg-black/20 inline-block cursor-pointer" 
        @click="resetFilters()"
        v-if="areClearableFilters">
        Clear Filters
      </span>

      <div class="inline-block" :class="{'opacity-20':!store.filters.enabled}">
        <div class="inline-block">
          <span v-if="store.filters.rules?.nips && Object.keys(store.filters.rules?.nips)?.length" class="ml-3 mr-1">nips</span>
          <span v-for="nip in store.filters.rules?.nips" :key="`filter-summary-nip-${nip}`" class="inline-block py-1 px-3 bg-black/5 dark:bg-white/5">
            {{ nip }}
          </span>
        </div>
        <div class="inline-block">
          <span v-if="store.filters.rules?.software && Object.keys(store.filters.rules?.software)?.length" class="ml-3 mr-1">software</span>
          <span v-for="software in store.filters.rules.software" :key="`filter-summary-nip-${software}`" class="inline-block py-1 px-3 bg-black/5 dark:bg-white/5">
            {{ software }}
          </span>
        </div>
        <div class="inline-block">
          <span v-if="store.filters.rules?.countries && Object.keys(store.filters.rules?.countries)?.length" class="ml-3 mr-1">country</span>
          <span v-for="country in store.filters.rules?.countries" :key="`filter-summary-nip-${country}`" class="inline-block py-1 px-3 bg-black/5 dark:bg-white/5">
            {{ country }}
          </span>
        </div>
        <div class="inline-block">
          <span v-if="store.filters.rules?.continents && Object.keys(store.filters.rules?.continents)?.length" class="ml-3 mr-1">continent</span>
          <span v-for="continent in store.filters.rules?.continents" :key="`filter-summary-nip-${continent}`" class="inline-block py-1 px-3 bg-black/5 dark:bg-white/5">
            {{ continent }}
          </span>
        </div>                
      </div>
    </div>

    <div v-if="store.filters.enabled && (store.jobs.isJobActive('relays/check') || store.jobs.isJobActive('relays/seed'))" class="italic bg-black/5 text-black/80 dark:bg-white/5 dark:text-white/50 py-2 px-3">
      <em>filters are hidden during updates</em>
    </div>

    <div v-if="store.filters.enabled && (!store.jobs.isJobActive('relays/check') && !store.jobs.isJobActive('relays/seed'))" class="py-2 px-3 dark:bg-black/10">
      <!-- valid -->
      <div class="mb-4 block flex-none" v-if="this.store.jobs.lastUpdate?.['relays/nip11']">
        <span  
          class="text-black/50 dark:text-white/70 block py-1 mb-1 cursor-pointer :hover:dark:bg-black/20 w-32 block">
          Meta Checks
      </span>
        <span 
          @click="toggleFilter('valid/nip11', true, true)"
          class="cursor-pointer mr-2 mb-2 py-1 px-2 bg-black/20 inline-block"
          :class="{
              'bg-white/20': store?.filters?.getRule('valid/nip11', true)?.length
          }">
          Valid Pubkey
        </span>
      </div>

      
      <div class="flex">
      <!-- By nip -->
      <div class="mb-4 flex-initial">
        <span  
          class="text-black/50 dark:text-white/70 block py-1 mb-1 cursor-pointer :hover:dark:bg-black/20 w-32"
          @click="store.filters.hide['nips']=!store.filters.hide['nips']">
          NIPs
          <span class="dark:text-white/40"> {{ store.filters.hide['nips'] ? 'show' : 'hide'  }}</span>
        </span>
        <span v-if="!store.filters.hide['nips']">
          <span
            v-for="nip in Object.keys(store.stats?.nips || {})" 
            :key="`filter-nip-${nip.key}`" 
            @click="toggleFilter('nips', store.stats?.nips[nip].key, false)"
            :class="{
              'bg-white/20': store.filters.getRule('nips', store.stats?.nips[nip].key)?.length,
              'text-black/20 dark:text-white/20 bg-none italic': parseInt(store.filters?.count?.nips[`${store.stats?.nips[nip].key}`]) === 0,
              'bg-black/5 dark:bg-black/20': parseInt(store.filters?.count?.nips[`${store.stats?.nips[nip].key}`]) > 0 && !store.filters.getRule('nips', store.stats?.nips[nip].key)?.length
            }"
            class="cursor-pointer mr-2 mb-2 py-1 px-2  inline-block">
            NIP-{{ store.stats?.nips[nip].key }} 
            <span class="text-xs text-white/50">
              {{ store.filters?.count?.nips[`${store.stats?.nips[nip].key}`] }}
            </span>
          </span>
        </span>
      </div>

      <!-- By software -->
      <div class="mb-4 flex-initial">
        <span  
          class="text-black/50 dark:text-white/70  block py-1 mb-1 cursor-pointer :hover:dark:bg-black/20 w-32"
          @click="store.filters.hide['software']=!store.filters.hide['software']">
          Software
          <span class="dark:text-white/40"> {{ store.filters.hide['software'] ? 'show' : 'hide'  }}</span>

        </span>
        <span v-if="!store.filters.hide['software']">
          <span 
            v-for="sw in Object.keys(store.stats?.software || {})" 
            :key="`filter-software-${store.stats?.software[sw].key}`" 
            @click="toggleFilter('software', store.stats?.software[sw].key, true)"
            :class="{
              'bg-white/20': store.filters.getRule('software', store.stats?.software[sw].key)?.length,
              'text-black/20 dark:text-white/20 bg-none italic': parseInt(store.filters?.count?.software[`${store.stats?.software[sw].key}`]) === 0,
              'bg-black/5 dark:bg-black/20': parseInt(store.filters?.count?.software[`${store.stats?.software[sw].key}`]) > 0 && !store.filters.getRule('software', store.stats?.software[sw].key)?.length
            }"
            class="cursor-pointer mr-2 mb-2 py-1 px-2  inline-block">
            {{ store.stats?.software[sw].key}} 
            <span class="text-xs text-white/50">
              {{ store.filters?.count?.software[`${store.stats?.software[sw].key}`] }}
            </span>
          </span>
        </span>
      </div>

      <!-- By country -->
      <div class="mb-4 flex-initial">
        <span  
          class="text-black/50 dark:text-white/70 block py-1 mb-1 cursor-pointer :hover:dark:bg-black/20 w-32"
          @click="store.filters.hide['countries']=!store.filters.hide['countries']">
          Countries
          <span class="dark:text-white/40"> {{ store.filters.hide['countries'] ? 'show' : 'hide'  }}</span>
        </span>
        <span v-if="!store.filters.hide['countries']">
          <span 
            v-for="country in Object.keys(store.stats?.countries || {})" 
            :key="`filter-countries-${store.stats?.countries[country].key}`" 
            @click="toggleFilter('countries', store.stats?.countries[country].key, true, 'continents')"
            :class="{
              'bg-white/20': store.filters.getRule('countries', store.stats?.countries[country].key)?.length,
              'text-black/20 dark:text-white/20 bg-none italic': parseInt(store.filters?.count?.countries[`${store.stats?.countries[country].key}`]) === 0,
              'bg-black/5 dark:bg-black/20': parseInt(store.filters?.count?.countries[`${store.stats?.countries[country].key}`]) > 0 && !store.filters.getRule('countries', store.stats?.countries[country].key)?.length
            }"
            class="cursor-pointer mr-2 mb-2 py-1 px-2  inline-block">
            {{ store.stats?.countries[country].key}} 
            <span class="text-xs text-white/50">
              {{ store.filters?.count?.countries[`${store.stats?.countries[country].key}`] }}
            </span> 
          </span>
        </span> 
      </div>

      <!-- By continent -->
      <div class="mb-4 flex-initial">
        <span  
          class="text-black/50 dark:text-white/70 block py-1 mb-1 cursor-pointer :hover:dark:bg-black/20 w-32"
          @click="store.filters.hide['continents']=!store.filters.hide['continents']">
            Continents 
            <span class="dark:text-white/40"> {{ store.filters.hide['continents'] ? 'show' : 'hide'  }}</span>
        </span>
        <span v-if="!store.filters.hide['continents']">
          <span 
            v-for="continent in Object.keys(store.stats?.continents || {})" 
            :key="`filter-continents-${store.stats?.continents[continent].key}`" 
            @click="toggleFilter('continents', store.stats?.continents[continent].key, true, 'countries')"
            :class="{
              'bg-white/20': store.filters.getRule('continents', store.stats?.continents[continent].key)?.length,
              'text-black/20 dark:text-white/20 bg-none italic': parseInt(store.filters?.count?.continents[`${store.stats?.continents[continent].key}`]) === 0,
              'bg-black/5 dark:bg-black/20': parseInt(store.filters?.count?.continents[`${store.stats?.continents[continent].key}`]) > 0 && !store.filters.getRule('continents', store.stats?.continents[continent].key)?.length
            }"
            class="cursor-pointer mr-2 mb-2 py-1 px-2  inline-block">
            {{ store.stats?.continents[continent].key}} 
            <span class="text-xs text-white/50">
              {{ store.filters?.count?.continents[`${store.stats?.continents[continent].key}`] }}
            </span>
          </span>
        </span> 
      </div>
    </div>
  </div>
</div>

</template>
<script>
  import RelayMethods from '@/shared/relays-lib.js'
  import { defineComponent, toRefs } from 'vue'
  import SharedComputed from '@/shared/computed.js'
  import { setupStore } from '@/store'

  export default defineComponent(
  {
    name: 'FiltersPartial',
    components: {},
    setup(props){
      const {relaysProp: relays} = toRefs(props)
      return { 
        store : setupStore(),
        relays: relays
      }
    },
    beforeMount(){
      // this.foundNips = this.collateSupportedNips()
    },
    mounted(){
      // this.$forceUpdate
      this.activeNavItem = this.store.layout.getActiveItem('relays/find').slug
      this.refreshCounts()
      
    },
    updated(){
      
    },
    beforeUnmount(){
    },
    unmounted(){
    },
    props: {
      // relaysProp: {
      //   type: Array,
      //   default(){
      //     return []
      //   }
      // },
    },
    data() {
      return {
        count: { nips: {}, software: {}, countries: {}, continents: {} },
        activeNavItem: null
      }
    },  
    methods: Object.assign(RelayMethods, {
      doRefreshCounts(){
        // console.log('active item', this.store.layout.getActiveItem('relays/find').slug, this.activeNavItem === this.store.layout.getActiveItem('relays/find').slug)
        if(this.activeNavItem === this.store.layout.getActiveItem('relays/find').slug)
          return 
        this.activeNavItem = this.store.layout.getActiveItem('relays/find').slug
        this.refreshCounts( this.getRelays(this.store.relays.getAll) )
        console.log('refresh!')
      },
      resetFilters(){
        this.store.filters.reset()
        this.refreshCounts( this.getRelays(this.store.relays.getAll) )
      },
      toggleFilterEnabled(){
        this.store.filters.enabled = !this.store.filters.enabled
        this.refreshCounts( this.getRelays(this.store.relays.getAll) )
      },

    }),
    computed: Object.assign(SharedComputed, {
      areClearableFilters(){
        return true
        // this.store.filters.getRuleGroups.forEach( haystackRef => haystackRef.filter( rule => !this.store.filters.alwaysEnabled[haystackRef].includes(rule)) ).length
      }
    })
  })
</script>
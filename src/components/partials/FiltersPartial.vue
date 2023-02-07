<template>
  <div class="ml-1 lg:ml-6 ">
    <div class="mb-4 block">
      <div 
        class="py-1 px-2 my-4 cursor-pointer"
        @click="store.filters.enabled=!store.filters.enabled">
        <span v-if="!store.filters.enabled">Apply Filters</span>
        <span v-if="store.filters.enabled">Disable Filters</span>
      </div>
    </div>

    

    <div v-if="store.filters.enabled" class="dark:bg-black/10">
      <!-- valid -->
      <div class="mb-4 block flex-none" v-if="this.store.tasks.lastUpdate?.['relays/nip11']">
        <span  
          class="text-black/50 dark:text-white/70 block py-1 mb-1 cursor-pointer :hover:dark:bg-black/20 w-32 block">
          Validations
      </span>
        <span 
          @click="toggleFilter('valid/nip11', true, true)"
          class="cursor-pointer mr-2 mb-2 py1 px-3 bg-black/20 inline-block"
          :class="{
              'bg-white/20': store?.filters?.getRule('valid/nip11', true)?.length
          }">
          Valid Pubkey
        </span>
      </div>

      <div class="flex">


      <!-- By nip -->
      <div class="mb-4">
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
              'bg-white/20': store.filters.getRule('nips', store.stats?.nips[nip].key)?.length
            }"
            class="cursor-pointer mr-2 mb-2 py1 px-3 bg-black/20 inline-block">
            NIP-{{ store.stats?.nips[nip].key }} 
            <span class="text-xs text-white/50">
              <!-- {{ store.stats?.nips[nip].count }} -->
              <!-- {{ store.stats?.nips?.[nip].key }}  -->
              {{ store.filters?.count?.nips[`${store.stats?.nips[nip].key}`] }}
              <!-- {{store.filters?.count?.nips}} -->
              <!-- {{ store.filters?.count?.nips?.[store.stats?.nips[nip].key] }} -->
              <!-- {{ this?.relays?.filter( relay => { results[relay]?.info?.supported_nips?.includes(parseInt(store.stats?.nips?.[nip].key)) } )?.length }} -->
            </span>
          </span>
        </span>
        
      </div>

      <!-- By software -->
      <div class="mb-4">
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
              'bg-white/20': store.filters.getRule('software', store.stats?.software[sw].key)?.length
            }"
            
            class="cursor-pointer mr-2 mb-2 py1 px-3 bg-black/20 inline-block">
            {{ store.stats?.software[sw].key}} 
            <span class="text-xs text-white/50">
              {{ store.filters?.count?.software[`${store.stats?.software[sw].key}`] }}
            </span>
          </span>
        </span>
      </div>

      <!-- By country -->
      <div class="mb-4">
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
              'bg-white/20': store.filters.getRule('countries', store.stats?.countries[country].key)?.length
            }"
            class="cursor-pointer mr-2 mb-2 py1 px-3 bg-black/20 inline-block">
            {{ store.stats?.countries[country].key}} 
            <span class="text-xs text-white/50">
              {{ store.filters?.count?.countries[`${store.stats?.countries[country].key}`] }}
            </span> 
          </span>
        </span> 
      </div>

      <!-- By continent -->
      <div class="mb-4">
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
              'bg-white/20': store.filters.getRule('continents', store.stats?.continents[continent].key)?.length
            }"
            class="cursor-pointer mr-2 mb-2 py1 px-3 bg-black/20 inline-block">
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
  import { relays } from '../../../relays.yaml'
  import { geo } from '../../../cache/geo.yaml'

  export default defineComponent(
  {
    name: 'FiltersPartial',
    components: {},
    setup(props){
      const {resultsProp: results} = toRefs(props)
      return { 
        store : setupStore(),
        results: results
      }
    },
    beforeMount(){
      // this.foundNips = this.collateSupportedNips()
    },
    mounted(){
      this.relays = this.getRelays( relays ) 
      this.refreshCounts()
    },
    updated(){
      
    },
    beforeUnmount(){
    },
    unmounted(){
      delete this.results
    },
    props: {
      resultsProp: {
        type: Object,
        default(){
          return {}
        }
      },
    },
    data() {
      return {
        relays: this.getRelays( relays ),
        count: { nips: {}, software: {}, countries: {}, continents: {} }
      }
    },
    methods: Object.assign(RelayMethods, {

      refreshCounts(){
        this.relays = this.getRelays( relays ) 
        if(Object.keys(this.store.stats?.nips).length) 
          this?.store?.stats?.nips?.forEach( nip => {
            this.store.filters.set(
              this?.relays?.filter( relay => this.results[relay]?.info?.supported_nips?.includes( parseInt( nip.key ) ))?.length || 0,
              'count',
              'nips',
              nip.key,
            )
          })
        if(Object.keys(this.store.stats?.software).length)
          this.store.stats?.software?.forEach( software => {
            console.log('software', this?.relays?.filter( relay => this.results[relay]?.info?.software?.includes( software.key ))?.length || 0,)
            this.store.filters.set(
              this?.relays?.filter( relay => this.results[relay]?.info?.software?.includes( software.key ))?.length || 0,
              'count',
              'software',
              software.key,
            )
          })
        if(Object.keys(this.store.stats?.countries).length)
          this.store.stats?.countries?.forEach( country => {
            console.log('countries', this?.relays?.filter( relay => this.store.relays.geo?.[relay]?.country?.includes( country.key ))?.length || 0,)
            this.store.filters.set(
              this?.relays?.filter( relay => geo?.[relay]?.country?.includes( country.key ))?.length || 0,
              'count',
              'countries',
              country.key,
            )
          })
        if(Object.keys(this.store.stats?.continents).length)
          this.store.stats?.continents?.forEach( continent => {
            this.store.filters.set(
              this?.relays?.filter( relay => geo?.[relay]?.continentName?.includes( continent.key ))?.length || 0,
              'count', 
              'continents', 
              continent.key
            )
          })
      },
      toggleFilter(ref, key, unique, reset){
        const rule = this.store.filters.getRule(ref, key)
        console.log('rule', rule)
        if(rule?.length) {
          console.log('filters: removing', rule)
          this.store.filters.removeRule(ref, key, unique, reset)
          console.log('filters: effect', this.store.filters.rules)
          
        } else {
          console.log('filters: adding', rule)
          this.store.filters.addRule(ref, key, unique, reset)
          console.log('filters: effect', this.store.filters.rules)
        }
        this.refreshCounts()
      }
    }),
    computed: Object.assign(SharedComputed, {
      get(){
        return this.relays
      }
    })
  })
</script>
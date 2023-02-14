<template>
  <RelaysNav />

  <div id="wrapper" 
    class="mx-auto max-w-7xl p-8 lg:p-32 mt-8 bg-black/5 dark:bg-black/20 rounded-lg" 
    v-if="
      (store.tasks.isTaskActive('relays/check') && !store.tasks.getLastUpdate('relays/check'))
      ||
      (store.tasks.isTaskActive('relays/seed') && !store.tasks.getLastUpdate('relays/seed'))
    ">
    <span class="text-3xl">
      Still compiling data, this can take 3-10 minutes if this is your first visit to nostr.watch
    </span>
  </div>  
  <div id="wrapper" class="mx-auto max-w-7xl pt-8" v-if="
    store.tasks.getLastUpdate('relays/check') || store.tasks.getLastUpdate('relays/seed')
  ">  
    
    <h2 class="text-2xl dark:text-white/50">Overview</h2>
    <div class="max-w-full mx-4 py-2 sm:mx-auto sm:px-6 lg:px-8">
      <div class="sm:flex sm:space-x-4">
        <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
          <div class="bg-slate-50  dark:bg-black/30 p-5">
            <div class="sm:flex sm:items-start">
              <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
                <h3 class="text-sm leading-6 font-medium text-gray-400 dark:text-gray-100">Public Relays</h3>
                <p class="text-3xl font-bold text-black  dark:text-white">{{ this.store.relays.getAll.filter( (relay) => this.store.results.get(relay)?.aggregate == 'public').length }}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
          <div class="bg-slate-50 dark:bg-black/30 p-5">
            <div class="sm:flex sm:items-start">
              <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
                <h3 class="text-sm leading-6 font-medium text-gray-400 dark:text-gray-100">Restricted Relays</h3>
                <p class="text-3xl font-bold text-black  dark:text-white">{{ this.store.relays.getAll.filter( (relay) => this.store.results.get(relay)?.aggregate == 'restricted').length }}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
          <div class="bg-slate-50 dark:bg-black/30  p-5">
            <div class="sm:flex sm:items-start">
              <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
                <h3 class="text-sm leading-6 font-medium text-gray-400">Offline Relays</h3>
                <p class="text-3xl font-bold text-black  dark:text-white">{{ this.store.relays.getAll.filter( (relay) => this.store.results.get(relay)?.aggregate == 'offline').length }} </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <h2 class="text-2xl dark:text-white/50">Most Popular</h2>
    <div class="max-w-full mx-4 py-2 sm:mx-auto sm:px-6 lg:px-8">
      <div class="sm:flex sm:space-x-4">
        <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
          <div class="bg-slate-50  dark:bg-black/30 p-5">
            <div class="sm:flex sm:items-start">
              <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
                <h3 class="text-sm leading-6 font-medium text-gray-400 dark:text-gray-100">
                  Software
                </h3>
                <p class="font-bold text-black  dark:text-white">
                  <span class="text-3xl">{{ getMostPopularSoftware?.split('/')[1] }}</span>
                  <span class="text-lg block dark:text-white/50">{{ getMostPopularSoftware?.split('/')[0] }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
        <div class="bg-slate-50 dark:bg-black/30 p-5  block h-full">
          <div class="sm:flex sm:items-start">
            <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
              <h3 class="text-sm leading-6 font-medium text-gray-400 dark:text-gray-100">
                Country
              </h3>
              <p class="text-3xl font-bold text-black  dark:text-white">
                {{ collateCountries?.[0]?.key }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
        <div class="bg-slate-50 dark:bg-black/30  p-5 block h-full">
          <div class="sm:flex sm:items-start">
            <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
              <h3 class="text-sm leading-6 font-medium text-gray-400">
                Continent
              </h3>
              <p class="text-3xl font-bold text-black  dark:text-white">
                {{ collateContinents?.[0]?.key }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <h2 class="text-2xl dark:text-white/50 mb-8 mt-8 lg:mt-16">Tech Breakdown</h2>

  <div class="flex-none px-8 space-x-1 md:flex md:space-x-4 ">
    <div class="flex-none md:flex-1">
      <table class="table-auto w-full m-auto" v-if="collateSupportedNips">
        <thead>
          <tr>
            <th colspan="2" class="bg-slate-200/60 dark:bg-black/40 pt-2 rounded-t-lg">
              <h3 class="text-lg mb-3 dark:text-white/50 font-normal">NIP Support</h3>
            </th>
            <!-- <th class="text-right w-64 py-3 px-1 bg-black/20"><code>Nip</code></th> -->
            <!-- <th class="text-left py-1 px-3 bg-black/40"><code>Relays Supported</code></th> -->
          </tr>
        </thead>
        <tbody class="rounded-b-lg bg-slate-50 dark:bg-black/20">
          <tr v-for="nip in collateSupportedNips" :key="`nip-${nip.key}`">
            <td class="text-right w-1/2  py-2 px-3 dark:text-white/70">{{ nipFormatted(nip.key) }}</td>
            <td class="text-left py-2 px-3 text-2xl"> 
              {{ nip.count }} 
              <span class="italic dark:text-white/25 text-sm">relays</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex-1">
      <table class="table-auto w-full m-auto" v-if="collateSoftware">
        <thead>
          <tr>
            <th colspan="2" class="bg-slate-200/60 dark:bg-black/40 pt-2 rounded-t-lg">
              <h3 class="text-lg mb-3 dark:text-white/50 font-normal">Software Deployed</h3>
            </th>
            <!-- <th class="text-right w-64 py-3 px-1 bg-black/20"><code>Software</code></th>
            <th class="text-left py-1 px-3 bg-black/40"><code>Relays</code></th> -->
          </tr>
        </thead>
        <tbody class="rounded-b-lg bg-slate-50 dark:bg-black/20">
          <tr v-for="sw in collateSoftware" :key="`nip-${sw.key}`">
            <td class="text-right w-1/2 py-2 px-3 dark:text-white/70">{{ sw.key }}</td>
            <td class="text-left py-2 px-3 text-2xl"> {{ sw.count }} <span class="italic text-white/25 text-sm">relays</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2 class="text-2xl dark:text-white/50 mb-8 mt-8 lg:mt-16">Geo Breakdown</h2>

  <div class="flex-none px-8 space-x-1 md:flex md:space-x-4 ">
    <div class="flex-none md:flex-1">
      <table class="table-auto w-full m-auto" v-if="collateCountries">
        <thead>
          <tr>
            <th colspan="2" class="bg-slate-200/60 dark:bg-black/40 pt-2 rounded-t-lg">
              <h3 class="text-lg mb-3 dark:text-white/50 font-normal">Relays by Country</h3>
            </th>
            <!-- <th class="text-right w-64 py-3 px-1 bg-black/20"><code>Nip</code></th> -->
            <!-- <th class="text-left py-1 px-3 bg-black/40"><code>Relays Supported</code></th> -->
          </tr>
        </thead>
        <tbody class="rounded-b-lg bg-slate-50 dark:bg-black/20">
          <tr v-for="item in collateCountries" :key="`country-${item.key}`">
            <td class="text-right w-1/2  py-2 px-3 dark:text-white/70">{{ item.key }}</td>
            <td class="text-left py-2 px-3 text-2xl"> 
              {{ item.count }} 
              <span class="italic text-white/25 text-sm">relays</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex-1">
      <table class="table-auto w-full m-auto">
        <thead>
          <tr>
            <th colspan="2" class="bg-slate-200/60 dark:bg-black/40 pt-2 rounded-t-lg">
              <h3 class="text-lg mb-3 dark:text-white/50 font-normal">Relays by Continent</h3>
            </th>
            <!-- <th class="text-right w-64 py-3 px-1 bg-black/20"><code>Software</code></th>
            <th class="text-left py-1 px-3 bg-black/40"><code>Relays</code></th> -->
          </tr>
        </thead>
        <tbody class="rounded-b-lg bg-slate-50 dark:bg-black/20">
          <tr v-for="item in this.collateContinents" :key="`continent-${item.key}`">
            <td class="text-right w-1/2 py-2 px-3 dark:text-white/70">{{ item.key }}</td>
            <td class="text-left py-2 px-3text-2xl"> {{ item.count }} <span class="italic text-white/25 text-sm">relays</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

    <!-- history 
        growth chart
    Basic:
        tor 
    Software:
        software/versiono    
    nips: 

    geo 

    aggregate stats 
        oldest relay still online 
        newest relay -->
  </div>
</template>
<script>
import { defineComponent, defineAsyncComponent } from 'vue'
import { setupStore } from '@/store'
// import { UserLib } from '@/shared/user-lib.js'
// import { History } from '@/shared/history.js'
// import { relays } from '../../../../relays.yaml'
import RelaysLib from '@/shared/relays-lib'

const RelaysNav = defineAsyncComponent(() =>
    import("@/components/relays/nav/RelaysNav.vue" /* webpackChunkName: "RelaysNav" */)
);

export default defineComponent({

  name: 'RelayStatistics',

  components: {
    RelaysNav
  },

  setup(){
    // const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      // results: results
    }
  },

  beforeMount(){
    this.relays = this.store.relays.getAll
    // this.bySupportedNips = this.collateSupportedNips
    // this.byContinent = this.collateContinents
    // this.byCountry = this.collateCountries
    // this.bySoftware = this.collateSoftware
    // this.store.stats.set('nips', this.bySupportedNips)
    // this.store.stats.set('continents', this.byContinent)
    // this.store.stats.set('countries', this.byCountry)
    // this.store.stats.set('software', this.bySoftware)
  },

  async mounted(){

    // this.remoteTask = await this.historicalData()
    // this.store.stats.setHistory(this.remoteTask)
  },

  unmounted(){
    delete this.remoteTask
  },

  data: function(){
    return {
      relays: null,
      geo: this.store.relays.geo,
      bySupportedNips: null,
      byCountry: null,
      byContinent: null, 
      history: null,
      remoteTask: null,
      results: {},
    }
  },

  props: {
    // resultsProp: {
    //   type: Object,
    //   default(){
    //     return {}
    //   }
    // },
  },

  computed: {
    //PUT OUT TO DRY!
    collateSupportedNips(){
      const dict = new Object()
      Object.entries(this.store.results.all).forEach( (result) => {
        result = result[1]
        if(result?.info?.supported_nips)
          result?.info?.supported_nips.forEach( nip => { 
            if( !(dict[nip] instanceof Set ))
            dict[nip] = new Set()
            dict[nip].add(result.url)
          })
      })
      const result = new Array() 
      Object.keys(dict).forEach( key => {
        result.push({
          key: key, 
          count: dict[key].size 
        })
      })
      // result.sort( (a,b) => b.count-a.count )
      return result
    },
    collateContinents(){
      const byCont = new Object()
      this.relays.forEach( relay => {
        if( !(this.geo[relay] instanceof Object) || typeof this.geo[relay].continentName === 'undefined' ) {
          if( !(byCont.unknown instanceof Set) )
            byCont.unknown = new Set()
          byCont.unknown.add(relay)
          return
        }
        const cont = this.geo[relay].continentName
        if( !(byCont[cont] instanceof Set) )
          byCont[cont] = new Set() 
        byCont[cont].add(relay)
      })
      const result = new Array() 
      Object.keys(byCont).forEach( cont => {
        result.push({
          key: cont, 
          count: byCont[cont].size 
        })
      })
      result.sort( (a,b) => b.count-a.count )
      //console.log('continents', byCont)
      return result;
    },
    collateCountries(){
      const byCountry = new Object()
      this.relays.forEach( relay => {
        if( !(this.geo[relay] instanceof Object) || typeof this.geo[relay].country === 'undefined' ) {
          if( !(byCountry.unknown instanceof Set) )
          byCountry.unknown = new Set()
            byCountry.unknown.add(relay)
          return
        }
        const cont = this.geo[relay].country
        if( !(byCountry[cont] instanceof Set) )
        byCountry[cont] = new Set() 
        byCountry[cont].add(relay)
      })
      const result = new Array()
      Object.keys(byCountry).forEach( country => {
        result.push({
          key: country, 
          count: byCountry[country].size 
        })
      })
      result
        .sort( (a,b) => b.count-a.count )
      //console.log('continents', byCont)
      return result;
    },
    collateSoftware(){
      const bySoftware = new Object()
      this.relays.forEach( relay => {
        if( !this.store.results.get(relay)?.info?.software ) {
          if( !(bySoftware.unknown instanceof Set) )
            bySoftware.unknown = new Set()
          bySoftware.unknown.add(relay)
          return
        }
        const software = this.store.results.get(relay).info.software
        if( !(bySoftware[software] instanceof Set) )
          bySoftware[software] = new Set() 
        bySoftware[software].add(relay)
      })
      let result = new Array()
      Object.keys(bySoftware).forEach( sw => {
        let segments, repo, org
        try {
          segments = new URL(sw).pathname.split('/')
          //console.log(sw, segments.length)
          repo = segments.pop()
          org = segments.pop()
          if(repo == '' || org == '')
            segments = false
        }
        catch(e){ e}

        result.push({
          key: segments ? `${org}/${repo}` : sw,
          count: bySoftware[sw].size 
        })
        
        
      })
      
      result.sort( (a,b) => b.count-a.count )

      return result;
    },
    getMostPopularSoftware(){
      let result
      for(let i=0;i<this.collateSoftware.length;i++){
        if(this.collateSoftware[i].key === 'unknown') 
          continue
        result = this.collateSoftware[i].key
        break
      }
      return result
    },
    nipSignature(){
      return (key) => key.toString().length == 1 ? `0${key}` : key
    },

    nipFormatted(){
      return (key) => `NIP-${this.nipSignature(key)}`
    },
  },

  methods: Object.assign(RelaysLib, {
    
    collateSoftwareVersion(){

    },
  })

})
</script>
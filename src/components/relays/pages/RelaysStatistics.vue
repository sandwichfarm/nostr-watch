<template>
  <RelaysNav 
    v-bind:resultsProp="results" />

  <div id="wrapper" class="mx-auto max-w-7xl">  
    <h2>Relay Access</h2>
    <div class="max-w-full mx-4 py-6 sm:mx-auto sm:px-6 lg:px-8">
      <div class="sm:flex sm:space-x-4">
        <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
          <div class="bg-white  dark:bg-black/30 p-5">
            <div class="sm:flex sm:items-start">
              <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
                <h3 class="text-sm leading-6 font-medium text-gray-400 dark:text-gray-100">Public</h3>
                <p class="text-3xl font-bold text-black  dark:text-white">{{ this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == 'public').length }}</p>
              </div>
            </div>
          </div>
        </div>
      <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
        <div class="bg-white dark:bg-black/30 p-5">
          <div class="sm:flex sm:items-start">
            <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
              <h3 class="text-sm leading-6 font-medium text-gray-400 dark:text-gray-100">Restricted</h3>
              <p class="text-3xl font-bold text-black  dark:text-white">{{ this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == 'restricted').length }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
        <div class="bg-white dark:bg-black/30  p-5">
          <div class="sm:flex sm:items-start">
            <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
              <h3 class="text-sm leading-6 font-medium text-gray-400">Offline</h3>
              <p class="text-3xl font-bold text-black  dark:text-white">{{ this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == 'offline').length }} </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <h2>Most Popular</h2>
    <div class="max-w-full mx-4 py-6 sm:mx-auto sm:px-6 lg:px-8">
      <div class="sm:flex sm:space-x-4">
        <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
          <div class="bg-white  dark:bg-black/30 p-5">
            <div class="sm:flex sm:items-start">
              <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
                <h3 class="text-sm leading-6 font-medium text-gray-400 dark:text-gray-100">
                  Software
                </h3>
                <p class="text-3xl font-bold text-black  dark:text-white">
                  {{ getMostPopularSoftare }}
                </p>
              </div>
            </div>
          </div>
        </div>
      <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
        <div class="bg-white dark:bg-black/30 p-5">
          <div class="sm:flex sm:items-start">
            <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
              <h3 class="text-sm leading-6 font-medium text-gray-400 dark:text-gray-100">
                Country
              </h3>
              <p class="text-3xl font-bold text-black  dark:text-white">
                {{ byCountry?.[0]?.key }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="inline-block align-bottom rounded-lg text-left overflow-hidden shadow transform transition-all mb-4 w-full sm:w-1/3 sm:my-8">
        <div class="bg-white dark:bg-black/30  p-5">
          <div class="sm:flex sm:items-start">
            <div class="text-center sm:mt-0 sm:ml-2 sm:text-left">
              <h3 class="text-sm leading-6 font-medium text-gray-400">
                Continent
              </h3>
              <p class="text-3xl font-bold text-black  dark:text-white">
                {{ byContinent?.[0]?.key }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>


  <table class="table-auto w-128" v-if="bySupportedNips">
  <thead>
    <tr>
      <th class="text-right w-12 py-1 px-1"><code>Nip</code></th>
      <th class="text-left py-1 px-1"><code>Relays Supported</code></th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="nip in bySupportedNips" :key="`nip-${nip.key}`">
      <td class="text-right py-2 px-1">{{ nip.key }}</td>
      <td class="text-left py-2 px-1"> {{ nip.count }} </td>
    </tr>
  </tbody>
</table>



<table class="table-auto w-128">
  <thead>
    <tr>
      <th class="text-right w-12 py-1 px-1"><code>Continent</code></th>
      <th class="text-left py-1 px-1"><code>Relays</code></th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="cont in this.byContinent" :key="`nip-${cont.key}`">
      <td class="text-right py-2 px-1">{{ cont.key }}</td>
      <td class="text-left py-2 px-1"> {{ cont.count }} </td>
    </tr>
  </tbody>
</table>

<table class="table-auto w-128">
  <thead>
    <tr>
      <th class="text-right w-12 py-1 px-1"><code>Country</code></th>
      <th class="text-left py-1 px-1"><code>Relays</code></th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="country in this.byCountry" :key="`nip-${country.key}`">
      <td class="text-right py-2 px-1">{{ country.key }}</td>
      <td class="text-left py-2 px-1"> {{ country.count }} </td>
    </tr>
  </tbody>
</table>


<table class="table-auto w-128">
  <thead>
    <tr>
      <th class="text-right w-12 py-1 px-1"><code>Software</code></th>
      <th class="text-left py-1 px-1"><code>Relays</code></th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="sw in this.bySoftware" :key="`nip-${sw.key}`">
      <td class="text-right py-2 px-1">{{ sw.key }}</td>
      <td class="text-left py-2 px-1"> {{ sw.count }} </td>
    </tr>
  </tbody>
</table>

    <pre>

    </pre>
  

    <!-- NIP-15
    <pre>
      {{this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == 'public').filter( relay => this.results?.[relay]?.info?.supported_nips.includes(15)).length }}
    </pre>

    <pre>
      {{ this.store.relays.getAll.length }} 
    </pre> -->

    <pre>
       
    </pre>

    <pre>
       
    </pre>
    
    <pre>
      
    </pre>
<!-- 
    <pre>
      {{ store.stats.get('history')  }}
    </pre>

    <pre>
      {{ store.stats.get('countries')  }}
    </pre>

    <pre>
      {{ store.stats.get('nips')  }}
    </pre>

    <pre>
      {{ store.stats.get('continents')  }}
    </pre>

    <pre>
      {{   }}
    </pre> -->

    <pre>
      {{ this.collateSupportedNips  }}
    </pre>

    <!-- <pre>
      {{ this.collateContinents  }}
    </pre>
   
    <pre>
      {{ collateCountries }}
    </pre>
     -->
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
    this.relays.forEach(relay => {
      this.results[relay] = this.getCache(relay)
    })
    this.bySupportedNips = this.collateSupportedNips
    this.byContinent = this.collateContinents
    this.byCountry = this.collateCountries
    this.bySoftware = this.collateSoftware
    this.store.stats.set('nips', this.bySupportedNips)
    this.store.stats.set('continents', this.byContinent)
    this.store.stats.set('countries', this.byCountry)
    this.store.stats.set('software', this.bySoftware)
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
      relays: this.store.relays.getAll,
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
      Object.entries(this.results).forEach( (result) => {
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
        if( !this.results?.[relay]?.info?.software ) {
          if( !(bySoftware.unknown instanceof Set) )
            bySoftware.unknown = new Set()
          bySoftware.unknown.add(relay)
          return
        }
        const software = this.results[relay].info.software
        if( !(bySoftware[software] instanceof Set) )
          bySoftware[software] = new Set() 
        bySoftware[software].add(relay)
      })
      let result = new Array()
      Object.keys(bySoftware).forEach( sw => {
        let segments, repo, org
        if(sw != 'unknown'){
          segments = new URL(sw).pathname.split('/')
          repo = segments.pop()
          org = segments.pop()
        }
        result.push({
          key: segments ? `${org}/${repo}` : sw,
          count: bySoftware[sw].size 
        })
      })
      
      result.sort( (a,b) => b.count-a.count )

      return result;
    },
    getMostPopularSoftare(){
      let result
      for(let i=0;i<this.bySoftware.length;i++){
        if(this.bySoftware[i].key === 'unknown') 
          continue
        result = this.bySoftware[i].key
        break
      }
      return result
    }
  },

  methods: Object.assign(RelaysLib, {
    
    collateSoftwareVersion(){

    },
  })

})
</script>
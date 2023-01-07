<template>
  <div>

    <pre>
      {{  }}
    </pre>
  

    <!-- NIP-15
    <pre>
      {{this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == 'public').filter( relay => this.results?.[relay]?.info?.supported_nips.includes(15)).length }}
    </pre>

    <pre>
      {{ this.store.relays.getAll.length }} 
    </pre> -->


    <pre>
      {{ this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == 'public').length }} 
    </pre>

    <pre>
      {{ this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == 'restricted').length }} 
    </pre>
    
    <pre>
      {{ this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == 'offline').length }} 
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

    <!-- <pre>
      {{ this.collateSupportedNips  }}
    </pre>

    <pre>
      {{ this.collateContinents  }}
    </pre>
   
    <pre>
      {{ collateCountries }}
    </pre> -->
    
    history 
        growth chart
    Basic:
        <!-- total
        online
        restricted -->
        tor 
        <!-- offline -->
    Software:
        software/versiono    
    nips: 
        <!-- OK support by nips  -->
    geo 
        <!-- by country  -->
        <!-- continent  -->
    aggregate stats 
        oldest relay still online 
        newest relay
  </div>
</template>
<script>
import { defineComponent, toRefs } from 'vue'
import { setupStore } from '@/store'
// import { UserLib } from '@/shared/user-lib.js'
// import { History } from '@/shared/history.js'

export default defineComponent({

  name: 'RelayStatistics',

  components: {},

  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
    }
  },

  beforeMount(){
    
  },

  async mounted(){
    this.store.stats.set('nips', this.collateSupportedNips)
    this.store.stats.set('continents', this.collateContinents)
    this.store.stats.set('countries', this.collateCountries)
    this.remoteTask = await this.historicalData()
    this.store.stats.setHistory(this.remoteTask)
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
      remoteTask: null
    }
  },

  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
  },

  computed: {
    collateSupportedNips(){
      const nips = new Object()
      Object.entries(this.results).forEach( (result) => {
        result = result[1]
        if(result?.info?.supported_nips)
          result?.info?.supported_nips.forEach( nip => { 
            if( !(nips[nip] instanceof Set ))
              nips[nip] = new Set()
            nips[nip].add(result.uri)
          })
      })
      console.log('supported nips', nips)
      return nips
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
      console.log('continents', byCont)
      return byCont;
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
      console.log('countries', byCountry)
      return byCountry;
    },
  },

  methods: Object.assign({
    collateSoftware(){
      // const software = new Object()
    },

    collateSoftwareVersion(){

    },
  })

})
</script>
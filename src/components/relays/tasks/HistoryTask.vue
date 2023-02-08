<template>
  <span class="text-inherit" v-if="this.store.tasks.getActiveSlug === slug">
    Analyzing Data
  </span>
</template>
<script>
import { defineComponent, toRefs } from 'vue'
import { setupStore } from '@/store'
import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

// import { History } from '@/shared/history.js'

export default defineComponent({

  name: 'HistoryTask',

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
    this.invalidate()
  },

  unmounted(){
  },

  data: function(){
    return {
      relays: this.store.relays.getAll,
      geo: this.store.relays.geo,
      slug: 'relays/stats'
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

  methods: Object.assign(RelaysLib, {
    invalidate: async function(){
      if(!this.isExpired(''))
      console.log('stats invalidate()')
      this.queueJob(
        this.slug,
        () => {
          console.log('stats run()')
          this.store.stats.nips = this.collateSupportedNips
          this.store.stats.continents = this.collateContinents 
          this.store.stats.countries = this.collateCountries 
          this.store.stats.software = this.collateSoftware 
          this.store.tasks.completeJob()
        },
        true
      )
      // if( !this.isExpired('relays/seed', 5*1000) || !this.isExpired('relays/check', 5*1000) )
      // {
      //   this.queueJob(
      //     'relays/stats',
      //     () => {
      //       this.store.stats.set( 'nips', this.collateSupportedNips )
      //       this.store.stats.set( 'continents', this.collateContinents )
      //       this.store.stats.set( 'countries', this.collateCountries )
      //       this.store.stats.set( 'countries', this.collateSoftware )
      //       this.store.tasks.completeJob()
      //     },
      //     true
      //   )
      // }
    },
  }),

  computed: Object.assign(SharedComputed, {
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
      return result
    },
    collateContinents(){
      const byCont = new Object()
      this.relays.forEach( relay => {
        if( !(this.geo?.[relay] instanceof Object) || typeof this.geo?.[relay].continentName === 'undefined' ) {
          if( !(byCont.unknown instanceof Set) )
            byCont.unknown = new Set()
          byCont.unknown.add(relay)
          return
        }
        const cont = this.geo?.[relay].continentName
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
        if( !(this.geo?.[relay] instanceof Object) || typeof this.geo?.[relay].country === 'undefined' ) {
          if( !(byCountry.unknown instanceof Set) )
          byCountry.unknown = new Set()
            byCountry.unknown.add(relay)
          return
        }
        const cont = this.geo?.[relay].country
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
        try {
          segments = new URL(sw).pathname.split('/')
          console.log(sw, segments.length)
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
      for(let i=0;i<this.bySoftware.length;i++){
        if(this.bySoftware[i].key === 'unknown') 
          continue
        result = this.bySoftware[i].key
        break
      }
      return result
    },
  }),

  
})
</script>
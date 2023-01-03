<template>
    history 
        growth chart
    Basic:
        total
        online
        restricted
        tor 
        offline
    Software:
        software/versiono    
    nips: 
        OK support by nips 
    geo 
        by country 
        continent 
    aggregate stats 
        oldest relay still online 
        newest relay
    

</template>
<script>
import { defineComponent, toRefs } from 'vue'
import { setupStore } from '@/store'

export default defineComponent({
  name: 'RelayControlComponent',
  components: {RefreshComponent},
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
    }
  },
  mounted(){
  }
  data: function(){
    return {
      relays: this.store.relays.getAll,
      geo: this.store.relays.getGeo
    }
  }
  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
  },
  methods: {
    collateSupportedNips(){
      const nips = new Object()
      Object.entries(this.results).forEach( (result) => {
        if(result?.info?.supported_nips)
          supported_nips.forEach( nip => { 
            if( !(nips[nip] instanceof Array ))
              nips[nip] = new Set
            nips[nip].add(result.uri)
          })
      })
      console.log('supported nips', nips)
      return nips
    },
    collateSoftware(){
      const software = new Object()
    },
    collateSoftwareVersion(){

    },
    collateContinents(){
      const byCont = new Object()
      this.relays.forEach( relay => {
        if( !(this.geo[relay] instanceof Object) )  {
          if( !(byCont.unknown instanceof Set) )
            byCont.unknown = new Set()
          byCont.unknown.add(relay)
        }
        const cont = this.geo[relay].continentName
        if( !(byCont[cont] instanceof Set) )
          byCont[cont] = new Set() 
        byCont[cont].add(relay)
      })
      console.log('continents', byCont)
      return byCont;
    },
    async getRelayHistory(){
      //subscribe kind 3
    }
  }
})
</script>
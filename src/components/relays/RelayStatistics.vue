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
        support by nips 
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
  props: {
      resultsProp: {
        type: Object,
        default(){
          return {}
        }
      },
    },
    methods: {
        
    }
})


</script>
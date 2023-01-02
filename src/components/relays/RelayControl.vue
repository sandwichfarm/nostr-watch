<template>
    <div class="flex bg-slate-600 text-right flex-row-reverse align-middle ">  
        <div class="flex-none h-8 align-middle ">
            <RefreshComponent
                v-bind:resultsProp="results" />
        </div>
    </div>
</template>

<script>
import RefreshComponent from '@/components/relays/RefreshComponent.vue'
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
})
</script>
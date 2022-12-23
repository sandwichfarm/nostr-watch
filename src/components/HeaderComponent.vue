<template>
  <row container :gutter="12">
    <column :xs="12" :md="12" :lg="12" class="title-card">
      <h1>nostr.watch<sup>{{version}}</sup></h1>
    </column>
  </row>
  
  <row container :gutter="12">
    <column :xs="12" :md="12" :lg="12" class="title-card">
      <NavComponent :relays="relays" />
    </column>
  </row>
</template>
<script>
import { version } from '../../package.json'

import { defineComponent} from 'vue'
import NavComponent from './NavComponent.vue'
export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'GroupByNone',
  components: {
    NavComponent,
  },

  props: {
    relays: {
      type: Array,
      default(){
        return []
      }
    },
  },
  data(){
    return {
      version: version
    }
  }
})
</script>
<template>
  <Row container :gutter="12">
    <Column :xs="12" :md="12" :lg="12" class="title-card">
      <h1>nostr.watch<sup>{{version}}</sup></h1>
    </Column>
  </Row>
  
  <Row container :gutter="12">
    <Column :xs="12" :md="12" :lg="12" class="title-card">
      <NavComponent />
    </Column>
  </Row>

  
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
  props: {},
  data(){
    return {
      version: version
    }
  }
})
</script>
<template>
  <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateStatusClass(relay)"></span></td>

  <td class="left-align relay-url" @click="copy(relay)">{{ relay }}</td>
  <td :key="generateKey(relay, 'didConnect')"><span :class="getStatusClass(relay, 'didConnect')"></span></td>
  <td :key="generateKey(relay, 'didRead')"><span :class="getStatusClass(relay, 'didRead')"></span></td>
  <td :key="generateKey(relay, 'didWrite')"><span :class="getStatusClass(relay, 'didWrite')"></span></td>
  <td>{{status[relay].flag}}</td>
  <td><span v-if="status[relay].didConnect">{{ status[relay].latency }}<span v-if="status[relay].latency">ms</span></span></td>
  <td>
    <Popper v-if="Object.keys(status[relay].messages).length">
      {{ status[relay].type }}
      <button @mouseover="showPopper">log</button>
      <template #content>
        <ul>
          <li v-for="(message, key) in status[relay].messages" :key="generateKey(relay, key)">{{key}}</li>
        </ul>
      </template>
    </Popper>
  </td>
</template>

<script>
import { defineComponent} from 'vue'
export default defineComponent({
  name: 'RelaySingle',
  components: {
    Popper
  },
  props: [
    'relay',
    'status',
  ]
  data() {
    return {}
  }
})
</script>

<template>
  <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateResultClass(relay)"></span></td>
  <td class="left-align relay-url" @click="copy(relay)">{{ relay }}</td>
  <td>
    <span v-tooltip:top.tooltip="nip05List(relay)"> <span class="verified-shape-wrapper" v-if="result[relay].nips[5]"><span class="shape verified"></span></span></span>
  </td>
  <!-- <td>{{result[relay].flag}}</td> -->
  <td><span>{{ result[relay].latency.final }}<span v-if="result[relay].check.latency">ms</span></span></td>
  <td :key="generateKey(relay, 'check.connect')"><span :class="getResultClass(relay, 'connect')"></span></td>
  <td :key="generateKey(relay, 'check.read')"><span :class="getResultClass(relay, 'read')"></span></td>
  <td :key="generateKey(relay, 'check.write')"><span :class="getResultClass(relay, 'write')"></span></td>
  <td>
    <ul v-if="result[relay].observations && result[relay].observations.length">
      <li class="observation" v-for="(alert) in result[relay].observations" :key="generateKey(relay, alert.description)">
        <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'notice'">✉️</span>
        <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'caution'">⚠️</span>
      </li>
    </ul>
  </td>
  <td>{{ setCheck(connections[relay].nip(15)) }}</td>
  <td>{{ setCheck(connections[relay].nip(20)) }}</td>
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

<template>
  <tr><td colspan="11"><h2><span class="indicator badge readwrite">{{ query('public').length }}</span>Public</h2></td></tr>
  <tr class="online public"  v-if="query('public').length > 0">
    <th class="table-column status-indicator"></th>
    <th class="table-column relay"></th>
    <th class="table-column verified"><span class="verified-shape-wrapper"><span class="shape verified"></span></span></th>
    <!-- <th class="table-column location" v-tooltip:top.tooltip="Ping">
      🌎
    </th> -->
    <th class="table-column latency" v-tooltip:top.tooltip="'Relay Latency on Read'">
      ⌛️
    </th>
    <th class="table-column connect" v-tooltip:top.tooltip="'Relay connection status'">
      🔌
    </th>
    <th class="table-column read" v-tooltip:top.tooltip="'Relay read status'">
      👁️‍🗨️
    </th>
    <th class="table-column write" v-tooltip:top.tooltip="'Relay write status'">
      ✏️
    </th>
    <th class="table-column info" v-tooltip:top.tooltip="'Additional information detected regarding the relay during processing'">
      ℹ️
    </th>
    <th class="table-column nip nip-15" v-tooltip:top.tooltip="'Does the relay support NIP-15'">
      NIP-15
    </th>
    <th class="table-column nip nip-20" v-tooltip:top.tooltip="'Does the relay support NIP-20'">
      NIP-20
    </th>
    <!-- <th>FILTER: LIMIT</th> -->
  </tr>
  <tr v-for="relay in query('public')" :key="{relay}" :class="getLoadingClass(relay)" class="online public">

    <!-- <td>{{ setCaution(result[relay].didSubscribeFilterLimit) }}</td> -->
  </tr>
</template>

<script>
import { defineComponent} from 'vue'
export default defineComponent({
  name: 'RelaySingle',
  components: {
    Popper
  },

  data() {

  }
})
</script>

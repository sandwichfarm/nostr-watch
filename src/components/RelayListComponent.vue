<template>
  <h2><span class="indicator badge readwrite">{{ query('public').length }}</span>Public</h2>
  <table class="online"  v-if="query('public').length > 0">
    <tr>
      <th></th>
      <th></th>
      <th>🔌</th>
      <th>👁️‍🗨️</th>
      <th>✏️</th>
      <th>🌎</th>
      <!-- <td>wl</td>
      <td>nip-05><td> -->
      <th>⌛️</th>
      <th>ℹ️</th>
    </tr>
    <tr v-for="relay in query('public')" :key="{relay}" :class="getLoadingClass(relay)">
      <RelaySingle
        :relay="{{relay}}"
        :didConnect="{{didConnect}}"
        :didRead="{{didRead}}"
        :didWrite="{{didWrite}}"
      />
    </tr>
  </table>
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

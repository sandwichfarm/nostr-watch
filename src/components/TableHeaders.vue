<template>
  <th class="table-column status-indicator">
    
  </th>
  <th class="table-column relay">
    
  </th>
  <th class="table-column verified">
    <span class="verified-shape-wrapper">
      <span class="shape verified"></span>
    </span>
  </th>
  <th class="table-column location" v-tooltip:top.tooltip="Ping">
    🌎
  </th>
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
</template>
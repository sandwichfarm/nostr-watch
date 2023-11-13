<template>
  <th class="table-Column status-indicator">
    
  </th>
  <th class="table-Column relay">
    
  </th>
  <th class="table-Column verified">
    <span class="verified-shape-wrapper">
      <span class="shape verified"></span>
    </span>
  </th>
  <th class="table-Column location" v-tooltip:top.tooltip="Ping">
    🌎
  </th>
  <th class="table-Column latency" v-tooltip:top.tooltip="'Relay Latency on Read'">
    ⌛️
  </th>
  <th class="table-Column connect" v-tooltip:top.tooltip="'Relay connection status'">
    🔌
  </th>
  <th class="table-Column read" v-tooltip:top.tooltip="'Relay read status'">
    👁️‍🗨️
  </th>
  <th class="table-Column write" v-tooltip:top.tooltip="'Relay write status'">
    ✏️
  </th>
</template>
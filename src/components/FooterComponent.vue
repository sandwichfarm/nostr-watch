<template>
  <section id="footer">
    <span>Updated {{ refreshData.sinceLast }} ago</span>
    <span><button @click="invalidate(true)">Update Now</button></span>
    <span><input type="checkbox" id="checkbox" v-model="preferences.refresh" /><label for="">Refresh Automatically</label></span>
    <span v-if="preferences.refresh"> Next refresh in: {{ refreshData.untilNext }}</span>
    <span v-if="preferences.refresh">
      Refresh Every

      <input type="radio" id="1w" :value="1000*60*60*24*7" v-model="cacheExpiration" />
      <label for="1w">1 Week</label>

      <input type="radio" id="1d" :value="1000*60*60*24" v-model="cacheExpiration" />
      <label for="1d">1 day</label>

      <input type="radio" id="30m" :value="1000*60*30" v-model="cacheExpiration" />
      <label for="30m">30 minutes</label>

      <input type="radio" id="10m" :value="1000*60*10" v-model="cacheExpiration" />
      <label for="10m">10 minutes</label>

      <input type="radio" id="1m" :value="1000*60" v-model="cacheExpiration" />
      <label for="1m">1 Minute</label>
    </span>
  </section>
</template>

<script>
</script>
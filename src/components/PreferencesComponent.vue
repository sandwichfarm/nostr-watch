<template>
  <section id="preferences-toggle">
    <button @click="toggle">⚙️</button>
    <section id="preferences" :class="{active:isActive}">
      <span><input type="checkbox" id="checkbox" v-model="preferences.refresh" /><label for="">Refresh Automatically</label></span>
      <span v-if="preferences.refresh">
        Refresh Every
        <ul>
          <li>
            <input type="radio" id="1w" :value="1000*60*60*24*7" v-model="preferences.cacheExpiration" />
            <label for="1w">1 Week</label>
          </li>
          <li>
            <input type="radio" id="1d" :value="1000*60*60*24" v-model="preferences.cacheExpiration" />
            <label for="1d">1 day</label>
          </li>
          <li>
            <input type="radio" id="30m" :value="1000*60*30" v-model="preferences.cacheExpiration" />
            <label for="30m">30 minutes</label>
          </li>
          <li>
            <input type="radio" id="10m" :value="1000*60*10" v-model="preferences.cacheExpiration" />
            <label for="10m">10 minutes</label>
          </li>
        </ul>        
      </span>
      <button @click="clearData">Clear local data</button>
    </section>
    
  </section>
</template>

<style scoped>
section#preferences {
  display:none;
}
section#preferences.active {
  display:block;
}

section#preferences-toggle {
  position:relative;
  text-align:left;
}

section#preferences {
  position:absolute;
  top:40px;
  left:0px;
  padding: 5px 10px;
  background:#f5f5f5;
  width:200px;

}
section#preferences > span {
  display:block;
  margin: 5px 0 0;
}

ul, li {
  list-style:none;
  padding:0;
  margin:0;
}

button {
  cursor: pointer;
  padding:0; 
  margin:0;
  background: transparent;
  border: none; 
}
</style>

<script>
import { defineComponent } from 'vue'
import { useStorage } from "vue3-storage";

import RelaysLib from '../lib/relays-lib.js'

const localMethods = {
  toggle() {
     this.isActive = !this.isActive;
  },
  clearData(){
    this.relays.forEach( relay => {
      // console.log('clearing', relay)
      this.removeCache(`${relay}`)
      this.removeCache(`${relay}_inbox`)
    })
  }
}

export default defineComponent({
  name: 'PreferencesComponent',
  components: {},
  mounted(){

    this.storage = useStorage()
    this.preferences = this.getCache('preferences') || this.preferences
  },
  updated(){
    this.setCache('preferences')
  },
  computed: {},
  methods: Object.assign(localMethods, RelaysLib),
  props: {
    relays: {
      type: Array,
      default(){
        return []
      }
    }
  },
  data() {
    return {
      storage: null,
      refresh: true,
      preferences: {
        refresh: true,
        cacheExpiration: 30*60*1000
      },
      isActive: false,
    }
  },
})
</script>


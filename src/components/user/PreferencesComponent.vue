<template>
  <section id="preferences-toggle">
    <button @click="toggle">⚙️</button>
    <section id="preferences" :class="{active:isActive}">
      <span><input type="checkbox" id="checkbox" v-model="store.prefs.refresh" /><label for="">Refresh Automatically</label></span>
      <span v-if="store.prefs.refresh">
        Refresh Every
        <ul>
          <li>
            <input type="radio" id="1w" :value="1000*60*60*24*7" v-model="store.prefs.duration" />
            <label for="1w">1 Week</label>
          </li>
          <li>
            <input type="radio" id="1d" :value="1000*60*60*24" v-model="store.prefs.duration" />
            <label for="1d">1 day</label>
          </li>
          <li>
            <input type="radio" id="30m" :value="1000*60*30" v-model="store.prefs.duration" />
            <label for="30m">30 minutes</label>
          </li>
          <li>
            <input type="radio" id="10m" :value="1000*60*10" v-model="store.prefs.duration" />
            <label for="10m">10 minutes</label>
          </li>
        </ul>        
      </span>
      <button @click="clearData">Clear local data</button>
    </section>
    
  </section>
</template>

<script>
import { defineComponent } from 'vue'
import RelaysLib from '../shared/relays-lib.js'
import { store } from '@/store'


const localMethods = {
  toggle() {
     this.isActive = !this.isActive;
  },
  clearData(){
    this.store.relays.clearResults()
  }
}

export default defineComponent({
  name: 'PreferencesComponent',
  components: {},
  setup(){
    return { 
      store : {
        relays: store.useRelaysStore(),
        prefs: store.usePrefsStore() 
      }
    }
  },
  mounted(){
    // this.preferences = this
  },
  updated(){
    // this.setCache('preferences')
  },
  computed: {},
  methods: Object.assign(localMethods, RelaysLib),
  props: {},
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

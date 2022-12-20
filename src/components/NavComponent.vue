<template>
<nav class="menu">
  <ul>
    <!-- <router-link :to="`/`" active-class="active" :class="">Home</router-link> -->
    <a href="https://github.com/dskvr/nostr-watch/edit/main/relays.yaml" target="_blank">Add Relay</a>
    <a href="relays.json"><code>{...}</code></a>
    <span>
      <PreferencesComponent :relays="relays" />
    </span>

  </ul>
</nav>
</template>
<style scoped>
nav.menu {
  position:relative;
  z-index:10;
}
nav span,
nav.menu a {
  display: inline-block;
}

nav.menu a { 
  text-decoration: none;

  margin: 0 22px 0 0;
  padding:5px 10px;
  color:#000;
  border-bottom: 1px dotted #999;
}

nav.menu a.active { 
  background:#000;
  color: #fff;
  border: none;
}

nav.menu a:hover { 
  background: #f0f0f0;
}

</style>
<script>
import { defineComponent } from 'vue'
import PreferencesComponent from '../components/PreferencesComponent.vue'
export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'NavComponent',
  components: {
    PreferencesComponent,
  },
  props: {
    relays: {
      type: Array,
      default(){
        return []
      }
    }
  }
});
</script>

<template>
  <HeaderComponent />
  <div class="flex min-h-screen" style="background-color#16171d">
    <div class="flex-1 min-h-screen">
      <main class="min-h-screen">
        <router-view></router-view>
      </main>
    </div>
  </div>
</template>

<script>
import HeaderComponent from '@/components/layout/HeaderComponent.vue'
import { useHead } from '@vueuse/head'

export default {
  name: 'App',
  components: {
    HeaderComponent,
    // SidebarComponent
  },
  setup () {
    useHead({
      title: 'nostr.watch',
      meta: [
        {
          name: `description`,
          content: 'A robust client-side nostr relay monitor. Find fast nostr relays, view them on a map and monitor the network status of nostr.',
        },
      ],
    })
  }
}
</script>

<style>
body { 
  margin: 0 !important; 
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
#fork-me {
  position:absolute;
  top: 0px;
  right:0px;
  /* z-index: 9999; */
}
</style>

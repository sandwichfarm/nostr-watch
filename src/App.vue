<template>
  <router-view></router-view>
  <a id="fork-me" href="https://github.com/dskvr/nostr-watch"><img decoding="async" loading="lazy" width="149" height="149" src="https://github.blog/wp-content/uploads/2008/12/forkme_right_darkblue_121621.png?resize=149%2C149" class="attachment-full size-full" alt="Fork me on GitHub" data-recalc-dims="1"></a>
</template>

<script>
import { useMeta } from 'vue-meta'

export default {
  name: 'App',
  components: {},
  setup () {
    useMeta({
      title: 'nostr.watch registry & monitor',
      htmlAttrs: { lang: 'en', amp: true }
    })
  }
}
</script>

<style>
body { margin: 0 !important; }
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
#fork-me {
  position:absolute;
  top: 0px;
  right:0px;
  z-index: 9999;
}
</style>

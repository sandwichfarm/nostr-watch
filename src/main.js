import { createApp } from 'vue'
import App from './App.vue'
import Vue3Storage from "vue3-storage";
import { createHead } from '@vueuse/head'
import router from './router'
import "./styles/main.scss"
import directives from "./directives/"
import {Tabs, Tab} from 'vue3-tabs-component';
import { plugin as storePlugin } from './store'
import { RelayPool } from 'nostr'
// import { relays } from '../relays.yaml'

const app = createApp(App)
  .use(router)
  .use(storePlugin)
  .use(createHead())
  .use(Vue3Storage, { namespace: "nw_result_" })
  .component('tabs', Tabs)
  .component('tab', Tab)

directives(app);

// app.config.globalProperties.$pool = new RelayPool([relays])
app.config.globalProperties.$pool = new RelayPool(['wss://nostr.ch'])

await router.isReady()

app.mount('#app')
import { createApp } from 'vue'
import App from './App.vue'
import Vue3Storage from "vue3-storage";

import router from './router'
import "./styles/main.scss"
import directives from "./directives/"
// import titleMixin from './mixins/titleMixin'
import {Tabs, Tab} from 'vue3-tabs-component';
import { plugin as storePlugin } from './store'
import { createMetaManager } from 'vue-meta'
import { RelayPool } from 'nostr'
// import { relays } from '../relays.yaml'
// import VueIdentifyNetwork from 'vue-identify-network';

const app = createApp(App)
  .use(router)
  .use(storePlugin)
  // .use(VueIdentifyNetwork)
  .use(createMetaManager())
  .use(Vue3Storage, { namespace: "nw_result_" })
  .component('tabs', Tabs)
  .component('tab', Tab)

directives(app);

app.config.globalProperties.$pool = new RelayPool(['wss://relay.damus.io'])

await router.isReady()

app.mount('#app')
import { createApp } from 'vue'
import App from './App.vue'
// import Vue3Storage from "vue3-storage";

import router from './router'
import "./styles/main.scss"
import directives from "./directives/"
// import titleMixin from './mixins/titleMixin'
import {Tabs, Tab} from 'vue3-tabs-component';
import { plugin as storePlugin } from './store'
import { createMetaManager } from 'vue-meta'

const app = createApp(App)
  .use(router)
  .use(storePlugin)
  .use(createMetaManager())
  // .use(Vue3Storage, { namespace: "nostrwatch_" })
  .component('tabs', Tabs)
  .component('tab', Tab)

directives(app);

await router.isReady()

app.mount('#app')
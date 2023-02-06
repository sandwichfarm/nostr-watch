import { createApp } from 'vue'
import App from './App.vue'
import Vue3Storage from "vue3-storage";
import { createHead } from '@vueuse/head'
import router from './router'
import "./styles/main.scss"
import directives from "./directives/"
import { plugin as storePlugin } from './store'
import crypto from 'crypto'
import dotenv from 'dotenv'
dotenv.config()

const app = createApp(App)
  .use(router)
  .use(storePlugin)
  .use(createHead())
  .use(Vue3Storage, { namespace: "nw_result_" })
  // .use(VueInputAutowidth)

directives(app);

app.config.globalProperties.$tabId = crypto.randomBytes(40).toString('hex')

app.config.globalProperties.$filters = []

await router.isReady()

app.mount('#app')
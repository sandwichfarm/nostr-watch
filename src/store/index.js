import { createPinia } from 'pinia'
import { createPersistedStatePlugin } from 'pinia-plugin-persistedstate-2'

import { useRelaysStore } from './relays.js'
import { usePrefsStore } from './prefs.js'

export const plugin = (app) => {
  const pinia = createPinia()

  const installPersistedStatePlugin = createPersistedStatePlugin()
  pinia.use((context) => installPersistedStatePlugin(context))

  app.use(pinia)
}

export const setupStore = function(){
  return {
    relays: useRelaysStore(),
    prefs: usePrefsStore()
  }
}

export const store = {
    useRelaysStore,
    usePrefsStore
}

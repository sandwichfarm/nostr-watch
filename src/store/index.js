import { createPinia } from 'pinia'
import { createPersistedStatePlugin } from 'pinia-plugin-persistedstate-2'

import { useRelaysStore } from './relays.js'
import { usePrefsStore } from './prefs.js'
import { useLayoutStore } from './layout.js'
import { useUserStore } from './user.js'

export const plugin = (app) => {
  const pinia = createPinia()

  const installPersistedStatePlugin = createPersistedStatePlugin()
  pinia.use((context) => installPersistedStatePlugin(context))

  app.use(pinia)
}

export const setupStore = function(){
  return {
    relays: useRelaysStore(),
    prefs: usePrefsStore(),
    layout: useLayoutStore(),
    user: useUserStore()
  }
}

export const store = {
    useRelaysStore,
    usePrefsStore
}

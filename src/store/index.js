import { createPinia } from 'pinia'
import { createPersistedStatePlugin } from 'pinia-plugin-persistedstate-2'

import { useRelaysStore } from './relays.js'
import { usePrefsStore } from './prefs.js'
import { useLayoutStore } from './layout.js'
import { useUserStore } from './user.js'
import { useStatStore } from './stats.js'
import { useTaskStore } from './tasks.js'

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
    user: useUserStore(),
    stats: useStatStore(),
    tasks: useTaskStore(),
  }
}

export const store = {
    useRelaysStore,
    usePrefsStore
}

import { createPinia } from 'pinia'
import { createPersistedStatePlugin } from 'pinia-plugin-persistedstate-2'
import { PiniaSharedState } from 'pinia-shared-state';

import { useRelaysStore } from './relays.js'
import { useResultsStore } from './results.js'
import { usePrefsStore } from './prefs.js'
import { useLayoutStore } from './layout.js'
import { useUserStore } from './user.js'
import { useStatStore } from './stats.js'
import { useTaskStore } from './tasks.js'
import { useProfileStore } from './profiles.js'
import { useStatusStore } from './status.js'
import { useFilterStore } from './filters.js'


export const plugin = (app) => {
  const pinia = createPinia()

  const installPersistedStatePlugin = createPersistedStatePlugin()
  pinia.use((context) => installPersistedStatePlugin(context))

  // Pass the plugin to your application's pinia plugin
  pinia.use(
    PiniaSharedState({
      // Enables the plugin for all stores. Defaults to true.
      enable: true,
      // If set to true this tab tries to immediately recover the shared state from another tab. Defaults to true.
      initialize: false,
      // Enforce a type. One of native, idb, localstorage or node. Defaults to native.
      type: 'localstorage',
    }),
  );

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
    profile: useProfileStore(),
    status: useStatusStore(),
    filters: useFilterStore(),
    results: useResultsStore(),
  }
}
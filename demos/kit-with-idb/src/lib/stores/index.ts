export * from './relayStore'
export * from './checksStore'
export * from './monitorStore'
export * from './checkStatStore'
export * from './localCheckStore'
export * from './nip11Store'
export * from './preferencesStore'

export * from './utils'

import { preferencesStore } from './preferencesStore'

export let preferences = {}; 

preferencesStore.subscribe(_preferences => {
  preferences = _preferences;
})

export const storeKey = (relay: string, monitorPubkey?: string) => {
  if(!preferences?.primaryMonitor) alert('none')
  return `${monitorPubkey || preferences.primaryMonitor}:${relay}`
}
import { populateChecksStore } from './checksStore'
import { populateRelaysStore } from './relayStore'

export const populateStores = () => {
  populateRelaysStore()
  populateChecksStore()
}
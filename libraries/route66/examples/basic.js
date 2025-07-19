import N66 from '@nostrwatch/route66'

import DexieAdapter from '@nostrwatch/route66-cacheadapter-dexie'

const n66 = new N66()

// Initialize the library
n66.init()
  .then(() => {
    ////console.log('NIP-66 initialized successfully.')
  })
  .catch(err => {
    console.error('Initialization failed:', err)
  })

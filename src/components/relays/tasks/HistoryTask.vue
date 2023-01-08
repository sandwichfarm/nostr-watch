<script>
import { defineComponent, toRefs } from 'vue'
import { setupStore } from '@/store'
import { SharedComputed } from '@/shared/computed.js'
// import { UserLib } from '@/shared/user-lib.js'
// import { History } from '@/shared/history.js'

export default defineComponent({

  name: 'RelayStatistics',

  components: {},

  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
    }
  },

  beforeMount(){
    
  },

  async mounted(){
    this.invalidate()
  },

  unmounted(){
    delete this.remoteTask
  },

  data: function(){
    return {
      relays: this.store.relays.getAll,
      geo: this.store.relays.geo,
      bySupportedNips: null,
      byCountry: null,
      byContinent: null, 
      history: null,
      remoteTask: null
    }
  },

  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
  },

  computed: Object.assign(SharedComputed, {
    collateSupportedNips(){
      const nips = new Object()
      Object.entries(this.results).forEach( (result) => {
        result = result[1]
        if(result?.info?.supported_nips)
          result?.info?.supported_nips.forEach( nip => { 
            if( !(nips[nip] instanceof Set ))
              nips[nip] = new Set()
            nips[nip].add(result.uri)
          })
      })
      //console.log('supported nips', nips)
      return nips
    },
    collateContinents(){
      const byCont = new Object()
      this.relays.forEach( relay => {
        if( !(this.geo[relay] instanceof Object) || typeof this.geo[relay].continentName === 'undefined' ) {
          if( !(byCont.unknown instanceof Set) )
            byCont.unknown = new Set()
          byCont.unknown.add(relay)
          return
        }
        const cont = this.geo[relay].continentName
        if( !(byCont[cont] instanceof Set) )
          byCont[cont] = new Set() 
        byCont[cont].add(relay)
      })
      //console.log('continents', byCont)
      return byCont;
    },
    collateCountries(){
      const byCountry = new Object()
      this.relays.forEach( relay => {
        if( !(this.geo[relay] instanceof Object) || typeof this.geo[relay].country === 'undefined' ) {
          if( !(byCountry.unknown instanceof Set) )
          byCountry.unknown = new Set()
            byCountry.unknown.add(relay)
          return
        }
        const cont = this.geo[relay].country
        if( !(byCountry[cont] instanceof Set) )
        byCountry[cont] = new Set() 
        byCountry[cont].add(relay)
      })
      //console.log('countries', byCountry)
      return byCountry;
    },
    import { RelayPool } from 'nostr'

    setHistory(){
      let   relays = [],
            relaysKnown = [],
            relaysRemote = {},
            // remove = [],
            uniques = null,
            relayTimeCodes = {}

      const run = async function(){
        //discover relays [kind:3], "remoteRelays"
        await discover().catch( err => console.warn(err) )

        //Sanitize knownRelays to prevent dupes in uniques
        sanitizeKnownRelays()

        //sanitize remoteRelays
        sanitizeRemoteRelays()

        //check remoteRelays
        // await checkRemoteRelays()

        //Remove offline remoteRelays
        // removeOfflineRelays()

        //Combine knownRelays and remoteRelays
        concatRelays()

        //set uniques
        uniques = new Set(relays)

        //console.log(uniques, uniques.size)

        const final = []

        uniques.forEach( relay => {
          if( !(relayTimeCodes[relay] instanceof Array) ) 
            return 
          relayTimeCodes[relay].sort( (a, b) => a - b )
          final.push( [relay, relayTimeCodes[relay][0] ] )
        })

        //console.log('before sort', final[0])

        final.sort( (a, b) => a[1]-b[1] )

        //console.log('afdter sort', final[0])

        return final 
      }

      const concatRelays = function(){
        relays = relaysKnown.concat(relaysRemote)
      }

      const discover = async () => {
        relaysKnown = this.store.relays.getAll
        
        return new Promise(resolve => {
          let total = 0
          const subid = crypto.randomBytes(40).toString('hex')
          const pool = RelayPool(this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == 'public').filter( relay => this.results?.[relay]?.info?.supported_nips.includes(15)))
          pool
            .on('open', relay => {
              // //console.log('open')
              relay.subscribe(subid, {since: 1609829, limit: 10000, kinds:[3]})
            })
            .on('eose', (relay) => {
              //console.log('closing', relay.url)
              relay.close()
              resolve(true)
            })
            .on('event', (relay, _subid, event) => {
              if(subid == _subid) {
                //console.log(total++)
                try { 
                  // //console.log(event)
                  const parsed = JSON.parse(event.content)
                  relaysRemote = Object.assign(relaysRemote, parsed)
                  Object.keys(parsed).forEach( key => {
                    if( !(relayTimeCodes[key] instanceof Array) )
                      relayTimeCodes[key] = new Array()
                    relayTimeCodes[key].push(event.created_at)
                  })
                  relay.close()
                } catch(e) {
                  console.error(e)
                }
              }
            })

          setTimeout( () => {
            pool.close()
            resolve(true) 
          }, 10*1000 )
        })
      }

      const sanitizeRemoteRelays = function(){
        const remote1 = Object.entries(relaysRemote)
                    .filter( relay => Array.isArray(relay) )
                    .map( relay => sanitizeRelay(relay[0]) )
                    .filter( relay => relay.startsWith('wss://') )
                    .filter( relay => !relay.includes('localhost') )

        const remote2 = Object.entries(relaysRemote)
                    .filter( relay => relay instanceof String )
                    .map( relay => sanitizeRelay(relay) )
                    .filter( relay => relay.startsWith('wss://') )
                    .filter( relay => !relay.includes('localhost') )

        relaysRemote = remote1.concat(remote2)
      }

      const sanitizeKnownRelays = function(){
        relaysKnown = relaysKnown.map( relay => sanitizeRelay(relay) ) //Known relays may have trailing slash
      }

      const sanitizeRelay = function(relay) {
        return relay
                .toLowerCase()
                .trim()
                .replace(/\s\t/g, '')
                .replace(/\/+$/, '')
                .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, '');
      }

      // const checkRemoteRelays = async function(){
      //   for(let i=0;i<relaysRemote.length;i++) {
      //     // //console.log('check for connect', remoteMerged[i])
      //     await checkRelay(relaysRemote[i])
      //             .catch( () => {
      //               remove.push(relaysRemote[i])
      //               //console.log('removals:', remove.length, relaysRemote[i])
      //             })
      //   }
      // }

      // const checkRelay = async function(relay){
      //   return new Promise( (resolve, reject) => {
      //     let socket = new Relay(relay)
      //         socket
      //           .on('open', relay => {
      //             relay
      //             socket.close()
      //             resolve()
      //           })
      //           .on('error', reject )
      //     setTimeout( reject, 500 )
      //   })
      // }

      // const removeOfflineRelays = function(){
      //   relaysRemote = relaysRemote.filter( relay => !remove.includes(relay) )
      // }

      return run()
    }
    }
  }),

  methods: Object.assign(RelaysLib, {
    invalidate: async function(){
      if( !this.store.tasks.isAnyProcessing && this.isExpired() ) {
        this.store.tasks.startProcessing('history')
        this.store.stats.set( 'nips', this.collateSupportedNips )
        this.store.tasks.addProcessed('history', 'nips')
        this.store.stats.set( 'continents', this.collateContinents )
        this.store.tasks.addProcessed('history', 'continents')
        this.store.stats.set( 'countries', this.collateCountries )
        this.store.tasks.addProcessed( 'history', 'countries' )
        this.remoteTask = await this.historicalData()
        this.store.tasks.addProcessed( 'history', 'firstSeen' )
        // this.store.stats.setHistory(remoteTask)
        this.store.tasks.finishProcessing( 'history' )
      }
    },
    collateSoftware(){ 
      // const software = new Object()
    },
    collateSoftwareVersion(){

    },
  })
})
</script>
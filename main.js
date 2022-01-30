import {createApp, h} from 'vue'
import {relayConnect} from 'nostr-tools/relay'

const App = {
  data() {
    return {
      relays: [
        'wss://nostr-pub.wellorder.net',
        'wss://relayer.fiatjaf.com',
        'wss://nostr.rocks',
        'wss://rsslay.fiatjaf.com',
        'wss://nostr-relay.herokuapp.com',
        "wss://freedom-relay.herokuapp.com/ws",
        "wss://nodestr-relay.dolu.dev/ws",
        "wss://nostrrr.bublina.eu.org",
        "wss://nostr-relay.freeberty.net",
        "wss://nostr.bitcoiner.social",
        "wss://nostr-relay.wlvs.space",
        "wss://nostr.onsats.org",
        "wss://nostr-relay.untethr.me"
      ],
      status: {}
    }
  },

  mounted() {
    this.connections = {}
    this.relays.forEach(async url => {
      this.status[url] = {}

      try {
        let conn = relayConnect(
          url,
          () => {},
          () => {
            this.status[url].didConnect = false
          }
        )
        this.status[url].didConnect = true

        try {
          await conn.publish({
            id: '41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0',
            pubkey:
              '5a462fa6044b4b8da318528a6987a45e3adf832bd1c64bd6910eacfecdf07541',
            created_at: 1640305962,
            kind: 1,
            tags: [],
            content: 'running branle',
            sig: '08e6303565e9282f32bed41eee4136f45418f366c0ec489ef4f90d13de1b3b9fb45e14c74f926441f8155236fb2f6fef5b48a5c52b19298a0585a2c06afe39ed'
          })
          this.status[url].didPublish = true
        } catch (err) {
          this.status[url].didPublish = false
        }

        let {unsub} = conn.sub(
          {
            cb: () => {
              this.status[url].didQuery = true
              unsub()
              clearTimeout(willUnsub)
            },
            filter: {
              ids: ['41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0']
            }
          },
          'nostr-registry'
        )
        let willUnsub = setTimeout(() => {
          unsub()
          this.status[url].didQuery = false
        }, 3000)
      } catch (err) {
        this.status[url].didConnect = false
      }
    })
  },

  render() {
    return h('table', {style: {fontSize: '28px'}}, [
      h('tr', [h('th'), h('th', 'connect'), h('th', 'read'), h('th', 'write')]),
      ...this.relays.map(url =>
        h('tr', [
          h('th', {style: {textAlign: 'right'}}, url),
          ...['didConnect', 'didQuery', 'didPublish'].map(attr =>
            h(
              'td',
              {
                style: {
                  fontSize: '50px',
                  textAlign: 'center',
                  padding: '5px 35px',
                  color:
                    this.status?.[url]?.[attr] === true
                      ? 'green'
                      : this.status?.[url]?.[attr] === false
                      ? 'red'
                      : 'silver'
                }
              },
              '•'
            )
          )
        ])
      ),
      h('tr', [
        h('th', {style: {textAlign: 'right'}}, 'Your relay here:'),
        h('th', {colSpan: 3}, [
          h(
            'a',
            {
              href: 'https://github.com/fiatjaf/nostr-relay-registry',
              style: {color: 'black'}
            },
            '________________'
          )
        ])
      ])
    ])
  }
}

createApp(App).mount('#app')

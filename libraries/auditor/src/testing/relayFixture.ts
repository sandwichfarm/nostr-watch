import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocketServer, WebSocket } from 'ws'
import { verifyEvent } from 'nostr-tools/pure'
import { generateTestKeypair, signTestEvent } from '#utils/signing.js'
import type { Note, INip01Filter } from '#src/nips/Nip01/interfaces/index.js'

/** Each fault changes a single externally observable relay behavior. */
export type RelayFault =
  | 'unknown-filter' | 'reject-unknown-filter' | 'ignore-ids' | 'empty-list'
  | 'filter-and' | 'multi-filter' | 'exclusive-bounds' | 'oldest-first' | 'reverse-ties'
  | 'limit-zero-history' | 'limit-live' | 'merge-subscriptions' | 'ignore-close'
  | 'global-subscriptions' | 'accept-invalid' | 'retain-replaced' | 'store-ephemeral'
  | 'collapse-addresses' | 'duplicate-storage' | 'missing-eose' | 'unrelated-eose'
  | 'lowercase-tags' | 'index-tail' | 'malformed-ok' | 'ok-no-prefix' | 'malformed-event'
  | 'compact-prefix' | 'changing-parent'

export interface RelayFixtureOptions {
  faults?: RelayFault[]
  child?: 'reject' | 'alias' | 'distinct' | 'replica' | 'silent' | 'empty'
  rejectWrites?: boolean
  rejectWritesAfter?: number
  events?: Note[]
  path?: string
}

export function fixtureEvents(): Note[] {
  const first = generateTestKeypair(new Uint8Array(32).fill(1))
  const second = generateTestKeypair(new Uint8Array(32).fill(2))
  const timestamp = Math.floor(Date.now() / 1000) - 10
  return [0, 1, 2, 3, 4, 5].map((i) => signTestEvent({
    kind: i % 2 === 0 ? 1 : 7,
    created_at: timestamp - Math.floor(i / 2),
    tags: [['t', i % 2 === 0 ? 'alpha' : 'beta'], ['T', 'uppercase', 'unindexed']],
    content: `fixture-${i}`,
  }, i < 3 ? first.secretKey : second.secretKey))
}

/** Enough independent authors/timestamps to satisfy every legacy sampler. */
export function populatedFixtureEvents(): Note[] {
  return Array.from({ length: 40 }, (_, index) => signTestEvent({
    kind: 1, created_at: Math.floor(Date.now() / 1000) - 300 + index,
    tags: [['t', 'pipeline-fixture']], content: `pipeline-${index}`,
  }, generateTestKeypair(new Uint8Array(32).fill(index % 10 + 1)).secretKey))
}

export async function createRelayFixture(options: RelayFixtureOptions = {}) {
  const faults = new Set(options.faults ?? [])
  const path = options.path ?? '/relay'
  const events = [...(options.events ?? fixtureEvents())]
  const distinctEvents = fixtureEvents().slice(0, 1).map(event => ({ ...event }))
  // A distinct child returns a separately signed event, never an artificial identity flag.
  distinctEvents[0] = signTestEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000),
    tags: [], content: 'separate child relay' }, generateTestKeypair(new Uint8Array(32).fill(3)).secretKey)
  const received: { path: string, message: any[] }[] = []
  const requests: string[] = []
  let writes = 0
  const subscriptions = new Map<WebSocket, Map<string, INip01Filter[]>>()
  const connections = new Map<WebSocket, { path: string, store: Note[] }>()
  const server = createServer((_req, response) => { response.writeHead(404); response.end() })
  const wss = new WebSocketServer({ noServer: true })

  const matches = (event: Note, filter: INip01Filter): boolean => {
    const checks: boolean[] = []
    for (const [key, value] of Object.entries(filter)) {
      if (key === 'limit') continue
      if (key === 'since' || key === 'until') {
        const inclusive = !faults.has('exclusive-bounds')
        checks.push(key === 'since'
          ? inclusive ? event.created_at >= value : event.created_at > value
          : inclusive ? event.created_at <= value : event.created_at < value)
      } else if (key === 'ids' || key === 'authors' || key === 'kinds' || /^#[a-zA-Z]$/.test(key)) {
        if (key === 'ids' && faults.has('ignore-ids')) continue
        const values = value as (string | number)[]
        if (values.length === 0 && faults.has('empty-list')) continue
        checks.push(key.startsWith('#')
          ? event.tags.some(tag => (faults.has('lowercase-tags') ? tag[0].toLowerCase() === key.slice(1).toLowerCase() : tag[0] === key.slice(1)) &&
            (faults.has('index-tail') ? tag.slice(1).some(value => values.includes(value)) : values.includes(tag[1])))
          : values.includes(key === 'ids' ? event.id : key === 'authors' ? event.pubkey : event.kind))
      } else if (faults.has('unknown-filter')) checks.push(false)
    }
    return faults.has('filter-and') && checks.length > 0 ? checks.some(Boolean) : checks.every(Boolean)
  }

  const matchesAny = (event: Note, filters: INip01Filter[]) => faults.has('multi-filter')
    ? filters.every(filter => matches(event, filter)) : filters.some(filter => matches(event, filter))

  const send = (socket: WebSocket, frame: any[]) => {
    if (frame[0] === 'OK' && faults.has('malformed-ok')) frame = frame.slice(0, 3)
    if (frame[0] === 'OK' && frame[2] === false && faults.has('ok-no-prefix')) frame = [...frame.slice(0, 3), 'rejected']
    if (frame[0] === 'OK' && frame[2] === false && faults.has('compact-prefix')) frame = [...frame.slice(0, 3), frame[3].replace(': ', ':')]
    if (frame[0] === 'EVENT' && faults.has('malformed-event')) frame = [...frame.slice(0, 2), { ...frame[2], content: 'tampered' }]
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame))
  }

  const storeEvent = (store: Note[], event: Note) => {
    if (event.kind >= 20000 && event.kind < 30000 && !faults.has('store-ephemeral')) return
    if (store.some(note => note.id === event.id) && !faults.has('duplicate-storage')) return
    const replaceable = event.kind === 0 || event.kind === 3 || (event.kind >= 10000 && event.kind < 20000)
    const addressable = event.kind >= 30000 && event.kind < 40000
    if ((replaceable || addressable) && !faults.has('retain-replaced')) {
      const d = (note: Note) => note.tags.find(tag => tag[0] === 'd')?.[1] ?? ''
      const sameAddress = (note: Note) => note.pubkey === event.pubkey && note.kind === event.kind &&
        (!addressable || faults.has('collapse-addresses') || d(note) === d(event))
      const existing = store.find(sameAddress)
      if (existing && (existing.created_at > event.created_at ||
        (existing.created_at === event.created_at && existing.id < event.id))) return
      for (let i = store.length - 1; i >= 0; i--) if (sameAddress(store[i])) store.splice(i, 1)
    }
    store.push(event)
  }

  server.on('upgrade', (request, socket, head) => {
    requests.push(request.url!)
    const pathname = new URL(request.url!, 'http://fixture').pathname
    const child = pathname !== path && pathname.startsWith(`${path.replace(/\/$/, '')}/`)
    if (pathname !== path && (!child || (options.child ?? 'reject') === 'reject')) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      return
    }
    wss.handleUpgrade(request, socket, head, ws => {
      const store = child && options.child === 'replica' ? [...events]
        : child && options.child === 'distinct' ? distinctEvents
        : child && options.child === 'empty' ? [] : events
      connections.set(ws, { path: pathname, store })
      subscriptions.set(ws, new Map())
      ws.on('close', () => { subscriptions.delete(ws); connections.delete(ws) })
      ws.on('message', raw => {
        const message = JSON.parse(raw.toString()) as any[]
        received.push({ path: pathname, message })
        if (child && options.child === 'silent') return
        const [type, id, ...rest] = message
        if (type === 'REQ') {
          const filters = rest as INip01Filter[]
          if (faults.has('reject-unknown-filter') && filters.some(filter => Object.keys(filter)
            .some(key => !['ids', 'authors', 'kinds', 'since', 'until', 'limit'].includes(key) && !/^#[a-zA-Z]$/.test(key)))) {
            send(ws, ['CLOSED', id, 'unsupported: unknown filter field'])
            return
          }
          if (faults.has('global-subscriptions')) {
            for (const subs of subscriptions.values()) subs.delete(id)
          }
          const subs = subscriptions.get(ws)!
          subs.set(id, faults.has('merge-subscriptions') ? [...(subs.get(id) ?? []), ...filters] : filters)
          const result = new Map<string, Note>()
          for (const filter of filters) {
            let selected = store.filter(event => faults.has('multi-filter') ? matchesAny(event, filters) : matches(event, filter))
              .sort((a, b) => (faults.has('oldest-first') ? a.created_at - b.created_at : b.created_at - a.created_at) ||
                (faults.has('reverse-ties') ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id)))
            if (typeof filter.limit === 'number' && !(filter.limit === 0 && faults.has('limit-zero-history'))) {
              selected = selected.slice(0, filter.limit)
            }
            for (const event of selected) result.set(event.id, event)
          }
          for (const event of result.values()) {
            const copies = faults.has('duplicate-storage') ? store.filter(note => note.id === event.id).length : 1
            for (let i = 0; i < copies; i++) send(ws, ['EVENT', id, event])
          }
          if (!faults.has('missing-eose')) send(ws, ['EOSE', faults.has('unrelated-eose') ? 'unrelated-subscription' : id])
          if (faults.has('changing-parent') && pathname === path) {
            storeEvent(store, signTestEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000),
              tags: [], content: `changing-${received.length}` }, generateTestKeypair().secretKey))
          }
        } else if (type === 'CLOSE') {
          if (!faults.has('ignore-close')) subscriptions.get(ws)!.delete(id)
        } else if (type === 'EVENT') {
          const event = id as Note
          let valid = false
          try { valid = verifyEvent(event) } catch { /* Invalid event shape. */ }
          if (!valid && !faults.has('accept-invalid')) {
            send(ws, ['OK', event.id, false, 'invalid: bad event'])
            return
          }
          if (options.rejectWrites || (options.rejectWritesAfter !== undefined && writes >= options.rejectWritesAfter)) {
            send(ws, ['OK', event.id, false, 'restricted: read only'])
            return
          }
          writes++
          storeEvent(store, event)
          for (const [other, subs] of subscriptions) {
            if (connections.get(other)?.store !== store) continue
            for (const [subId, filters] of subs) {
              if (faults.has('limit-live') && filters.some(filter => filter.limit !== undefined)) continue
              if (matchesAny(event, filters)) send(other, ['EVENT', subId, event])
            }
          }
          send(ws, ['OK', event.id, true, ''])
        }
      })
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}${path}`
  return {
    url, events, received, connections, requests,
    async close() {
      for (const socket of wss.clients) socket.terminate()
      await new Promise<void>(resolve => wss.close(() => resolve()))
      await new Promise<void>(resolve => server.close(() => resolve()))
    },
  }
}

/**
 * CVM Smoke Test (Client-side)
 *
 * Connects to the running CVM server over Nostr via MCP, lists tools,
 * calls health/ping, relays/list, relays/state, and performs a
 * short-lived subscription.
 */

import { Client } from '@modelcontextprotocol/sdk/client'
import type { Notification } from '@modelcontextprotocol/sdk/types'
import {
  NostrClientTransport,
  ApplesauceRelayPool,
  PrivateKeySigner,
} from '@contextvm/sdk'

function env(name: string, required = true): string | undefined {
  const v = process.env[name]
  if (required && (!v || v.trim() === '')) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return v
}

async function main() {
  const serverPubkey = env('SMOKE_SERVER_PUBKEY')!
  const relays = (env('SMOKE_RELAYS') || 'wss://relay.nostr.watch').split(',').map(s => s.trim()).filter(Boolean)
  const clientKey = env('SMOKE_CLIENT_KEY', false) || '' // Optional; SDK will generate if empty

  console.log('Smoke config:', { serverPubkey, relays })

  // Build MCP client
  const client = new Client({
    name: 'cvm-smoke-client',
    version: '0.0.1',
  })

  // Build Nostr transport
  const signer = new PrivateKeySigner(clientKey)
  const relayPool = new ApplesauceRelayPool(relays)
  const transport = new NostrClientTransport({
    signer,
    relayHandler: relayPool,
    serverPubkey,
  })

  // Capture notifications
  const notifications: Notification[] = []
  client.onNotification = (n: Notification) => {
    notifications.push(n)
    console.log('Notification:', JSON.stringify(n, null, 2))
  }

  try {
    console.log('Connecting to CVM...')
    await client.connect(transport)
    console.log('Connected.')

    // List tools
    const tools = await client.listTools()
    console.log('Tools:', tools.tools.map(t => t.name))

    // health/ping
    const health = await client.callTool({ name: 'health/ping', arguments: {} })
    console.log('health/ping:', JSON.stringify(health, null, 2))

    // relays/list
    const list = await client.callTool({ name: 'relays/list', arguments: { limit: 5 } })
    console.log('relays/list:', JSON.stringify(list, null, 2))

    // Try relays/state on first item
    let firstRelayUrl: string | undefined
    try {
      const parsed = (typeof list === 'string') ? JSON.parse(list) : list
      const relaysArr = parsed?.relays || parsed?.content?.[0]?.json?.relays || []
      firstRelayUrl = relaysArr[0]?.relayUrl
    } catch {}

    if (firstRelayUrl) {
      const state = await client.callTool({ name: 'relays/state', arguments: { relayUrl: firstRelayUrl } })
      console.log('relays/state:', JSON.stringify(state, null, 2))
    } else {
      console.log('No relays returned from relays/list to query get_state.')
    }

    // Labels: discover namespaces and values, then exercise grouping/search
    try {
      const allLabels = await client.callTool({ name: 'relays/labels/list', arguments: {} })
      console.log('relays/labels/list:', JSON.stringify(allLabels, null, 2))

      const allLabelsObj = (typeof allLabels === 'string') ? JSON.parse(allLabels) : allLabels
      const namespaces: string[] = allLabelsObj?.namespaces || allLabelsObj?.content?.[0]?.json?.namespaces || []
      if (namespaces.length > 0) {
        const ns = namespaces[0]
        const nsLabelsResp = await client.callTool({ name: 'relays/labels/list', arguments: { namespace: ns } })
        console.log(`relays/labels/list (namespace=${ns}):`, JSON.stringify(nsLabelsResp, null, 2))

        const nsLabelsObj = (typeof nsLabelsResp === 'string') ? JSON.parse(nsLabelsResp) : nsLabelsResp
        const values: string[] = nsLabelsObj?.labels?.[ns] || nsLabelsObj?.content?.[0]?.json?.labels?.[ns] || []
        if (values.length > 0) {
          const value = values[0]
          const byLabel = await client.callTool({ name: 'relays/by/label', arguments: { namespace: ns, value, limit: 5 } })
          console.log(`relays/by/label (${ns}:${value}):`, JSON.stringify(byLabel, null, 2))

          const searchWithLabel = await client.callTool({
            name: 'relays/search',
            arguments: { labels: [{ namespace: ns, value }], limit: 5 },
          })
          console.log('relays/search (with label):', JSON.stringify(searchWithLabel, null, 2))
        }
      }
    } catch (err) {
      console.warn('Label/grouping tests skipped or failed:', err)
    }

    // Groupings by NIP and country
    try {
      const byNip = await client.callTool({ name: 'relays/by/nip', arguments: { nip: 11, minSupport: 0.3 } })
      console.log('relays/by/nip:', JSON.stringify(byNip, null, 2))
    } catch (err) {
      console.warn('by_nip failed:', err)
    }
    try {
      const byCountry = await client.callTool({ name: 'relays/by/country', arguments: {} })
      console.log('relays/by/country:', JSON.stringify(byCountry, null, 2))
    } catch (err) {
      console.warn('by_country failed:', err)
    }

    // Availability tools
    try {
      const online = await client.callTool({ name: 'relays/online', arguments: { onlineWindowSeconds: 3600 } })
      console.log('relays/online:', JSON.stringify(online, null, 2))
    } catch (err) {
      console.warn('online failed:', err)
    }
    try {
      const offline = await client.callTool({ name: 'relays/offline', arguments: { offlineThresholdSeconds: 3600, deadThresholdSeconds: 7 * 24 * 3600 } })
      console.log('relays/offline:', JSON.stringify(offline, null, 2))
    } catch (err) {
      console.warn('offline failed:', err)
    }
    try {
      const dead = await client.callTool({ name: 'relays/dead', arguments: { deadThresholdSeconds: 7 * 24 * 3600 } })
      console.log('relays/dead:', JSON.stringify(dead, null, 2))
    } catch (err) {
      console.warn('dead_probably failed:', err)
    }

    // Subscription: broad filter with thresholds
    try {
      const subResp = await client.callTool({
        name: 'relays/subscribe_state',
        arguments: {
          network: 'clearnet',
          thresholds: { rttDeltaMs: 50, supportDelta: 0.1 },
        },
      })
      console.log('relays/subscribe_state:', JSON.stringify(subResp, null, 2))

      // Let it run for a short time to capture notifications
      await new Promise((r) => setTimeout(r, 5000))

      // Extract subscriptionId from response (handles json/text shapes)
      let subscriptionId: string | undefined
      try {
        const parsed = (typeof subResp === 'string') ? JSON.parse(subResp) : subResp
        subscriptionId = parsed?.subscriptionId || parsed?.content?.[0]?.json?.subscriptionId
      } catch {}

      if (subscriptionId) {
        const unsub = await client.callTool({ name: 'relays/unsubscribe', arguments: { subscriptionId } })
        console.log('relays/unsubscribe:', JSON.stringify(unsub, null, 2))
      } else {
        console.log('Could not parse subscriptionId from subscribe_state response.')
      }
    } catch (err) {
      console.warn('Subscription test skipped or failed:', err)
    }

    console.log('Smoke test complete. Notifications received:', notifications.length)
  } finally {
    try { await transport.close() } catch {}
  }
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})

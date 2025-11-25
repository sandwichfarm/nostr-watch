/**
 * Full Smoke Test - Tests both MCP (Nostr) and REST API interfaces
 *
 * Tests both transport layers to ensure parity and functionality.
 */

import { Client } from '@modelcontextprotocol/sdk/client'
import type { Notification } from '@modelcontextprotocol/sdk/types'
import {
  NostrClientTransport,
  ApplesauceRelayPool,
  PrivateKeySigner,
} from '@contextvm/sdk'
import { spawn, type ChildProcess } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as pathJoin } from 'node:path'

function env(name: string, required = true): string | undefined {
  const v = process.env[name]
  if (required && (!v || v.trim() === '')) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return v
}

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

const results: TestResult[] = []

function recordTest(name: string, passed: boolean, duration: number, error?: string) {
  results.push({ name, passed, duration, error })
  const status = passed ? '✓' : '✗'
  const timing = `(${duration}ms)`
  console.log(`${status} ${name} ${timing}`)
  if (error) {
    console.error(`  Error: ${error}`)
  }
}

/**
 * Wait for server to be ready (first computeAll() complete)
 */
async function waitForReady(restUrl: string, timeoutMs: number = 30000): Promise<void> {
  const startTime = Date.now()
  const pollInterval = 500 // Check every 500ms

  console.log('\n⏳ Waiting for server to be ready...')

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${restUrl}/health/ping`)
      if (response.ok) {
        const health = await response.json()
        if (health.ready === true) {
          const elapsed = Date.now() - startTime
          console.log(`✓ Server ready after ${elapsed}ms\n`)
          return
        }
      }
    } catch (err) {
      // Server not yet listening, continue polling
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error(`Server did not become ready within ${timeoutMs}ms`)
}

async function testMCP() {
  console.log('\\n=== Testing MCP/Nostr Interface ===\\n')

  const serverPubkey = env('SMOKE_SERVER_PUBKEY', false)
  if (!serverPubkey) {
    console.log('⚠️  SMOKE_SERVER_PUBKEY not set, skipping MCP tests')
    return
  }

  // Use nak in-memory relay or override with SMOKE_RELAYS
  const relays = (env('SMOKE_RELAYS', false) || 'ws://localhost:6969').split(',').map(s => s.trim()).filter(Boolean)

  // Helper: probe HTTP on a given host:port to determine if something is listening
  async function probeHttp(host: string, port: string, timeoutMs = 800): Promise<boolean> {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`http://${host}:${port}/`, { signal: controller.signal })
      clearTimeout(t)
      return true // any HTTP response implies port is up
    } catch {
      clearTimeout(t)
      return false
    }
  }

  // Helper: ensure a local nak relay is running (starts it if needed)
  async function ensureLocalRelay(): Promise<{ proc?: ChildProcess, url?: string } | null> {
    const localWs = relays.filter(r => {
      try {
        const u = new URL(r)
        return u.protocol === 'ws:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
      } catch { return false }
    })
    if (localWs.length === 0) return null // nothing to manage

    // If any local relay is already up, do nothing
    for (const wsUrl of localWs) {
      const u = new URL(wsUrl)
      const port = u.port || '80'
      if (await probeHttp(u.hostname, port)) return null
    }

    // Attempt to start nak for the first local ws relay
    const u = new URL(localWs[0])
    const port = u.port || '6969'
    const logPath = pathJoin(tmpdir(), `nak-relay-${port}.log`)
    console.log(`⚙️  Starting local nak relay on ws://${u.hostname}:${port} (log: ${logPath})`)

    try {
      const proc = spawn('nak', ['serve', '--port', port], { stdio: ['ignore', 'pipe', 'pipe'] })
      const logStream = createWriteStream(logPath, { flags: 'a' })
      proc.stdout?.pipe(logStream)
      proc.stderr?.pipe(logStream)

      // Wait for port to come up (up to ~5s)
      const start = Date.now()
      while (Date.now() - start < 5000) {
        if (await probeHttp(u.hostname, port)) {
          console.log('✓ Local nak relay is up')
          return { proc, url: `ws://${u.hostname}:${port}` }
        }
        await new Promise(r => setTimeout(r, 200))
      }

      console.log('✗ Failed to detect local relay after starting nak')
      try { proc.kill() } catch {}
      return null
    } catch (err) {
      console.log('⚠️  Unable to start nak relay automatically. Install nak: go install github.com/fiatjaf/nak@latest')
      return null
    }
  }

  // Ensure local relay (if requested via ws://localhost). If not available and cannot start, we will skip MCP.
  const started = await ensureLocalRelay()
  const startedProc = started?.proc
  const startedUrl = started?.url

  // If no local relay is available after attempt, skip MCP tests with guidance
  try {
    const localWs = relays.filter(r => {
      try {
        const u = new URL(r)
        return u.protocol === 'ws:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
      } catch { return false }
    })
    if (localWs.length > 0) {
      let anyUp = false
      for (const ws of localWs) {
        const u = new URL(ws)
        if (await probeHttp(u.hostname, u.port || '80')) { anyUp = true; break }
      }
      if (!anyUp) {
        console.log('⚠️  No local Nostr relay detected and auto-start failed or is unavailable.')
        console.log('   Skipping MCP tests. Start a local relay (e.g., "nak serve --port 6969") or run test/run-smoke-tests.sh')
        return
      }
    }
  } catch {}
  // Generate unique client key for each test run if not provided
  const clientKey = env('SMOKE_CLIENT_KEY', false) || ''

  const client = new Client({
    name: 'smoke-test-mcp',
    version: '0.0.1',
  })

  const signer = new PrivateKeySigner(clientKey)
  const relayPool = new ApplesauceRelayPool(relays)
  const transport = new NostrClientTransport({
    signer,
    relayHandler: relayPool,
    serverPubkey,
  })

  const notifications: Notification[] = []
  client.onNotification = (n: Notification) => {
    notifications.push(n)
  }

  try {
    // Connect
    let start = Date.now()
    await client.connect(transport)
    recordTest('MCP: Connect', true, Date.now() - start)

    // List tools
    start = Date.now()
    const tools = await client.listTools()
    recordTest('MCP: List tools', tools.tools.length > 0, Date.now() - start)

    // Health check
    start = Date.now()
    const health = await client.callTool({ name: 'health/ping', arguments: {} })
    recordTest('MCP: health/ping', !!health, Date.now() - start)

    // Relays list
    start = Date.now()
    let relaysArr: any[] = []
    try {
      const list = await client.callTool({ name: 'relays/list', arguments: { limit: 5 } })
      const listParsed = (typeof list === 'string') ? JSON.parse(list) : list

      // Try multiple response formats
      relaysArr = listParsed?.relays || listParsed?.content?.[0]?.json?.relays || []

      // Check if response is in content[0].text format (standard MCP)
      if (relaysArr.length === 0 && listParsed?.content?.[0]?.text) {
        try {
          const textParsed = JSON.parse(listParsed.content[0].text)
          relaysArr = textParsed.relays || []
        } catch {}
      }

      recordTest('MCP: relays/list', relaysArr.length > 0, Date.now() - start)
    } catch (err) {
      recordTest('MCP: relays/list', false, Date.now() - start, String(err))
    }

    // Get state
    if (relaysArr.length > 0) {
      start = Date.now()
      const firstRelayUrl = relaysArr[0]?.relayUrl
      const state = await client.callTool({ name: 'relays/get_state', arguments: { relayUrl: firstRelayUrl } })
      recordTest('MCP: relays/get_state', !!state, Date.now() - start)
    }

    // Search
    start = Date.now()
    const search = await client.callTool({ name: 'relays/search', arguments: { limit: 5 } })
    recordTest('MCP: relays/search', !!search, Date.now() - start)

    // Labels
    start = Date.now()
    const labels = await client.callTool({ name: 'relays/list_labels', arguments: {} })
    recordTest('MCP: relays/list_labels', !!labels, Date.now() - start)

    // By NIP
    start = Date.now()
    const byNip = await client.callTool({ name: 'relays/by_nip', arguments: { nip: 1 } })
    recordTest('MCP: relays/by_nip', !!byNip, Date.now() - start)

    // Online relays
    start = Date.now()
    const online = await client.callTool({ name: 'relays/online', arguments: { onlineWindowSeconds: 3600 } })
    recordTest('MCP: relays/online', !!online, Date.now() - start)

    // DISABLED: Subscription test
    // Subscription functionality has been disabled
    recordTest('MCP: subscribe/unsubscribe', true, 0, 'SKIPPED: Subscriptions disabled')

  } catch (err) {
    recordTest('MCP: Overall', false, 0, String(err))
  } finally {
    try { await transport.close() } catch {}
    // Clean up local nak relay if we started it
    try { if (startedProc && !startedProc.killed) { startedProc.kill() } } catch {}
  }
}

async function testREST() {
  console.log('\\n=== Testing REST API Interface ===\\n')

  const restUrl = env('SMOKE_REST_URL', false) || 'http://localhost:3000'

  async function fetchJSON(path: string, options: RequestInit = {}) {
    // Build full URL - path already includes query string
    const fullUrl = `${restUrl}${path}`

    // Only add Content-Type header if there's a body
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) }
    if (options.body) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(fullUrl, {
      headers,
      ...options,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`)
    }
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await response.text()
      throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 200)}`)
    }
    return response.json()
  }

  try {
    // Health check
    let start = Date.now()
    const health = await fetchJSON('/health/ping')
    recordTest('REST: GET /health/ping', !!health, Date.now() - start)

    // List relays
    start = Date.now()
    const list = await fetchJSON('/relays?limit=5')
    const hasRelays = list.relays && list.relays.length > 0
    recordTest('REST: GET /relays', hasRelays, Date.now() - start)

    // Get relay state
    if (hasRelays) {
      const firstRelay = list.relays[0]
      // Check if relay has URL field (could be 'url' or 'relayUrl')
      const relayUrl = firstRelay.relayUrl || firstRelay.url

      if (relayUrl) {
        start = Date.now()
        const stateUrl = `/relays/state?relayUrl=${encodeURIComponent(relayUrl)}`
        const state = await fetchJSON(stateUrl)
        recordTest('REST: GET /relays/state', !!state.relay, Date.now() - start)
      } else {
        console.log(`⚠️  First relay has no URL field, skipping /relays/state test. Relay object:`, JSON.stringify(firstRelay, null, 2))
        recordTest('REST: GET /relays/state', false, 0, 'No relay URL found in response')
      }
    }

    // Search
    start = Date.now()
    const search = await fetchJSON('/relays/search', {
      method: 'POST',
      body: JSON.stringify({ limit: 5 }),
    })
    recordTest('REST: POST /relays/search', !!search.relays, Date.now() - start)

    // List labels
    start = Date.now()
    const labels = await fetchJSON('/relays/labels/list')
    recordTest('REST: GET /relays/labels/list', !!labels, Date.now() - start)

    // By network
    start = Date.now()
    const byNetwork = await fetchJSON('/relays/by/network')
    recordTest('REST: GET /relays/by/network', !!byNetwork, Date.now() - start)

    // By NIP
    start = Date.now()
    const byNip = await fetchJSON('/relays/by/nip?nip=1')
    recordTest('REST: GET /relays/by/nip', !!byNip, Date.now() - start)

    // Online relays
    start = Date.now()
    const online = await fetchJSON('/relays/online', {
      method: 'POST',
      body: JSON.stringify({ onlineWindowSeconds: 3600 }),
    })
    recordTest('REST: POST /relays/online', !!online.relays, Date.now() - start)

    // Monitors
    start = Date.now()
    const monitors = await fetchJSON('/monitors')
    recordTest('REST: GET /monitors', !!monitors, Date.now() - start)

    // Policy
    start = Date.now()
    const policy = await fetchJSON('/policy')
    recordTest('REST: GET /policy', !!policy, Date.now() - start)

    // DISABLED: Subscriptions (create and list)
    // Subscription endpoints have been disabled
    recordTest('REST: Subscriptions (create/delete)', true, 0, 'SKIPPED: Subscriptions disabled')

  } catch (err) {
    recordTest('REST: Overall', false, 0, String(err))
  }
}

async function main() {
  console.log('===================================')
  console.log('  RelayVM Full Smoke Test')
  console.log('===================================')

  // Show environment info
  const serverPubkey = env('SMOKE_SERVER_PUBKEY', false)
  const restUrl = env('SMOKE_REST_URL', false) || 'http://localhost:3000'
  console.log(`\nMCP Server Pubkey: ${serverPubkey || '(not set - MCP tests will be skipped)'}`)
  console.log(`REST API URL: ${restUrl}`)

  const testMcp = env('SMOKE_TEST_MCP', false) !== 'false'
  const testRest = env('SMOKE_TEST_REST', false) !== 'false'

  // Wait for server to be ready before running tests
  try {
    await waitForReady(restUrl)
  } catch (err) {
    console.error('Server readiness check failed:', err)
    process.exit(1)
  }

  if (testMcp) {
    try {
      await testMCP()
    } catch (err) {
      console.error('MCP tests failed:', err)
    }
  }

  if (testRest) {
    try {
      await testREST()
    } catch (err) {
      console.error('REST tests failed:', err)
    }
  }

  // Summary
  console.log('\\n===================================')
  console.log('  Test Summary')
  console.log('===================================')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  console.log(`\\nTotal: ${results.length} tests`)
  console.log(`Passed: ${passed} ✓`)
  console.log(`Failed: ${failed} ✗`)
  console.log(`Duration: ${totalDuration}ms`)

  if (failed > 0) {
    console.log('\\nFailed tests:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error || 'unknown error'}`)
    })
    process.exit(1)
  }

  console.log('\\n✓ All smoke tests passed')
}

main().catch((err) => {
  console.error('Smoke test suite failed:', err)
  process.exit(1)
})

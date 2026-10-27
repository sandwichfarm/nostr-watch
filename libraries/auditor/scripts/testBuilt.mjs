import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { Auditor, ConversationTest, MessageSession } from '../dist/server/index.js'

assert.equal(typeof ConversationTest, 'function')
assert.equal(typeof MessageSession, 'function')
await access(new URL('../dist/server/types/index.d.ts', import.meta.url))
const cache = resolve('node_modules/.cache')
await mkdir(cache, { recursive: true })
const temporary = await mkdtemp(resolve(cache, 'auditor-built-test-'))
let fixture
try {
  // Compile the test fixture separately; test code is excluded from package output.
  const outfile = resolve(temporary, 'relayFixture.mjs')
  await build({ entryPoints: ['src/testing/relayFixture.ts'], outfile, bundle: true,
    platform: 'node', format: 'esm', packages: 'external' })
  const { createRelayFixture, populatedFixtureEvents } = await import(pathToFileURL(outfile).href)
  const required = [
    'AddressableEvents', 'ChildPath', 'EphemeralEvents', 'EventPersistence', 'EventValidation',
    'FilterEmptyLists', 'FilterIds', 'FilterInclusiveRange', 'FilterLimitOrder', 'FilterSemantics',
    'FilterUnknownKeys', 'LimitLive', 'ReplaceableEvents', 'SubscriptionIsolation', 'SubscriptionLifecycle',
  ]
  fixture = await createRelayFixture({ child: 'distinct', events: populatedFixtureEvents() })
  const result = await new Auditor({ nips: new Set(['Nip01']), options: {} }).test(fixture.url)
  const suite = result.suites.Nip01
  assert.equal(suite.reason, '')
  assert.equal(suite.pass, true)
  assert.equal(suite.incomplete, true)
  for (const name of required) {
    assert.ok(suite.tests[name], `${name} must load through the built manifest`)
    assert.deepEqual(suite.tests[name].failed, [], name)
    assert.equal(suite.tests[name].pass, true, name)
  }
  for (const [name, test] of Object.entries(suite.tests)) assert.deepEqual(test.failed, [], name)
  assert.equal(suite.data.ChildPath.observation, 'child returned a different event set')
  console.log(`Built Auditor: ${required.length} conversation checks passed through public manifests`)
} finally {
  await fixture?.close()
  await rm(temporary, { recursive: true, force: true })
}

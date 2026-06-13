import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { initStateCore } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/core/types/aggregation.js'
import { StateDatabaseService } from '../src/services/state-database.js'

describe('StateDatabaseService', () => {
  let tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    tempDirs = []
  })

  async function tempConfig(backupRetention: number = 2) {
    const dir = await mkdtemp(join(tmpdir(), 'rstate-db-'))
    tempDirs.push(dir)
    return {
      enabled: true,
      path: join(dir, 'rstate-state.json'),
      backupDir: join(dir, 'backups'),
      backupRetention,
    }
  }

  it('backs up v1 state before migrating to the TRA-aware schema', async () => {
    const config = await tempConfig()
    const core = initStateCore({ aggregation: DEFAULT_POLICY })
    await writeFile(config.path, JSON.stringify({
      schemaVersion: 1,
      createdAt: '2026-06-12T00:00:00.000Z',
      updatedAt: '2026-06-12T00:00:00.000Z',
      monitors: [],
      observations: [
        {
          id: 'obs-1',
          author: 'monitor-a',
          relayUrl: 'wss://relay.example.com',
          created_at: 1_704_067_100,
          network: 'clearnet',
        },
      ],
    }), 'utf-8')

    const database = new StateDatabaseService(config)
    await database.initialize(core)

    const migrated = JSON.parse(await readFile(config.path, 'utf-8'))
    const backups = await database.listBackups()

    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.trustedRelayAssertions).toEqual([])
    expect(backups).toHaveLength(1)
    expect(backups[0].path).toContain('pre-migration-v1-to-v2')
    expect(core.stats.get().observations.count).toBe(1)
  })

  it('restores from backup and rotates old backups by retention', async () => {
    const config = await tempConfig(1)
    const core = initStateCore({ aggregation: DEFAULT_POLICY })
    await writeFile(config.path, JSON.stringify({
      schemaVersion: 1,
      monitors: [],
      observations: [
        {
          id: 'obs-restore',
          author: 'monitor-a',
          relayUrl: 'wss://restore.example.com',
          created_at: 1_704_067_100,
          network: 'clearnet',
        },
      ],
    }), 'utf-8')

    const database = new StateDatabaseService(config)
    await database.initialize(core)
    const [backup] = await database.listBackups()

    await writeFile(config.path, JSON.stringify({
      schemaVersion: 2,
      updatedAt: '2026-06-12T01:00:00.000Z',
      monitors: [],
      observations: [],
      trustedRelayAssertions: [],
    }), 'utf-8')

    const restored = await database.restoreFromBackup(backup.path, core)
    const backupsAfterRestore = await database.listBackups()

    expect(restored.observations).toHaveLength(1)
    expect(restored.observations[0].relayUrl).toBe('wss://restore.example.com')
    expect(core.stats.get().observations.count).toBe(1)
    expect(backupsAfterRestore).toHaveLength(1)
  })
})

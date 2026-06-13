import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import type { StateCore, StateSnapshot } from '../core/index.js'
import type { StateDatabaseConfig } from '../config.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'state-database' })
const CURRENT_SCHEMA_VERSION = 2

export interface StateBackupInfo {
  path: string
  sizeBytes: number
  createdAt: string
}

export class StateDatabaseService {
  private createdAt?: string

  constructor(private config: StateDatabaseConfig) {}

  async initialize(core: StateCore): Promise<void> {
    await this.ensureDirectories()

    const snapshot = await this.loadSnapshotFromDisk()
    if (snapshot) {
      core.snapshot.import(snapshot)
      this.createdAt = snapshot.createdAt
      logger.info({
        path: this.config.path,
        monitors: snapshot.monitors.length,
        observations: snapshot.observations.length,
        trustedRelayAssertions: snapshot.trustedRelayAssertions.length,
      }, 'State database loaded')
      return
    }

    await this.save(core)
    logger.info({ path: this.config.path }, 'State database initialized')
  }

  async save(core: StateCore): Promise<void> {
    await this.ensureDirectories()
    const snapshot = core.snapshot.export()
    snapshot.createdAt = this.createdAt ?? snapshot.createdAt ?? new Date().toISOString()
    snapshot.updatedAt = new Date().toISOString()
    this.createdAt = snapshot.createdAt
    await this.writeSnapshot(snapshot)
  }

  async listBackups(): Promise<StateBackupInfo[]> {
    await this.ensureDirectories()
    const prefix = `${basename(this.config.path)}.`
    const files = await readdir(this.config.backupDir)
    const backups: StateBackupInfo[] = []

    for (const file of files) {
      if (!file.startsWith(prefix)) continue
      const backupPath = join(this.config.backupDir, file)
      const details = await stat(backupPath)
      backups.push({
        path: backupPath,
        sizeBytes: details.size,
        createdAt: details.mtime.toISOString(),
      })
    }

    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async restoreFromBackup(backupPath: string, core?: StateCore): Promise<StateSnapshot> {
    await this.ensureDirectories()
    const resolvedBackupPath = resolve(backupPath)
    if (!existsSync(resolvedBackupPath)) {
      throw new Error(`Backup not found: ${backupPath}`)
    }

    const restoredBytes = await readFile(resolvedBackupPath)
    await this.backupCurrentFile('pre-restore')
    await writeFile(this.config.path, restoredBytes)

    const snapshot = await this.loadSnapshotFromDisk()
    if (!snapshot) {
      throw new Error(`Restored backup did not produce a readable state database: ${backupPath}`)
    }

    if (core) {
      core.snapshot.import(snapshot)
    }

    logger.warn({ backupPath: resolvedBackupPath, path: this.config.path }, 'State database restored from backup')
    return snapshot
  }

  private async loadSnapshotFromDisk(): Promise<StateSnapshot | null> {
    if (!existsSync(this.config.path)) return null

    const rawText = await readFile(this.config.path, 'utf-8')
    const raw = JSON.parse(rawText) as Record<string, unknown>
    const schemaVersion = Number(raw.schemaVersion ?? 1)

    if (schemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `State database schema v${schemaVersion} is newer than this binary supports (v${CURRENT_SCHEMA_VERSION})`
      )
    }

    let snapshot = this.normalizeSnapshot(raw)

    if (schemaVersion < CURRENT_SCHEMA_VERSION) {
      await this.backupCurrentFile(`pre-migration-v${schemaVersion}-to-v${CURRENT_SCHEMA_VERSION}`)
      snapshot = this.migrateSnapshot(raw, schemaVersion)
      await this.writeSnapshot(snapshot)
      await this.rotateBackups()
      logger.info({
        fromSchemaVersion: schemaVersion,
        toSchemaVersion: CURRENT_SCHEMA_VERSION,
      }, 'State database migration completed')
    }

    return snapshot
  }

  private migrateSnapshot(raw: Record<string, unknown>, fromVersion: number): StateSnapshot {
    if (fromVersion <= 1) {
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: stringFrom(raw.createdAt) ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        monitors: Array.isArray(raw.monitors) ? raw.monitors as StateSnapshot['monitors'] : [],
        observations: Array.isArray(raw.observations) ? raw.observations as StateSnapshot['observations'] : [],
        trustedRelayAssertions: [],
      }
    }

    return this.normalizeSnapshot(raw)
  }

  private normalizeSnapshot(raw: Record<string, unknown>): StateSnapshot {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: stringFrom(raw.createdAt),
      updatedAt: stringFrom(raw.updatedAt) ?? new Date().toISOString(),
      monitors: Array.isArray(raw.monitors) ? raw.monitors as StateSnapshot['monitors'] : [],
      observations: Array.isArray(raw.observations) ? raw.observations as StateSnapshot['observations'] : [],
      trustedRelayAssertions: Array.isArray(raw.trustedRelayAssertions)
        ? raw.trustedRelayAssertions as StateSnapshot['trustedRelayAssertions']
        : [],
    }
  }

  private async writeSnapshot(snapshot: StateSnapshot): Promise<void> {
    await this.ensureDirectories()
    const tmpPath = `${this.config.path}.tmp`
    await writeFile(tmpPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8')
    await rename(tmpPath, this.config.path)
  }

  private async backupCurrentFile(reason: string): Promise<string | null> {
    if (!existsSync(this.config.path)) return null

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = join(this.config.backupDir, `${basename(this.config.path)}.${reason}.${stamp}.json`)
    await copyFile(this.config.path, backupPath)
    await this.rotateBackups()
    logger.warn({ backupPath, reason }, 'State database backup created')
    return backupPath
  }

  private async rotateBackups(): Promise<void> {
    const backups = await this.listBackups()
    const extra = backups.slice(this.config.backupRetention)
    for (const backup of extra) {
      await rm(backup.path, { force: true })
      logger.warn({ backupPath: backup.path }, 'State database backup removed by retention policy')
    }
  }

  private async ensureDirectories(): Promise<void> {
    await mkdir(dirname(this.config.path), { recursive: true })
    await mkdir(this.config.backupDir, { recursive: true })
  }
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

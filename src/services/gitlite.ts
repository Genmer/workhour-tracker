import { initDB, connect, type GitLiteClient, Collection } from '@gitlite/sdk'
import { AppConfig, WorkRecord } from '../types'
import { DEFAULT_CONFIG } from '../constants'

/**
 * 数据库文档类型定义
 */
export interface DbConfigDoc extends Partial<AppConfig> {
  _id: string
  hasInitializedThisMonth?: boolean
  lastInitializedMonth?: string
  updatedAt?: string
}

export interface DbRecordDoc extends WorkRecord {
  _id: string
  createdAt?: string
  updatedAt?: string
}

export interface ExportDataPayload {
  config: AppConfig
  records: Record<string, WorkRecord>
  exportDate: string
}

const CONFIG_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  gitliteDescriptor: { collection: 'config', timestamps: true },
  type: 'object',
  properties: {
    dailyStartTime: { type: 'string' },
    lunchBreakHours: { type: 'number' },
    targetDailyHours: { type: 'number' },
    overtimeEndTime: { type: 'string' },
    monthlyTargetDays: { type: 'number' },
    currentWeekType: { type: 'string' },
    hasInitializedThisMonth: { type: 'boolean' },
    lastInitializedMonth: { type: 'string' },
    updatedAt: { type: 'string', 'x-gitlite-indexed': true },
  },
}

const RECORDS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  gitliteDescriptor: { collection: 'records', timestamps: true },
  type: 'object',
  properties: {
    dateId: { type: 'string', 'x-gitlite-indexed': true },
    clockOutTime: { type: ['string', 'null'] },
    actualWorkHours: { type: 'number' },
    isLeave: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string', 'x-gitlite-indexed': true },
  },
  required: ['dateId'],
}

let dbInstance: GitLiteClient | null = null
let configCol: Collection<DbConfigDoc> | null = null
let recordsCol: Collection<DbRecordDoc> | null = null
let initPromise: Promise<GitLiteClient> | null = null

export type DbStatusListener = (status: {
  isReady: boolean
  provider: string
  database: string
  online?: boolean
  pendingOps?: number
  lastSyncAt?: string | null
  error?: string | null
  isSyncing?: boolean
}) => void

const statusListeners = new Set<DbStatusListener>()
let currentDbStatus = {
  isReady: false,
  provider: 'github',
  database: 'workhour-tracker',
  online: false,
  pendingOps: 0,
  lastSyncAt: null as string | null,
  error: null as string | null,
  isSyncing: false,
}

function notifyStatusChange() {
  for (const listener of statusListeners) {
    try {
      listener({ ...currentDbStatus })
    } catch {
      // 避免外部监听报错中断通知
    }
  }
}

export function subscribeDbStatus(listener: DbStatusListener) {
  statusListeners.add(listener)
  listener({ ...currentDbStatus })
  return () => {
    statusListeners.delete(listener)
  }
}

export function getDbStatus() {
  return { ...currentDbStatus }
}

/**
 * 规范初始化 GitLite 嵌入式数据库
 * 首次调用：引导用户浏览器授权并自动在私有仓建分支
 * 二次调用：幂等静默直连
 */
export async function getOrInitGitLiteDB(options?: {
  provider?: 'github' | 'gitee' | 'memory'
  database?: string
  token?: string
  force?: boolean
}): Promise<GitLiteClient> {
  if (dbInstance && !options?.force) {
    return dbInstance
  }
  if (initPromise && !options?.force) {
    return initPromise
  }

  const provider = options?.provider ?? 'github'
  const database = options?.database ?? 'workhour-tracker'

  initPromise = (async () => {
    try {
      // 按照规范使用 initDB 初始化
      const client = await initDB({
        provider,
        database,
        token: options?.token,
        force: options?.force,
        allowForeignRepo: true,
        onProgress: (step, detail) => {
          console.log(`[GitLite] 步骤: ${step}${detail ? ` (${JSON.stringify(detail)})` : ''}`)
        },
      })

      dbInstance = client
      await client.putSchema('config', CONFIG_SCHEMA)
      await client.putSchema('records', RECORDS_SCHEMA)

      configCol = client.collection<DbConfigDoc>('config')
      recordsCol = client.collection<DbRecordDoc>('records')

      const syncStatus = client.syncStatus()
      currentDbStatus = {
        isReady: true,
        provider,
        database,
        online: syncStatus.online,
        pendingOps: syncStatus.pendingOps,
        lastSyncAt: syncStatus.lastSyncAt,
        error: null,
        isSyncing: false,
      }

      // 监听同步事件
      client.on('sync:push', (e: any) => {
        console.log('[GitLite] 数据已推送同步至云端 Git 仓库:', e)
        const updated = client.syncStatus()
        currentDbStatus = {
          ...currentDbStatus,
          online: updated.online,
          pendingOps: updated.pendingOps,
          lastSyncAt: updated.lastSyncAt,
          isSyncing: false,
        }
        notifyStatusChange()
      })

      client.on('sync:conflict', (e: any) => {
        console.warn('[GitLite] 检测到多端变更冲突，引擎已执行三路合并:', e)
      })

      notifyStatusChange()
      return client
    } catch (err: any) {
      console.warn(`[GitLite] 数据库初始化异常: ${err?.message || err}`)
      // 优雅降级到本地内存就绪模式，保证应用秒开与离线读写
      const fallbackClient = await connect({
        provider: 'memory',
        owner: 'local-user',
        repo: 'gitlite-repo',
        database,
      })

      dbInstance = fallbackClient
      await fallbackClient.putSchema('config', CONFIG_SCHEMA)
      await fallbackClient.putSchema('records', RECORDS_SCHEMA)

      configCol = fallbackClient.collection<DbConfigDoc>('config')
      recordsCol = fallbackClient.collection<DbRecordDoc>('records')

      currentDbStatus = {
        isReady: true,
        provider: 'memory (offline)',
        database,
        online: false,
        pendingOps: 0,
        lastSyncAt: null,
        error: err?.message || '离线内存模式',
        isSyncing: false,
      }
      notifyStatusChange()
      return fallbackClient
    }
  })()

  return initPromise
}

/**
 * 手动触发立即将本地变更推送到云端 Git 仓库
 */
export async function syncFlushNow(): Promise<void> {
  const db = await getOrInitGitLiteDB()
  currentDbStatus.isSyncing = true
  notifyStatusChange()

  try {
    if (db && db.sync) {
      await db.sync.flush()
    }
    const status = db.syncStatus()
    currentDbStatus = {
      ...currentDbStatus,
      online: status.online,
      pendingOps: status.pendingOps,
      lastSyncAt: status.lastSyncAt || new Date().toLocaleTimeString(),
      isSyncing: false,
    }
    notifyStatusChange()
  } catch (e: any) {
    currentDbStatus.isSyncing = false
    notifyStatusChange()
    throw e
  }
}

/**
 * 手动触发从云端拉取最新 Git 提交并执行三路合并
 */
export async function syncPullNow(): Promise<void> {
  const db = await getOrInitGitLiteDB()
  currentDbStatus.isSyncing = true
  notifyStatusChange()

  try {
    if (db && db.sync) {
      await db.sync.pull()
    }
    const status = db.syncStatus()
    currentDbStatus = {
      ...currentDbStatus,
      online: status.online,
      pendingOps: status.pendingOps,
      lastSyncAt: status.lastSyncAt || new Date().toLocaleTimeString(),
      isSyncing: false,
    }
    notifyStatusChange()
  } catch (e: any) {
    currentDbStatus.isSyncing = false
    notifyStatusChange()
    throw e
  }
}

/**
 * 从 GitLite 数据库读取应用全局配置 (MongoDB 风格 findOne)
 */
export async function getAppConfigFromDb(): Promise<AppConfig | null> {
  await getOrInitGitLiteDB()
  if (!configCol) return null

  const doc = await configCol.findOne({ _id: 'app_config' })
  if (!doc) return null

  return {
    dailyStartTime: doc.dailyStartTime ?? DEFAULT_CONFIG.dailyStartTime,
    lunchBreakHours: doc.lunchBreakHours ?? DEFAULT_CONFIG.lunchBreakHours,
    targetDailyHours: doc.targetDailyHours ?? DEFAULT_CONFIG.targetDailyHours,
    overtimeEndTime: doc.overtimeEndTime ?? DEFAULT_CONFIG.overtimeEndTime,
    monthlyTargetDays: doc.monthlyTargetDays ?? DEFAULT_CONFIG.monthlyTargetDays,
    currentWeekType: doc.currentWeekType ?? DEFAULT_CONFIG.currentWeekType,
  }
}

/**
 * 保存应用全局配置到 GitLite 数据库 (MongoDB 风格 updateOne upsert)
 */
export async function saveAppConfigToDb(config: Partial<AppConfig>): Promise<void> {
  await getOrInitGitLiteDB()
  if (!configCol) return

  await configCol.updateOne(
    { _id: 'app_config' },
    {
      $set: {
        ...config,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  )

  const updatedStatus = dbInstance?.syncStatus()
  if (updatedStatus) {
    currentDbStatus.pendingOps = updatedStatus.pendingOps
    notifyStatusChange()
  }
}

/**
 * 从 GitLite 数据库读取所有考勤记录 (MongoDB 风格 find)
 */
export async function getAllRecordsFromDb(): Promise<Record<string, WorkRecord>> {
  await getOrInitGitLiteDB()
  if (!recordsCol) return {}

  const result = await recordsCol.find({}, { sort: { dateId: 1 } })
  const map: Record<string, WorkRecord> = {}

  for (const doc of result.items) {
    if (doc.dateId) {
      map[doc.dateId] = {
        dateId: doc.dateId,
        clockOutTime: doc.clockOutTime ?? null,
        actualWorkHours: doc.actualWorkHours ?? 0,
        isLeave: !!doc.isLeave,
      }
    }
  }

  return map
}

/**
 * 保存单条打卡记录到 GitLite 数据库 (MongoDB 风格 updateOne upsert)
 */
export async function saveRecordToDb(record: WorkRecord): Promise<void> {
  await getOrInitGitLiteDB()
  if (!recordsCol) return

  await recordsCol.updateOne(
    { _id: record.dateId },
    {
      $set: {
        dateId: record.dateId,
        clockOutTime: record.clockOutTime,
        actualWorkHours: record.actualWorkHours,
        isLeave: record.isLeave,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  )

  const updatedStatus = dbInstance?.syncStatus()
  if (updatedStatus) {
    currentDbStatus.pendingOps = updatedStatus.pendingOps
    notifyStatusChange()
  }
}

/**
 * 删除打卡记录 (MongoDB 风格 deleteOne)
 */
export async function deleteRecordFromDb(dateId: string): Promise<void> {
  await getOrInitGitLiteDB()
  if (!recordsCol) return

  await recordsCol.deleteOne({ _id: dateId })

  const updatedStatus = dbInstance?.syncStatus()
  if (updatedStatus) {
    currentDbStatus.pendingOps = updatedStatus.pendingOps
    notifyStatusChange()
  }
}

/**
 * 历史备份与导出包 100% 兼容导入 (MongoDB 风格批量 updateOne upsert)
 * 严格支持原有的 { config, records, exportDate } 格式
 */
export async function importLegacyBackupToDb(data: {
  config?: Partial<AppConfig>
  records?: Record<string, WorkRecord>
}): Promise<{ importedRecordsCount: number; importedConfig: boolean }> {
  await getOrInitGitLiteDB()
  if (!configCol || !recordsCol) {
    throw new Error('GitLite 数据库未就绪')
  }

  let count = 0
  let configUpdated = false

  // 1. 导入配置
  if (data.config && Object.keys(data.config).length > 0) {
    await saveAppConfigToDb(data.config)
    configUpdated = true
  }

  // 2. 导入考勤记录 (批量 MongoDB 风格 updateOne upsert)
  if (data.records && typeof data.records === 'object') {
    const entries = Object.entries(data.records)
    for (const [dateId, record] of entries) {
      if (!dateId || !record) continue
      await saveRecordToDb({
        dateId,
        clockOutTime: record.clockOutTime ?? null,
        actualWorkHours: Number(record.actualWorkHours) || 0,
        isLeave: Boolean(record.isLeave),
      })
      count++
    }
  }

  return {
    importedRecordsCount: count,
    importedConfig: configUpdated,
  }
}

/**
 * 导出符合规范的备份数据包 (格式与原 App 保持严格一致)
 */
export async function exportDbBackup(): Promise<ExportDataPayload> {
  const config = (await getAppConfigFromDb()) ?? { ...DEFAULT_CONFIG }
  const records = await getAllRecordsFromDb()

  return {
    config,
    records,
    exportDate: new Date().toISOString(),
  }
}

import {
  GitLiteClient,
  MemoryProvider,
  GitHubProvider,
  GiteeProvider,
  type Collection,
  type RuntimeAdapter,
  type GitProvider,
  type HistoryEntry,
  type HistoryDetail,
  type RestoreResult,
} from '@gitlite/core'
import { Platform } from 'react-native'
import type { MirrorResult } from '@gitlite/sdk/browser'
import { AppConfig, WorkRecord } from '../types'
import { DEFAULT_CONFIG } from '../constants'

/** 透传 GitLite 历史相关类型，供 store 与 UI 层复用（避免多处直连 @gitlite/core） */
export type { HistoryEntry, HistoryDetail, RestoreResult } from '@gitlite/core'
/** 透传 SDK 镜像结果类型（仅类型引用，运行时经 @gitlite/sdk/browser 动态加载） */
export type { MirrorResult } from '@gitlite/sdk/browser'

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

/**
 * 纯 JS SHA-1 实现，零 Node 原生依赖，跨 Web / React Native / Electron 全环境运行
 */
function sha1(str: string): string {
  const utf8 = unescape(encodeURIComponent(str))
  const words: number[] = []
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8)
  }
  const len = utf8.length * 8
  words[len >> 5] |= 0x80 << (24 - (len % 32))
  words[(((len + 64) >> 9) << 4) + 15] = len

  const w = new Array(80)
  let a = 1732584193
  let b = -271733879
  let c = -1732584194
  let d = 271733878
  let e = -1009589776

  for (let i = 0; i < words.length; i += 16) {
    const olda = a
    const oldb = b
    const oldc = c
    const oldd = d
    const olde = e
    for (let j = 0; j < 80; j++) {
      if (j < 16) {
        w[j] = words[i + j] || 0
      } else {
        const t = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]
        w[j] = (t << 1) | (t >>> 31)
      }
      const t =
        (((a << 5) | (a >>> 27)) +
          e +
          w[j] +
          (j < 20
            ? ((b & c) | (~b & d)) + 1518500249
            : j < 40
            ? (b ^ c ^ d) + 1859775393
            : j < 60
            ? ((b & c) | (b & d) | (c & d)) + -1894007588
            : (b ^ c ^ d) + -899497514)) |
        0
      e = d
      d = c
      c = ((b << 30) | (b >>> 2)) | 0
      b = a
      a = t
    }
    a = (a + olda) | 0
    b = (b + oldb) | 0
    c = (c + oldc) | 0
    d = (d + oldd) | 0
    e = (e + olde) | 0
  }
  const hex = (n: number) => ('00000000' + (n >>> 0).toString(16)).slice(-8)
  return hex(a) + hex(b) + hex(c) + hex(d) + hex(e)
}

/** 原生端 MMKV 的最小键值接口（仅用到的子集，避免静态引入 react-native-mmkv 类型） */
interface MinimalKVStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  remove(key: string): void
}

/**
 * 跨端通用的浏览器/移动端安全运行时适配器
 * web 分支继续走 localStorage（键名零改动，兼容老数据）；
 * 原生分支 fs / credential 改走 MMKV 持久化（修复 token 无法持久化的问题），键名与 web 完全一致
 */
export function createUniversalRuntime(): RuntimeAdapter {
  const isWeb = Platform.OS === 'web'
  const memFs = new Map<string, string>()

  // 原生端条件 require MMKV（照抄 useAppStore.createStorage 的模式，web 包不会加载原生模块）
  let mmkv: MinimalKVStorage | null = null
  if (!isWeb) {
    const { createMMKV } = require('react-native-mmkv')
    mmkv = createMMKV()
  }

  // 统一键值读写：原生走 MMKV，web 走 localStorage，键名格式两端完全一致
  const readRaw = (key: string): string | null => {
    if (!isWeb && mmkv) {
      const v = mmkv.getString(key)
      return v ?? null
    }
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  }
  const writeRaw = (key: string, value: string) => {
    if (!isWeb && mmkv) {
      mmkv.set(key, value)
      return
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value)
      } catch {}
    }
  }
  const removeRaw = (key: string) => {
    if (!isWeb && mmkv) {
      mmkv.remove(key)
      return
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
  }

  const browserFs = {
    async readFile(file: string) {
      const v = memFs.get(file) ?? readRaw(`gitlite:fs:${file}`)
      if (v == null) throw new Error(`ENOENT: ${file}`)
      return v
    },
    async writeFile(file: string, data: string) {
      memFs.set(file, data)
      writeRaw(`gitlite:fs:${file}`, data)
    },
    async appendFile(file: string, data: string) {
      const cur = memFs.get(file) ?? readRaw(`gitlite:fs:${file}`) ?? ''
      const updated = cur + data
      memFs.set(file, updated)
      writeRaw(`gitlite:fs:${file}`, updated)
    },
    async exists(file: string) {
      if (memFs.has(file)) return true
      return readRaw(`gitlite:fs:${file}`) != null
    },
    async mkdir(_dir: string) {
      // 浏览器 / 原生环境均无需实际文件夹
    },
  }

  const browserCrypto = {
    randomBytes(n: number) {
      const buf = new Uint8Array(n)
      if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues(buf)
      } else {
        for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256)
      }
      return buf
    },
    sha1hex(s: string) {
      return sha1(s)
    },
  }

  const browserCredential = {
    async set(key: string, value: string) {
      writeRaw(`gitlite:cred:${key}`, value)
    },
    async get(key: string) {
      return readRaw(`gitlite:cred:${key}`)
    },
    async delete(key: string) {
      removeRaw(`gitlite:cred:${key}`)
    },
  }

  return {
    fs: browserFs,
    crypto: browserCrypto,
    credential: browserCredential,
    fetch: globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch,
    now: () => Date.now(),
    onExit(fn: () => void | Promise<void>) {
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          void fn()
        })
      }
    },
  }
}

/**
 * 将 GitLite 错误统一映射为面向用户的中文文案
 * （覆盖 0.5.1 新增 PublicRepoError / QuotaExceededError；判定用 name / code / message 三重兜底）
 */
export function friendlyGitLiteError(err: unknown): string {
  const e = err as { name?: string; code?: string; message?: string } | null | undefined
  const name = String(e?.name ?? '')
  const code = String(e?.code ?? '')
  const message = String(e?.message ?? '')

  // PublicRepoError：err.name 可能是类名或 'PUBLIC_REPO' 代码
  if (
    /PublicRepo|PUBLIC_REPO/i.test(name) ||
    /PUBLIC_REPO/i.test(code) ||
    /PublicRepo|PUBLIC_REPO/i.test(message)
  ) {
    return '目标仓库是公开的（public），为保护数据安全 GitLite 拒绝写入。请在 GitHub/Gitee 仓库设置中改为 Private 后重试'
  }
  if (/QuotaExceeded/i.test(name) || /QuotaExceeded|budget exhausted/i.test(message)) {
    return '远端调用配额已用尽（每小时刷新），请稍后再试'
  }
  if (/NetworkError/i.test(name) || /offline/i.test(message)) {
    return '当前离线，此操作需要网络连接'
  }
  if (/NotFoundError/i.test(name)) {
    return '该记录已超出可查询范围'
  }
  return e?.message || '未知错误'
}

let dbInstance: GitLiteClient | null = null
let configCol: Collection<DbConfigDoc> | null = null
let recordsCol: Collection<DbRecordDoc> | null = null
let initPromise: Promise<GitLiteClient> | null = null

/** 数据库状态快照：本地连接字段 + GitLite 0.4.0 syncStatus 扩展字段（均为可选，向后兼容） */
export interface DbStatus {
  isReady: boolean
  provider: string
  database: string
  online?: boolean
  pendingOps?: number
  lastSyncAt?: string | null
  error?: string | null
  isSyncing?: boolean
  /** 引擎状态机：connecting/ready/syncing/synced/offline/error */
  state?: string
  /** 连接维度：online=已连云端 / offline=离线本地 / unknown=检测中 */
  connection?: 'online' | 'offline' | 'unknown'
  /** normal=云端模式 / fully-local=纯本地模式 */
  mode?: 'normal' | 'fully-local'
  lastError?: string | null
  conflicts?: number
  remoteHeadOid?: string | null
}

export type DbStatusListener = (status: DbStatus) => void

const statusListeners = new Set<DbStatusListener>()
let currentDbStatus: DbStatus = {
  isReady: false,
  provider: 'github',
  database: 'workhour-tracker',
  online: false,
  pendingOps: 0,
  lastSyncAt: null,
  error: null,
  isSyncing: false,
}

/** 将引擎 syncStatus() 最新字段合并进本地状态（保留 provider/database/isReady 等本地字段） */
function mergeSyncStatus(db: GitLiteClient) {
  const status = db.syncStatus()
  currentDbStatus = {
    ...currentDbStatus,
    online: status.online,
    pendingOps: status.pendingOps,
    lastSyncAt: status.lastSyncAt,
    state: status.state,
    connection: status.connection,
    mode: status.mode,
    lastError: status.lastError,
    conflicts: status.conflicts,
    remoteHeadOid: status.remoteHeadOid,
  }
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
 * 跨端安全初始化 GitLite 嵌入式数据库
 * 优先采用零原生依赖的 @gitlite/core 纯引擎，在 Web 与移动端完全杜绝 Node 原生模块报错
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

  const runtime = createUniversalRuntime()
  const database = options?.database ?? 'workhour-tracker'

  initPromise = (async () => {
    let providerName = options?.provider
    if (!providerName) {
      providerName =
        ((await runtime.credential.get('gitlite:active_provider')) as 'github' | 'gitee' | 'memory') ??
        'github'
    }

    try {
      let savedToken = options?.token
      if (savedToken !== undefined) {
        if (savedToken) {
          await runtime.credential.set(`gitlite:${providerName}:token`, savedToken)
        } else {
          await runtime.credential.delete(`gitlite:${providerName}:token`)
        }
      } else {
        savedToken = (await runtime.credential.get(`gitlite:${providerName}:token`)) ?? undefined
      }

      await runtime.credential.set('gitlite:active_provider', providerName)

      let provider: GitProvider
      let owner = 'user'
      const repo = 'gitlite-repo'
      let isCloudOnline = false

      if (providerName === 'github') {
        if (savedToken) {
          const gh = new GitHubProvider(savedToken, runtime.fetch)
          const user = await gh.getUser()
          owner = user.login
          provider = gh
          isCloudOnline = true
        } else {
          provider = new MemoryProvider()
        }
      } else if (providerName === 'gitee') {
        if (savedToken) {
          const gitee = new GiteeProvider(savedToken, runtime.fetch)
          const user = await gitee.getUser()
          owner = user.login
          provider = gitee
          isCloudOnline = true
        } else {
          provider = new MemoryProvider()
        }
      } else {
        provider = new MemoryProvider()
      }

      const client = await GitLiteClient.create({
        provider,
        runtime,
        ref: { owner, repo },
        database,
        allowForeignRepo: true,
        onProgress: (step, detail) => console.log('[GitLite] connect:', step, detail ?? ''),
      })

      dbInstance = client
      await client.putSchema('config', CONFIG_SCHEMA)
      await client.putSchema('records', RECORDS_SCHEMA)

      configCol = client.collection<DbConfigDoc>('config')
      recordsCol = client.collection<DbRecordDoc>('records')

      const syncStatus = client.syncStatus()
      currentDbStatus = {
        isReady: true,
        provider: providerName,
        database,
        online: isCloudOnline || syncStatus.online,
        pendingOps: syncStatus.pendingOps,
        lastSyncAt: syncStatus.lastSyncAt,
        error: null,
        isSyncing: false,
        state: syncStatus.state,
        connection: syncStatus.connection,
        mode: syncStatus.mode,
        lastError: syncStatus.lastError,
        conflicts: syncStatus.conflicts,
        remoteHeadOid: syncStatus.remoteHeadOid,
      }

      // 监听同步事件
      client.on('sync:push', (e: any) => {
        console.log('[GitLite] 数据已推送同步至云端 Git 仓库:', e)
        const updated = client.syncStatus()
        currentDbStatus = {
          ...currentDbStatus,
          online: true,
          pendingOps: updated.pendingOps,
          lastSyncAt: updated.lastSyncAt || new Date().toLocaleTimeString(),
          state: updated.state,
          connection: updated.connection,
          mode: updated.mode,
          lastError: updated.lastError,
          conflicts: updated.conflicts,
          remoteHeadOid: updated.remoteHeadOid,
          isSyncing: false,
        }
        notifyStatusChange()
      })

      client.on('sync:conflict', (e: any) => {
        console.warn('[GitLite] 检测到多端变更冲突，引擎已执行三路合并:', e)
      })

      // GitLite 0.4.0：状态机变化实时推送，收到后整体刷新同步维度字段
      client.on('status:change', () => {
        mergeSyncStatus(client)
        notifyStatusChange()
      })

      notifyStatusChange()
      return client
    } catch (err: any) {
      console.warn(`[GitLite] 数据库连接异常: ${err?.message || err}`)
      const fallbackProvider = new MemoryProvider()
      const fallbackClient = await GitLiteClient.create({
        provider: fallbackProvider,
        runtime,
        ref: { owner: 'local-user', repo: 'gitlite-repo' },
        database,
        allowForeignRepo: true,
      })

      dbInstance = fallbackClient
      await fallbackClient.putSchema('config', CONFIG_SCHEMA)
      await fallbackClient.putSchema('records', RECORDS_SCHEMA)

      configCol = fallbackClient.collection<DbConfigDoc>('config')
      recordsCol = fallbackClient.collection<DbRecordDoc>('records')

      currentDbStatus = {
        isReady: true,
        provider: `${providerName} (offline)`,
        database,
        online: false,
        pendingOps: 0,
        lastSyncAt: null,
        error: friendlyGitLiteError(err),
        isSyncing: false,
        connection: 'offline',
        mode: 'fully-local',
      }
      notifyStatusChange()
      if (options?.force) {
        throw err
      }
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
    mergeSyncStatus(db)
    currentDbStatus = {
      ...currentDbStatus,
      lastSyncAt: currentDbStatus.lastSyncAt || new Date().toLocaleTimeString(),
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
    mergeSyncStatus(db)
    currentDbStatus = {
      ...currentDbStatus,
      lastSyncAt: currentDbStatus.lastSyncAt || new Date().toLocaleTimeString(),
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
 * GitLite 0.4.0 双向同步：先拉取远端最新变更并三路合并，再推送本地增量
 */
export async function syncNowBothWays(): Promise<{ pushed: boolean; pulled: boolean }> {
  const db = await getOrInitGitLiteDB()
  currentDbStatus.isSyncing = true
  notifyStatusChange()

  try {
    const result = await db.syncNow()
    mergeSyncStatus(db)
    currentDbStatus = {
      ...currentDbStatus,
      lastSyncAt: currentDbStatus.lastSyncAt || new Date().toLocaleTimeString(),
      isSyncing: false,
    }
    notifyStatusChange()
    return result
  } catch (e: any) {
    currentDbStatus.isSyncing = false
    notifyStatusChange()
    throw e
  }
}

/**
 * 对端平台数据分支的远端 HEAD 状态（供仓库对齐预览使用）
 */
export type RemoteHeadState =
  | { state: 'ok'; oid: string; message: string; committedAt: string | null }
  | { state: 'no-token' }
  | { state: 'no-branch' }
  | { state: 'error'; message: string }

/**
 * 读取指定平台 gitlite-repo 数据分支的远端最新提交（不触碰当前 db 连接）
 */
export async function fetchRemoteHeadOf(
  provider: 'github' | 'gitee'
): Promise<RemoteHeadState> {
  const runtime = createUniversalRuntime()
  const token = (await runtime.credential.get(`gitlite:${provider}:token`)) ?? undefined
  if (!token) {
    return { state: 'no-token' }
  }

  try {
    // 仓库名与分支命名和 getOrInitGitLiteDB 保持一致
    const prov =
      provider === 'github'
        ? new GitHubProvider(token, runtime.fetch)
        : new GiteeProvider(token, runtime.fetch)
    const user = await prov.getUser()
    const commits = await prov.listCommits(
      { owner: user.login, repo: 'gitlite-repo' },
      'gitlite/workhour-tracker',
      { limit: 1 }
    )
    if (!commits || commits.length === 0) {
      return { state: 'no-branch' }
    }
    const head = commits[0]
    return { state: 'ok', oid: head.oid, message: head.message, committedAt: head.committedAt }
  } catch (err: any) {
    // 分支尚未创建 / 仓库不存在（NotFoundError 类）按无分支处理
    if (err?.name === 'NotFoundError' || /not found/i.test(String(err?.message ?? ''))) {
      return { state: 'no-branch' }
    }
    return { state: 'error', message: friendlyGitLiteError(err) }
  }
}

/**
 * 仓库对齐：以当前连接平台的数据仓库为源，把另一平台的数据仓库收敛镜像为当前状态
 * （幂等、绝不 force push、只删除目标侧 GitLite 自有且源没有的路径）
 */
export async function alignOtherPlatformRepo(): Promise<MirrorResult> {
  const provider = currentDbStatus.provider
  if (
    !dbInstance ||
    currentDbStatus.mode === 'fully-local' ||
    (provider !== 'github' && provider !== 'gitee')
  ) {
    throw new Error('当前未连接云端仓库，请先在连接配置中连接 GitHub/Gitee')
  }

  const other = provider === 'github' ? 'gitee' : 'github'

  try {
    const runtime = createUniversalRuntime()
    const otherToken = (await runtime.credential.get(`gitlite:${other}:token`)) ?? undefined
    if (!otherToken) {
      throw new Error(`未配置 ${other.toUpperCase()} 的访问令牌，请先在连接配置中添加`)
    }

    // 动态 import：保证主包不拉 @gitlite/sdk，仅在真正对齐时加载浏览器安全子路径
    const { mirrorTo } = await import('@gitlite/sdk/browser')
    const result = await mirrorTo(
      dbInstance,
      { provider: other, token: otherToken },
      {
        runtime,
        onProgress: (step, detail) => console.log('[GitLite] mirror:', step, detail ?? ''),
      }
    )

    mergeSyncStatus(dbInstance)
    notifyStatusChange()
    return result
  } catch (err: any) {
    throw new Error(friendlyGitLiteError(err))
  }
}

/**
 * 读取凭据库中已保存的各平台访问令牌「是否存在」（绝不返回 token 内容）
 */
export async function getSavedTokenInfo(): Promise<{ github: boolean; gitee: boolean }> {
  const runtime = createUniversalRuntime()
  const [github, gitee] = await Promise.all([
    runtime.credential.get('gitlite:github:token'),
    runtime.credential.get('gitlite:gitee:token'),
  ])
  return { github: !!github, gitee: !!gitee }
}

/**
 * 分页获取同步历史列表（GitLite 0.4.0 HistoryService）
 * 列表场景关闭逐条文件数/文档统计（缺省开启时每条额外消耗 3~5 次远端调用，
 * 极易打满 GitLiteClient 缺省 60 次/小时配额，导致 sync.flush 抛 QuotaExceededError）；
 * 统计信息由用户点开详情时经 fetchHistoryDetail 按需获取
 */
export async function fetchHistoryList(opts?: {
  limit?: number
  page?: number
}): Promise<HistoryEntry[]> {
  const db = await getOrInitGitLiteDB()
  return db.history.list({ ...opts, fileCounts: false, docCounts: false })
}

/**
 * 获取某次提交的详情（文件清单 + 文档级变更明细）
 */
export async function fetchHistoryDetail(oid: string): Promise<HistoryDetail> {
  const db = await getOrInitGitLiteDB()
  return db.history.detail(oid)
}

/**
 * 合并式恢复到指定快照：只补缺失/更旧文档，不删除当前已有数据
 */
export async function restoreHistorySnapshot(
  oid: string,
  opts?: { dryRun?: boolean; force?: boolean }
): Promise<RestoreResult> {
  const db = await getOrInitGitLiteDB()
  return db.history.restore(oid, opts)
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

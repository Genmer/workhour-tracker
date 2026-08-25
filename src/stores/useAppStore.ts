import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AppConfig, WeekType, WorkRecord } from '../types'
import { DEFAULT_CONFIG } from '../constants'
import { calculateDailyHours, toDateId } from '../utils/workHours'
import {
  getOrInitGitLiteDB,
  getAppConfigFromDb,
  saveAppConfigToDb,
  getAllRecordsFromDb,
  saveRecordToDb,
  deleteRecordFromDb,
  importLegacyBackupToDb,
  exportDbBackup,
  getDbStatus,
  subscribeDbStatus,
  syncFlushNow,
  syncPullNow,
  syncNowBothWays,
  restoreHistorySnapshot,
  type RestoreResult,
} from '../services/gitlite'
import dayjs from 'dayjs'
import { Platform } from 'react-native'

function createStorage() {
  if (Platform.OS === 'web') {
    return {
      getItem: (name: string) => {
        const value = localStorage.getItem(name)
        return value ?? null
      },
      setItem: (name: string, value: string) => {
        localStorage.setItem(name, value)
      },
      removeItem: (name: string) => {
        localStorage.removeItem(name)
      },
    }
  }

  const { createMMKV } = require('react-native-mmkv')
  const storage = createMMKV()

  return {
    getItem: (name: string) => {
      const value = storage.getString(name)
      return value ?? null
    },
    setItem: (name: string, value: string) => {
      storage.set(name, value)
    },
    removeItem: (name: string) => {
      storage.remove(name)
    },
  }
}

const storageAdapter = createStorage()

export interface GitLiteStatus {
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

interface AppState {
  config: AppConfig
  records: Record<string, WorkRecord>
  hasInitializedThisMonth: boolean
  lastInitializedMonth: string
  dbStatus: GitLiteStatus

  initDatabase: () => Promise<void>
  syncToCloud: () => Promise<void>
  pullFromCloud: () => Promise<void>
  syncNow: () => Promise<void>
  restoreSnapshot: (oid: string) => Promise<RestoreResult>
  reconnectProvider: (provider: 'github' | 'gitee' | 'memory', token?: string) => Promise<void>

  updateConfig: (config: Partial<AppConfig>) => void
  setMonthlyTargetDays: (days: number) => void
  setCurrentWeekType: (type: WeekType) => void

  clockOut: (time?: string) => void
  undoClockOut: (dateId: string) => void
  toggleLeave: (dateId: string) => void
  setRecordTime: (dateId: string, clockOutTime: string) => void

  getRecord: (dateId: string) => WorkRecord | undefined
  getWeekRecords: (date: dayjs.Dayjs) => WorkRecord[]
  getMonthRecords: (month: dayjs.Dayjs) => WorkRecord[]

  markMonthInitialized: () => void
  resetMonthInitialization: () => void

  importBackup: (data: { config?: Partial<AppConfig>; records?: Record<string, WorkRecord> }) => Promise<{ importedRecordsCount: number; importedConfig: boolean }>
  exportBackup: () => Promise<{ config: AppConfig; records: Record<string, WorkRecord>; exportDate: string }>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_CONFIG },
      records: {},
      hasInitializedThisMonth: false,
      lastInitializedMonth: '',
      dbStatus: getDbStatus(),

      initDatabase: async () => {
        try {
          // 订阅 GitLite 数据库状态
          subscribeDbStatus((status) => {
            set({ dbStatus: status })
          })

          const db = await getOrInitGitLiteDB()

          // 从 GitLite 数据库拉取并同步到当前内存 Store
          const dbConfig = await getAppConfigFromDb()
          const dbRecords = await getAllRecordsFromDb()

          const currentRecords = get().records
          const currentConfig = get().config

          // 若 GitLite 数据库已有数据，则以云端/嵌入式 DB 为准
          if (Object.keys(dbRecords).length > 0 || dbConfig) {
            set((state) => ({
              config: dbConfig ? { ...state.config, ...dbConfig } : state.config,
              records: { ...state.records, ...dbRecords },
            }))
          } else if (Object.keys(currentRecords).length > 0) {
            // 首次迁移：将本地存量数据同步沉淀至 GitLite 数据库中
            await importLegacyBackupToDb({
              config: currentConfig,
              records: currentRecords,
            })
          }

          // 监听远端拉取与变更事件
          db.on('remoteChange', async () => {
            const freshRecords = await getAllRecordsFromDb()
            const freshConfig = await getAppConfigFromDb()
            set((state) => ({
              config: freshConfig ? { ...state.config, ...freshConfig } : state.config,
              records: freshRecords,
            }))
          })
        } catch (e: any) {
          console.warn('[GitLite] 数据同步初始化捕获:', e)
        }
      },

      syncToCloud: async () => {
        await syncFlushNow()
        const freshRecords = await getAllRecordsFromDb()
        const freshConfig = await getAppConfigFromDb()
        set((state) => ({
          config: freshConfig ? { ...state.config, ...freshConfig } : state.config,
          records: freshRecords,
        }))
      },

      pullFromCloud: async () => {
        await syncPullNow()
        const freshRecords = await getAllRecordsFromDb()
        const freshConfig = await getAppConfigFromDb()
        set((state) => ({
          config: freshConfig ? { ...state.config, ...freshConfig } : state.config,
          records: freshRecords,
        }))
      },

      syncNow: async () => {
        await syncNowBothWays()
        const freshRecords = await getAllRecordsFromDb()
        const freshConfig = await getAppConfigFromDb()
        set((state) => ({
          config: freshConfig ? { ...state.config, ...freshConfig } : state.config,
          records: freshRecords,
        }))
      },

      restoreSnapshot: async (oid) => {
        // 合并式恢复（非 dryRun）：只补缺失/更旧文档，不删除当前已有数据
        const result = await restoreHistorySnapshot(oid)
        const freshRecords = await getAllRecordsFromDb()
        const freshConfig = await getAppConfigFromDb()
        set((state) => ({
          config: freshConfig ? { ...state.config, ...freshConfig } : state.config,
          records: freshRecords,
        }))
        return result
      },

      reconnectProvider: async (provider, token) => {
        await getOrInitGitLiteDB({ provider, token, force: true })
        const freshRecords = await getAllRecordsFromDb()
        const freshConfig = await getAppConfigFromDb()
        set((state) => ({
          config: freshConfig ? { ...state.config, ...freshConfig } : state.config,
          records: freshRecords,
        }))
      },

      updateConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig },
        }))
        void saveAppConfigToDb(newConfig)
      },

      setMonthlyTargetDays: (days) => {
        const currentMonth = dayjs().format('YYYY-MM')
        set((state) => ({
          config: { ...state.config, monthlyTargetDays: days },
          hasInitializedThisMonth: true,
          lastInitializedMonth: currentMonth,
        }))
        void saveAppConfigToDb({
          monthlyTargetDays: days,
        })
      },

      setCurrentWeekType: (type) => {
        set((state) => ({
          config: { ...state.config, currentWeekType: type },
        }))
        void saveAppConfigToDb({ currentWeekType: type })
      },

      clockOut: (time) => {
        const now = dayjs()
        const dateId = toDateId(now)
        const clockOutTime = time ?? now.format('HH:mm')
        const { dailyStartTime, lunchBreakHours } = get().config
        const actualWorkHours = calculateDailyHours(
          clockOutTime,
          dailyStartTime,
          lunchBreakHours
        )

        const newRecord: WorkRecord = {
          dateId,
          clockOutTime,
          actualWorkHours,
          isLeave: false,
        }

        set((state) => ({
          records: {
            ...state.records,
            [dateId]: newRecord,
          },
        }))

        void saveRecordToDb(newRecord)
      },

      undoClockOut: (dateId) => {
        set((state) => {
          const { [dateId]: _, ...rest } = state.records
          return { records: rest }
        })
        void deleteRecordFromDb(dateId)
      },

      toggleLeave: (dateId) => {
        const existing = get().records[dateId]
        if (existing && existing.isLeave) {
          // 取消请假：重置该日记录
          set((state) => {
            const { [dateId]: _, ...rest } = state.records
            return { records: rest }
          })
          void deleteRecordFromDb(dateId)
          return
        }

        const leaveRecord: WorkRecord = {
          dateId,
          clockOutTime: null,
          actualWorkHours: 0,
          isLeave: true,
        }

        set((state) => ({
          records: {
            ...state.records,
            [dateId]: leaveRecord,
          },
        }))

        void saveRecordToDb(leaveRecord)
      },

      setRecordTime: (dateId, clockOutTime) => {
        const { dailyStartTime, lunchBreakHours } = get().config
        const actualWorkHours = calculateDailyHours(
          clockOutTime,
          dailyStartTime,
          lunchBreakHours
        )

        const record: WorkRecord = {
          dateId,
          clockOutTime,
          actualWorkHours,
          isLeave: false,
        }

        set((state) => ({
          records: {
            ...state.records,
            [dateId]: record,
          },
        }))

        void saveRecordToDb(record)
      },

      getRecord: (dateId) => get().records[dateId],

      getWeekRecords: (date) => {
        const records = get().records
        const dayOfWeek = date.day()
        const start = date.subtract(dayOfWeek === 0 ? 6 : dayOfWeek - 1, 'day')
        const weekRecords: WorkRecord[] = []

        for (let i = 0; i < 7; i++) {
          const d = start.add(i, 'day')
          const id = toDateId(d)
          if (records[id]) {
            weekRecords.push(records[id])
          }
        }

        return weekRecords
      },

      getMonthRecords: (month) => {
        const records = get().records
        const start = month.startOf('month')
        const end = month.endOf('month')
        const monthRecords: WorkRecord[] = []

        let current = start
        while (current.isBefore(end) || current.isSame(end, 'day')) {
          const id = toDateId(current)
          if (records[id]) {
            monthRecords.push(records[id])
          }
          current = current.add(1, 'day')
        }

        return monthRecords
      },

      markMonthInitialized: () =>
        set({
          hasInitializedThisMonth: true,
          lastInitializedMonth: dayjs().format('YYYY-MM'),
        }),

      resetMonthInitialization: () =>
        set({
          hasInitializedThisMonth: false,
        }),

      importBackup: async (data) => {
        const res = await importLegacyBackupToDb(data)
        const freshConfig = await getAppConfigFromDb()
        const freshRecords = await getAllRecordsFromDb()

        set((state) => ({
          config: freshConfig ? { ...state.config, ...freshConfig } : state.config,
          records: freshRecords,
        }))

        return res
      },

      exportBackup: async () => {
        return await exportDbBackup()
      },
    }),
    {
      name: 'workhour-tracker-storage',
      storage: createJSONStorage(() => storageAdapter),
    }
  )
)

// 启动阶段立即执行后台静默连接与 GitLite 同步
void useAppStore.getState().initDatabase()

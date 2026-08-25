import { useState, useEffect } from 'react'
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/useAppStore'
import { COLORS } from '../constants'
import { Toast, ToastType } from '../components/Toast'
import { ConfirmModal } from '../components/ConfirmModal'
import {
  fetchHistoryList,
  fetchHistoryDetail,
  restoreHistorySnapshot,
  type HistoryEntry,
  type HistoryDetail,
  type RestoreResult,
} from '../services/gitlite'

/** 每页拉取的历史条数 */
const PAGE_SIZE = 20

/** 提交类型徽标元数据（不同底色区分） */
const KIND_META: Record<HistoryEntry['kind'], { label: string; bg: string; color: string }> = {
  sync: { label: '同步', bg: '#E3F2FD', color: '#1565C0' },
  restore: { label: '恢复', bg: '#E8F5E9', color: '#2E7D32' },
  mirror: { label: '镜像', bg: '#F3E5F5', color: '#7B1FA2' },
}

/** 文件变更状态徽标元数据 */
const FILE_STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  added: { label: '新增', bg: '#E8F5E9', color: '#2E7D32' },
  modified: { label: '修改', bg: '#FFF3E0', color: '#9A6700' },
  removed: { label: '删除', bg: '#FFEBEE', color: '#C62828' },
  changed: { label: '变更', bg: '#ECEFF1', color: '#546E7A' },
}

/** 格式化提交时间（null 降级显示占位符） */
function formatTime(committedAt: string | null): string {
  return committedAt ? dayjs(committedAt).format('MM-DD HH:mm') : '—'
}

/** 格式化文档级变更统计（null 降级显示占位符） */
function formatDocChanges(docChanges: HistoryEntry['docChanges']): string {
  return docChanges
    ? `+${docChanges.added} ~${docChanges.modified} -${docChanges.removed}`
    : '—'
}

/** 字段级变更值的紧凑展示（超长截断） */
function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 16 ? `${s.slice(0, 16)}…` : s
}

/** 离线场景（MemoryProvider 连通性校验）需要专门的兜底文案 */
function isOfflineError(e: any): boolean {
  return /offline|connectivity/i.test(String(e?.message ?? ''))
}

/** 历史详情仅支持近 100 条，超出范围引擎抛 NotFoundError，需要专门文案 */
function isNotFoundError(e: any): boolean {
  return e?.name === 'NotFoundError' || /not found/i.test(String(e?.message ?? ''))
}

export function HistoryScreen() {
  const { dbStatus, restoreSnapshot } = useAppStore()

  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [expandedOid, setExpandedOid] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ oid: string; data: HistoryDetail } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [restoringOid, setRestoringOid] = useState<string | null>(null)
  const [restoreConfirm, setRestoreConfirm] = useState<{ oid: string; plan: RestoreResult } | null>(
    null
  )

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  })

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type })
  }

  /** 加载第一页历史（恢复完成后静默刷新时不再展示全屏 loading） */
  const loadFirstPage = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const list = await fetchHistoryList({ limit: PAGE_SIZE, page: 1 })
      setEntries(list)
      setPage(1)
      setHasMore(list.length === PAGE_SIZE)
    } catch (e: any) {
      setEntries([])
      setHasMore(false)
      showToast(e?.message || '加载历史记录失败', 'error')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const loadMore = async () => {
    if (loadingMore || loading) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const list = await fetchHistoryList({ limit: PAGE_SIZE, page: nextPage })
      // 分页期间新 commit 落库会使列表前移，按已有 oid 过滤重复条目，避免重复 React key
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.oid))
        return [...prev, ...list.filter((e) => !seen.has(e.oid))]
      })
      setPage(nextPage)
      setHasMore(list.length === PAGE_SIZE)
    } catch (e: any) {
      showToast(e?.message || '加载更多历史失败', 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  /** 展开 / 收起单条历史详情 */
  const toggleExpand = async (oid: string) => {
    if (expandedOid === oid) {
      setExpandedOid(null)
      setDetail(null)
      return
    }
    setExpandedOid(oid)
    setDetail(null)
    setLoadingDetail(true)
    try {
      const data = await fetchHistoryDetail(oid)
      setDetail({ oid, data })
    } catch (e: any) {
      setExpandedOid(null)
      showToast(
        isNotFoundError(e) ? '该记录已超出可查询范围（仅支持最近约 100 条详情）' : e?.message || '加载历史详情失败',
        'error'
      )
    } finally {
      setLoadingDetail(false)
    }
  }

  /** 点击恢复：先 dryRun 拿恢复计划，经用户确认后再真正执行 */
  const handleRestorePress = async (oid: string) => {
    if (restoringOid) return
    setRestoringOid(oid)
    try {
      const plan = await restoreHistorySnapshot(oid, { dryRun: true })
      if (!plan.restored) {
        showToast('当前数据已包含该快照内容，无需恢复', 'info')
        return
      }
      setRestoreConfirm({ oid, plan })
    } catch (e: any) {
      showToast(isOfflineError(e) ? '恢复需要云端连接' : e?.message || '生成恢复计划失败', 'error')
    } finally {
      setRestoringOid(null)
    }
  }

  const handleConfirmRestore = async () => {
    if (!restoreConfirm) return
    const { oid } = restoreConfirm
    setRestoreConfirm(null)
    setRestoringOid(oid)
    try {
      const res = await restoreSnapshot(oid)
      showToast(`已恢复 ${res.restored} 条，保留当前 ${res.keptCurrent} 条`, 'success')
      // 恢复本身会产生新 commit，刷新列表并收起展开态
      setExpandedOid(null)
      setDetail(null)
      await loadFirstPage(false)
    } catch (e: any) {
      showToast(isOfflineError(e) ? '恢复需要云端连接' : e?.message || '恢复失败，请稍后重试', 'error')
    } finally {
      setRestoringOid(null)
    }
  }

  // 进入页面自动加载第一页
  useEffect(() => {
    void loadFirstPage()
  }, [])

  // 顶部连接状态（connection 未上报时按检测中处理）
  const connectionMeta =
    dbStatus.connection === 'online'
      ? { icon: '🟢', label: '已连接云端' }
      : dbStatus.connection === 'offline'
      ? { icon: '⚪', label: '离线本地' }
      : { icon: '🔄', label: '检测中' }
  const providerLabel =
    dbStatus.provider === 'github'
      ? 'GitHub'
      : dbStatus.provider === 'gitee'
      ? 'Gitee'
      : '本地存储'

  /** 渲染恢复确认弹窗文案：missing=当前缺失可找回 / snapshot-newer=回滚到快照更新版本
   *  plan.docs 可能被引擎截断（仅前 50 条），细分计数与总数对不上时省略，保证数字自洽 */
  const buildRestoreMessage = (plan: RestoreResult) => {
    const docs = plan.docs ?? []
    if (docs.length < plan.restored) {
      return `将恢复 ${plan.restored} 条文档，不影响当前已有数据。`
    }
    const missing = docs.filter((d) => d.reason === 'missing').length
    const rollback = docs.filter((d) => d.reason === 'snapshot-newer').length
    return `将恢复 ${plan.restored} 条文档（missing 找回 ${missing} 条 / 回滚到快照 ${rollback} 条），不影响当前已有数据。`
  }

  const renderDetail = (oid: string) => {
    if (loadingDetail && !detail) {
      return (
        <View style={styles.detailLoading}>
          <ActivityIndicator size="small" color={COLORS.textSecondary} />
        </View>
      )
    }
    if (!detail || detail.oid !== oid) return null

    const { data } = detail
    const docDetails = data.docDetails ?? []

    return (
      <View style={styles.detailContainer}>
        <Text style={styles.detailTitle}>文件变更（{data.files.length}）</Text>
        {data.files.length === 0 && <Text style={styles.detailEmpty}>无文件记录</Text>}
        {data.files.map((f) => {
          const meta = FILE_STATUS_META[f.status] ?? FILE_STATUS_META.changed
          return (
            <View key={f.path} style={styles.fileRow}>
              <Text style={styles.filePath} numberOfLines={1}>
                {f.path}
              </Text>
              <View style={[styles.miniBadge, { backgroundColor: meta.bg }]}>
                <Text style={[styles.miniBadgeText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
          )
        })}
        {data.truncated && (
          <Text style={styles.truncateHint}>文件列表已截断，仅显示部分变更</Text>
        )}

        <Text style={styles.detailTitle}>
          文档明细{data.docChanges ? `（${formatDocChanges(data.docChanges)}）` : ''}
        </Text>
        {docDetails.length === 0 && (
          <Text style={styles.detailEmpty}>{data.docChanges ? '暂无明细' : '该提交不支持文档级明细'}</Text>
        )}
        {docDetails.map((d) => {
          const meta = FILE_STATUS_META[d.status] ?? FILE_STATUS_META.changed
          return (
            <View key={`${d.collection}/${d.id}`} style={styles.docItem}>
              <View style={styles.docItemHeader}>
                <Text style={styles.docPath} numberOfLines={1}>
                  {d.collection} / {d.id}
                </Text>
                <View style={[styles.miniBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.miniBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              {d.status === 'modified' &&
                d.fields?.map((f) => (
                  <Text key={f.field} style={styles.fieldText} numberOfLines={2}>
                    {f.field}: {formatValue(f.before)} → {formatValue(f.after)}
                  </Text>
                ))}
            </View>
          )
        })}
        {data.docDetailsTruncated && (
          <Text style={styles.truncateHint}>文档明细已截断，仅显示前 50 条</Text>
        )}

        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={() => void handleRestorePress(oid)}
          disabled={restoringOid === oid}
          activeOpacity={0.7}
        >
          {restoringOid === oid ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.restoreBtnText}>⏪ 恢复到此版本</Text>
          )}
        </TouchableOpacity>
      </View>
    )
  }

  const renderEntry = (entry: HistoryEntry) => {
    const kindMeta = KIND_META[entry.kind] ?? KIND_META.sync
    const expanded = expandedOid === entry.oid
    return (
      <TouchableOpacity
        key={entry.oid}
        style={[styles.entryItem, expanded && styles.entryItemExpanded]}
        onPress={() => void toggleExpand(entry.oid)}
        activeOpacity={0.7}
      >
        <View style={styles.entryHeader}>
          <View style={[styles.kindBadge, { backgroundColor: kindMeta.bg }]}>
            <Text style={[styles.kindBadgeText, { color: kindMeta.color }]}>{kindMeta.label}</Text>
          </View>
          <Text style={styles.entryTime}>{formatTime(entry.committedAt)}</Text>
          {entry.groupedCommits > 1 && (
            <Text style={styles.groupHint}>含{entry.groupedCommits}提交</Text>
          )}
          <Text style={styles.expandArrow}>{expanded ? '▲' : '▼'}</Text>
        </View>
        <Text style={styles.entryMessage} numberOfLines={2}>
          {entry.message || '（无提交说明）'}
        </Text>
        <View style={styles.entryStats}>
          <Text style={styles.oidText}>{entry.oid.slice(0, 7)}</Text>
          <Text style={styles.statText}>📄 {entry.filesChanged ?? '—'}</Text>
          <Text style={styles.statText}>{formatDocChanges(entry.docChanges)}</Text>
        </View>
        {expanded && renderDetail(entry.oid)}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>同步历史</Text>
        </View>

        {/* 连接状态卡片 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GitLite 数据源</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>
              {connectionMeta.icon} {connectionMeta.label}
            </Text>
            <Text style={styles.providerBadge}>{providerLabel}</Text>
          </View>
        </View>

        {/* 历史列表卡片 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>历史版本（Git 提交）</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🗂️</Text>
              <Text style={styles.emptyTitle}>暂无同步历史</Text>
              <Text style={styles.emptyDesc}>
                每次推送、拉取或恢复数据时，GitLite 会生成一条提交记录，届时可在此查看详情并恢复到任意版本。
              </Text>
            </View>
          ) : (
            <>
              {entries.map(renderEntry)}
              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => void loadMore()}
                  disabled={loadingMore}
                  activeOpacity={0.7}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={COLORS.textSecondary} />
                  ) : (
                    <Text style={styles.loadMoreText}>加载更多</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* 恢复确认弹窗（基于 dryRun 恢复计划） */}
      <ConfirmModal
        visible={restoreConfirm != null}
        title="恢复到该版本"
        message={restoreConfirm ? buildRestoreMessage(restoreConfirm.plan) : ''}
        confirmText="确认恢复"
        onConfirm={() => void handleConfirmRestore()}
        onCancel={() => setRestoreConfirm(null)}
      />

      {/* 全局浮动反馈 Toast */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingBottom: 40,
  },
  titleContainer: {
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: 16,
    paddingBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  providerBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  entryItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.separator,
  },
  entryItemExpanded: {
    backgroundColor: COLORS.background,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kindBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  kindBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  entryTime: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  groupHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },
  expandArrow: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginLeft: 'auto',
  },
  entryMessage: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 6,
    lineHeight: 19,
  },
  entryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  oidText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  statText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  detailContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.separator,
  },
  detailLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 6,
  },
  detailEmpty: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  filePath: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  docItem: {
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.separator,
  },
  docItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  docPath: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  fieldText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: 'JetBrainsMono-Regular',
    marginTop: 3,
  },
  truncateHint: {
    fontSize: 11,
    color: COLORS.warning,
    marginTop: 6,
  },
  restoreBtn: {
    height: 36,
    backgroundColor: COLORS.success,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadMoreBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
  },
})

import { useState } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import dayjs from 'dayjs'
import { useAppStore, type GitLiteStatus } from '../stores/useAppStore'
import { COLORS } from '../constants'
import { Toast, ToastType } from './Toast'
import { ConfirmModal } from './ConfirmModal'
import {
  fetchRemoteHeadOf,
  friendlyGitLiteError,
  type RemoteHeadState,
} from '../services/gitlite'

interface RepoAlignSectionProps {
  dbStatus: GitLiteStatus
  /** 对端平台缺少已保存 Token 时引导用户打开连接配置弹窗 */
  onNeedAuth: () => void
}

const PROVIDER_LABEL: Record<'github' | 'gitee', string> = {
  github: 'GitHub',
  gitee: 'Gitee',
}

/** 格式化远端提交时间（null 降级显示占位符） */
function formatCommitTime(committedAt: string | null): string {
  return committedAt ? dayjs(committedAt).format('YYYY-MM-DD HH:mm') : '时间未知'
}

/** 当前平台 HEAD 的紧凑描述（预取失败时回退 dbStatus.remoteHeadOid） */
function describeCurrentHead(
  current: 'github' | 'gitee',
  head: RemoteHeadState | null,
  fallbackOid?: string | null
): string {
  if (head && head.state === 'ok') {
    return `${PROVIDER_LABEL[current]} · 最新提交 ${formatCommitTime(head.committedAt)} / ${
      head.message || '（无提交说明）'
    } / ${head.oid.slice(0, 7)}`
  }
  return `${PROVIDER_LABEL[current]} · 最新提交 ${fallbackOid ? fallbackOid.slice(0, 7) : '暂无'}`
}

/** 渲染对端平台状态行（ok 显示时间/oid，no-branch 提示将自动建分支） */
function describeOtherHead(other: 'github' | 'gitee', head: RemoteHeadState): string {
  if (head.state === 'ok') {
    return `对端平台 ${PROVIDER_LABEL[other]} · 最新提交 ${formatCommitTime(head.committedAt)}（${head.oid.slice(0, 7)}）`
  }
  return `对端平台 ${PROVIDER_LABEL[other]} · 尚无数据分支（将自动创建）`
}

/**
 * 设置页「仓库对齐」区块：把另一平台的数据仓库对齐为当前平台状态
 * （幂等、不 force push、不删除用户文件；对齐前经远端 HEAD 预览 + 二次确认）
 */
export function RepoAlignSection({ dbStatus, onNeedAuth }: RepoAlignSectionProps) {
  const { alignRepos } = useAppStore()

  // aligning 同时承担「预览远端 HEAD」与「执行对齐」两阶段的防重复点击
  const [aligning, setAligning] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [currentHead, setCurrentHead] = useState<RemoteHeadState | null>(null)
  const [otherHead, setOtherHead] = useState<RemoteHeadState | null>(null)
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  })

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type })
  }

  // 当前平台（离线/纯本地模式在入口处已拦截，这里归一化兜底为 github）
  const currentProvider: 'github' | 'gitee' = dbStatus.provider.startsWith('gitee')
    ? 'gitee'
    : 'github'
  const otherProvider: 'github' | 'gitee' = currentProvider === 'github' ? 'gitee' : 'github'

  const handleAlignPress = async () => {
    if (aligning) return
    if (dbStatus.mode === 'fully-local' || dbStatus.provider.includes('offline')) {
      showToast('请先连接云端仓库', 'error')
      return
    }

    setAligning(true)
    try {
      // 预取两端远端 HEAD 用于确认框对比；当前平台预取失败仅降级展示，不阻断流程
      const [curHead, oHead] = await Promise.all([
        fetchRemoteHeadOf(currentProvider).catch(() => null),
        fetchRemoteHeadOf(otherProvider),
      ])
      if (oHead.state === 'no-token') {
        showToast(
          `未配置 ${PROVIDER_LABEL[otherProvider]} 的访问令牌，请先在连接配置中添加`,
          'error'
        )
        onNeedAuth()
        return
      }
      if (oHead.state === 'error') {
        showToast(oHead.message, 'error')
        return
      }
      setCurrentHead(curHead)
      setOtherHead(oHead)
      setConfirmVisible(true)
    } catch (e: any) {
      showToast(friendlyGitLiteError(e), 'error')
    } finally {
      setAligning(false)
    }
  }

  const handleConfirmAlign = async () => {
    if (aligning) return
    setConfirmVisible(false)
    setAligning(true)
    try {
      const result = await alignRepos()
      showToast(
        `对齐完成：推送 ${result.filesPushed} 文件、删除 ${result.filesDeleted} 文件、${result.commits} 个提交（配额用量 ${result.quotaUsed}）`,
        'success'
      )
    } catch (e: any) {
      showToast(friendlyGitLiteError(e), 'error')
    } finally {
      setAligning(false)
    }
  }

  return (
    <View style={styles.alignBox}>
      <Text style={styles.alignDesc}>
        将另一平台的数据仓库对齐为当前平台状态（幂等、不 force push、不删除你的用户文件）
      </Text>

      <TouchableOpacity
        style={styles.alignBtn}
        onPress={() => void handleAlignPress()}
        disabled={aligning}
        activeOpacity={0.7}
      >
        {aligning ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.alignBtnText}>⚖️ 对齐另一平台仓库</Text>
        )}
      </TouchableOpacity>

      <ConfirmModal
        visible={confirmVisible && otherHead != null}
        title="确认仓库对齐"
        message={
          otherHead
            ? [
                `当前平台 ${describeCurrentHead(currentProvider, currentHead, dbStatus.remoteHeadOid)}`,
                describeOtherHead(otherProvider, otherHead),
                '',
                `将把 ${PROVIDER_LABEL[otherProvider]} 对齐为 ${PROVIDER_LABEL[currentProvider]} 的当前状态，预计推送多少处差异以引擎计算为准。`,
              ].join('\n')
            : ''
        }
        confirmText="确认对齐"
        onConfirm={() => void handleConfirmAlign()}
        onCancel={() => setConfirmVisible(false)}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  alignBox: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.separator,
  },
  alignDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: 10,
  },
  alignBtn: {
    height: 38,
    backgroundColor: '#7B1FA2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alignBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})

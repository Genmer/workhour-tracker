import { useState, useMemo } from 'react'
import { StyleSheet, View, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppStore } from '../stores/useAppStore'
import { ClockOutButton } from '../components/ClockOutButton'
import { LeaveToggle } from '../components/LeaveToggle'
import { ProgressCard } from '../components/ProgressCard'
import { TimePickerModal } from '../components/TimePickerModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { GitLiteAuthModal } from '../components/GitLiteAuthModal'
import { Toast, ToastType } from '../components/Toast'
import { COLORS } from '../constants'
import { useLiveTime } from '../utils/useLiveTime'
import { calculateMonthlyStats, calculateWeeklyStats, toDateId } from '../utils/workHours'
import dayjs from 'dayjs'

export function DashboardScreen() {
  const {
    config,
    records,
    dbStatus,
    clockOut,
    undoClockOut,
    toggleLeave,
    setRecordTime,
    syncToCloud,
    reconnectProvider,
  } = useAppStore()

  const today = useLiveTime()
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [undoConfirmVisible, setUndoConfirmVisible] = useState(false)
  const [authModalVisible, setAuthModalVisible] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  })

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type })
  }

  const todayId = toDateId(today)
  const todayRecord = records[todayId]
  const isClocked = todayRecord?.clockOutTime != null
  const isLeave = todayRecord?.isLeave ?? false

  const allRecords = useMemo(() => Object.values(records), [records])

  const weeklyStats = useMemo(() => {
    return calculateWeeklyStats(allRecords, {
      weekType: config.currentWeekType,
      dailyStartTime: config.dailyStartTime,
      lunchBreakHours: config.lunchBreakHours,
      targetDailyHours: config.targetDailyHours,
      overtimeEndTime: config.overtimeEndTime,
    })
  }, [allRecords, config])

  const monthlyStats = useMemo(() => {
    return calculateMonthlyStats(allRecords, {
      monthlyTargetDays: config.monthlyTargetDays,
      targetDailyHours: config.targetDailyHours,
      dailyStartTime: config.dailyStartTime,
      lunchBreakHours: config.lunchBreakHours,
      overtimeEndTime: config.overtimeEndTime,
    })
  }, [allRecords, config])

  const handleClockOutPress = () => {
    if (isClocked) {
      setUndoConfirmVisible(true)
    } else {
      clockOut()
      showToast('今日下班打卡成功！已即时落盘', 'success')
    }
  }

  const handleConfirmUndoClockOut = () => {
    setUndoConfirmVisible(false)
    undoClockOut(todayId)
    showToast('已撤销今日下班打卡记录', 'info')
  }

  const handleToggleLeave = () => {
    toggleLeave(todayId)
    if (isLeave) {
      showToast('已取消今日请假标记', 'info')
    } else {
      showToast('已标记今日为请假状态', 'success')
    }
  }

  const handleEditConfirm = (time: string) => {
    setRecordTime(todayId, time)
    setEditModalVisible(false)
    showToast(`下班时间已更新为 ${time}`, 'success')
  }

  const handleManualSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    showToast('正在推送到云端 Git 仓库...', 'info')

    try {
      await syncToCloud()
      showToast('本地记录已成功同步到云端！', 'success')
    } catch (e: any) {
      showToast(e?.message || '已保存在本地离线队列中', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleConnectProvider = async (provider: 'github' | 'gitee' | 'memory', token?: string) => {
    await reconnectProvider(provider, token)
    showToast(`已连接至 ${provider.toUpperCase()}！`, 'success')
  }

  // 格式化加班提示
  const renderOvertimeHint = (
    stats: { gap: number; overtimeDaysNeeded: number; alreadyOvertimeDays: number; todayOvertimeEndTime: string | null },
    label: string
  ) => {
    if (stats.gap <= 0) return null
    const { overtimeDaysNeeded, alreadyOvertimeDays, todayOvertimeEndTime, gap } = stats

    const fullDays = Math.floor(overtimeDaysNeeded)
    const hasFractional = overtimeDaysNeeded - fullDays > 0.01

    let hint = `${label}工时缺口 ${gap}h`
    if (alreadyOvertimeDays > 0) {
      hint += `，已加班 ${alreadyOvertimeDays} 天`
    }
    if (overtimeDaysNeeded > 0) {
      if (hasFractional) {
        hint += `，还需加班约 ${overtimeDaysNeeded} 天`
        if (todayOvertimeEndTime) {
          hint += `（最后一天到 ${todayOvertimeEndTime}）`
        }
      } else {
        hint += `，还需加班 ${fullDays} 天（每天到 ${config.overtimeEndTime}）`
      }
    }
    return hint
  }

  const weekHint = renderOvertimeHint(weeklyStats, '本周')
  const monthHint = renderOvertimeHint(monthlyStats, '本月')

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.greeting}>考勤补给站</Text>
          <Text style={styles.date}>{today.format('YYYY年M月D日 dddd')}</Text>

          {/* GitLite 状态指示胶囊 */}
          <TouchableOpacity
            style={styles.gitlitePill}
            onPress={() => setAuthModalVisible(true)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.pillDot,
                { backgroundColor: dbStatus.isReady ? COLORS.success : COLORS.warning },
              ]}
            />
            {isSyncing || dbStatus.isSyncing ? (
              <View style={styles.pillSyncing}>
                <ActivityIndicator size="small" color={COLORS.success} />
                <Text style={styles.pillText}>正在同步...</Text>
              </View>
            ) : (
              <Text style={styles.pillText}>
                {dbStatus.pendingOps && dbStatus.pendingOps > 0
                  ? `☁️ ${dbStatus.pendingOps} 条待同步 · 点击配置`
                  : `⚡ GitLite · ${
                      dbStatus.provider === 'github'
                        ? 'GitHub'
                        : dbStatus.provider === 'gitee'
                        ? 'Gitee'
                        : '本地离线'
                    } 已就绪`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.clockArea}>
          <ClockOutButton isClocked={isClocked} onPress={handleClockOutPress} />
          <LeaveToggle isLeave={isLeave} onPress={handleToggleLeave} />
        </View>

        {isClocked && todayRecord && (
          <TouchableOpacity
            style={styles.clockResult}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.clockResultBadge}>
              <Text style={styles.clockResultText}>
                下班时间 <Text style={styles.clockResultValue}>{todayRecord.clockOutTime}</Text> · 工时{' '}
                <Text style={styles.clockResultValue}>{todayRecord.actualWorkHours}h</Text>
              </Text>
              <Text style={styles.clockResultEditHint}>修改 ✏️</Text>
            </View>
          </TouchableOpacity>
        )}

        <ProgressCard
          title="本周进度"
          currentHours={weeklyStats.totalHours}
          targetHours={weeklyStats.targetHours}
          gap={weeklyStats.gap}
          leaveDays={weeklyStats.leaveDays}
          overtimeDaysNeeded={weeklyStats.overtimeDaysNeeded}
          alreadyOvertimeDays={weeklyStats.alreadyOvertimeDays}
        />

        <ProgressCard
          title="本月进度"
          currentHours={monthlyStats.totalHours}
          targetHours={monthlyStats.targetHours}
          gap={monthlyStats.gap}
          leaveDays={monthlyStats.leaveDays}
          overtimeDaysNeeded={monthlyStats.overtimeDaysNeeded}
          alreadyOvertimeDays={monthlyStats.alreadyOvertimeDays}
        />

        {weeklyStats.gap > 0 && weekHint && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertIcon}>📊</Text>
            <Text style={styles.alertText}>{weekHint}</Text>
          </View>
        )}

        {weeklyStats.gap <= 0 && (
          <View style={styles.successBanner}>
            <Text style={styles.alertIcon}>✅</Text>
            <Text style={styles.successText}>本周额外工时已达标</Text>
          </View>
        )}

        {monthlyStats.gap > 0 && monthHint && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.alertText}>{monthHint}</Text>
          </View>
        )}

        {monthlyStats.gap <= 0 && (
          <View style={styles.successBanner}>
            <Text style={styles.alertIcon}>✅</Text>
            <Text style={styles.successText}>本月工时已达标</Text>
          </View>
        )}
      </ScrollView>

      {/* 修改打卡时间弹窗 */}
      <TimePickerModal
        visible={editModalVisible}
        dateId={todayId}
        existingRecord={todayRecord}
        onConfirm={handleEditConfirm}
        onMarkLeave={handleToggleLeave}
        onClose={() => setEditModalVisible(false)}
      />

      {/* 撤销打卡确认弹窗 */}
      <ConfirmModal
        visible={undoConfirmVisible}
        title="撤销打卡"
        message="确定要撤销今日的下班打卡记录吗？"
        confirmText="确定撤销"
        confirmStyle="danger"
        onConfirm={handleConfirmUndoClockOut}
        onCancel={() => setUndoConfirmVisible(false)}
      />

      {/* GitLite 鉴权配置弹窗 */}
      <GitLiteAuthModal
        visible={authModalVisible}
        currentStatus={dbStatus}
        onClose={() => setAuthModalVisible(false)}
        onConnect={handleConnectProvider}
      />

      {/* 全局反馈 Toast */}
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
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  date: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '400',
  },
  gitlitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.separator,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillSyncing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  clockArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  clockResult: {
    alignItems: 'center',
    marginBottom: 24,
    minHeight: 20,
  },
  clockResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  clockResultText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  clockResultValue: {
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  clockResultEditHint: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
  },
  alertBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIcon: {
    fontSize: 18,
  },
  alertText: {
    fontSize: 13,
    color: '#9A6700',
    fontWeight: '500',
    flex: 1,
  },
  successText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
  },
})

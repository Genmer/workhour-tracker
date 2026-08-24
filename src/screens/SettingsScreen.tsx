import { useState, useEffect } from 'react'
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppStore } from '../stores/useAppStore'
import { COLORS } from '../constants'
import { WeekType } from '../types'
import { documentDirectory, writeAsStringAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy'
import { shareAsync } from 'expo-sharing'
import { Toast, ToastType } from '../components/Toast'
import { ConfirmModal } from '../components/ConfirmModal'
import { GitLiteAuthModal } from '../components/GitLiteAuthModal'

export function SettingsScreen() {
  const {
    config,
    records,
    dbStatus,
    updateConfig,
    setMonthlyTargetDays,
    importBackup,
    exportBackup,
    syncToCloud,
    pullFromCloud,
    reconnectProvider,
  } = useAppStore()

  const [targetDaysInput, setTargetDaysInput] = useState(String(config.monthlyTargetDays))
  const [startTimeInput, setStartTimeInput] = useState(config.dailyStartTime)
  const [lunchBreakInput, setLunchBreakInput] = useState(String(config.lunchBreakHours))
  const [targetHoursInput, setTargetHoursInput] = useState(String(config.targetDailyHours))
  const [overtimeEndInput, setOvertimeEndInput] = useState(config.overtimeEndTime)
  const [isFlushing, setIsFlushing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)

  // 弹窗与反馈状态
  const [authModalVisible, setAuthModalVisible] = useState(false)
  const [importConfirmVisible, setImportConfirmVisible] = useState(false)
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  })

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type })
  }

  useEffect(() => {
    setTargetDaysInput(String(config.monthlyTargetDays))
    setStartTimeInput(config.dailyStartTime)
    setLunchBreakInput(String(config.lunchBreakHours))
    setTargetHoursInput(String(config.targetDailyHours))
    setOvertimeEndInput(config.overtimeEndTime)
  }, [config])

  const handleSaveWorkHoursConfig = () => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(startTimeInput)) {
      showToast('上班时间格式需为 HH:mm（如 09:00）', 'error')
      return
    }
    if (!timeRegex.test(overtimeEndInput)) {
      showToast('加班基准格式需为 HH:mm（如 22:30）', 'error')
      return
    }

    const lunch = parseFloat(lunchBreakInput)
    if (isNaN(lunch) || lunch < 0 || lunch > 5) {
      showToast('午休时长需在 0 到 5 小时之间', 'error')
      return
    }

    const target = parseFloat(targetHoursInput)
    if (isNaN(target) || target <= 0 || target > 24) {
      showToast('每日目标工时需为有效数字（如 10.5）', 'error')
      return
    }

    updateConfig({
      dailyStartTime: startTimeInput,
      overtimeEndTime: overtimeEndInput,
      lunchBreakHours: lunch,
      targetDailyHours: target,
    })
    showToast('工时参数配置已保存 ✓', 'success')
  }

  const handleSaveTargetDays = () => {
    const days = parseInt(targetDaysInput, 10)
    if (days > 0 && days <= 31) {
      setMonthlyTargetDays(days)
      showToast(`本月出勤天数已设为 ${days} 天 ✓`, 'success')
    } else {
      showToast('请输入 1 到 31 之间的有效天数', 'error')
    }
  }

  const handleToggleWeekType = (type: WeekType) => {
    updateConfig({ currentWeekType: type })
    showToast(`已切换为${type === 'BIG_WEEK' ? '大周（单休）' : '小周（双休）'}`, 'info')
  }

  const handleManualFlush = async () => {
    if (isFlushing) return
    setIsFlushing(true)
    showToast('正在推送到云端 Git 仓库...', 'info')

    try {
      await syncToCloud()
      showToast('本地数据已打包 Commit 并同步到云端！', 'success')
    } catch (e: any) {
      showToast(e?.message || '已安全落盘至本地队列，将在联网时自动重推', 'error')
    } finally {
      setIsFlushing(false)
    }
  }

  const handleManualPull = async () => {
    if (isPulling) return
    setIsPulling(true)
    showToast('正在从云端拉取最新数据...', 'info')

    try {
      await pullFromCloud()
      showToast('已从云端拉取最新数据并完成三路合并！', 'success')
    } catch (e: any) {
      showToast(e?.message || '当前处于离线模式或网络未连接', 'error')
    } finally {
      setIsPulling(false)
    }
  }

  const handleConnectProvider = async (provider: 'github' | 'gitee' | 'memory', token?: string) => {
    await reconnectProvider(provider, token)
    showToast(`已成功切换至 ${provider.toUpperCase()} 平台！`, 'success')
  }

  const handleExport = async () => {
    try {
      const data = await exportBackup()
      const json = JSON.stringify(data, null, 2)
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'workhour-backup.json'
        a.click()
        URL.revokeObjectURL(url)
        showToast(`已导出 ${Object.keys(data.records).length} 条考勤记录备份`, 'success')
        return
      }
      const fileUri = documentDirectory + 'workhour-backup.json'
      await writeAsStringAsync(fileUri, json)
      await shareAsync(fileUri)
      showToast(`已导出 ${Object.keys(data.records).length} 条考勤记录备份`, 'success')
    } catch (error) {
      showToast('导出数据失败', 'error')
    }
  }

  const handleTriggerImport = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
          const text = await file.text()
          const data = JSON.parse(text)
          if (!data || typeof data !== 'object') {
            showToast('备份文件格式不正确', 'error')
            return
          }
          const res = await importBackup({
            config: data.config,
            records: data.records,
          })
          showToast(
            `已导入 ${res.importedRecordsCount} 条考勤记录${res.importedConfig ? '，配置已同步' : ''}`,
            'success'
          )
        } catch (err: any) {
          showToast(err?.message || '无法解析备份文件', 'error')
        }
      }
      input.click()
      return
    }

    setImportConfirmVisible(true)
  }

  const handleConfirmNativeImport = async () => {
    setImportConfirmVisible(false)
    try {
      const fileUri = documentDirectory + 'workhour-backup.json'
      const fileInfo = await getInfoAsync(fileUri)
      if (!fileInfo.exists) {
        showToast('未在本地找到备份文件 workhour-backup.json', 'error')
        return
      }

      const json = await readAsStringAsync(fileUri)
      const data = JSON.parse(json)

      if (!data || typeof data !== 'object') {
        showToast('备份文件格式不正确', 'error')
        return
      }

      const res = await importBackup({
        config: data.config,
        records: data.records,
      })

      showToast(
        `已成功导入 ${res.importedRecordsCount} 条考勤记录${res.importedConfig ? '，配置已同步' : ''}`,
        'success'
      )
    } catch (error: any) {
      showToast(error?.message || '无法解析备份文件', 'error')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>设置</Text>
        </View>

        {/* GitLite 嵌入式数据库状态 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GitLite 嵌入式云端数据库 (Local-First)</Text>
          <View style={styles.dbStatusRow}>
            <View style={styles.dbStatusIndicator}>
              <View
                style={[
                  styles.dbStatusDot,
                  { backgroundColor: dbStatus.isReady ? COLORS.success : COLORS.warning },
                ]}
              />
              <Text style={styles.dbStatusTitle}>
                {dbStatus.isReady ? '本地内存镜像已就绪' : '数据库连接中...'}
              </Text>
            </View>
            <Text style={styles.dbStatusBadge}>
              {dbStatus.provider === 'github'
                ? '🐙 GitHub 云端'
                : dbStatus.provider === 'gitee'
                ? '🔴 Gitee 云端'
                : '💾 本地离线'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>数据库分支</Text>
            <Text style={styles.infoValue}>gitlite/{dbStatus.database}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>同步策略</Text>
            <Text style={styles.infoValue}>Economy (低频批量·启动退出强制)</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>待同步批次</Text>
            <Text style={styles.infoValue}>{dbStatus.pendingOps ?? 0} 条操作缓冲 (已持久化)</Text>
          </View>

          <View style={styles.syncButtonGroup}>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={handleManualFlush}
              disabled={isFlushing}
              activeOpacity={0.7}
            >
              {isFlushing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.syncBtnText}>⚡ 立即推送到云端</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.syncBtn, styles.syncBtnSecondary]}
              onPress={handleManualPull}
              disabled={isPulling}
              activeOpacity={0.7}
            >
              {isPulling ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Text style={styles.syncBtnTextSecondary}>🔄 从云端拉取</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.switchPlatformBtn}
            onPress={() => setAuthModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.switchPlatformBtnText}>🔑 配置云端同步 / 切换平台 (GitHub / Gitee)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>工时配置</Text>
            <TouchableOpacity style={styles.headerSaveButton} onPress={handleSaveWorkHoursConfig}>
              <Text style={styles.headerSaveButtonText}>保存配置</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { flex: 1 }]}>上班时间 (HH:mm)</Text>
            <TextInput
              style={styles.timeInput}
              value={startTimeInput}
              onChangeText={setStartTimeInput}
              placeholder="09:00"
              maxLength={5}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { flex: 1 }]}>午休时长 (小时)</Text>
            <TextInput
              style={styles.input}
              value={lunchBreakInput}
              onChangeText={setLunchBreakInput}
              keyboardType="decimal-pad"
              maxLength={4}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { flex: 1 }]}>每日目标工时 (小时)</Text>
            <TextInput
              style={styles.input}
              value={targetHoursInput}
              onChangeText={setTargetHoursInput}
              keyboardType="decimal-pad"
              maxLength={4}
            />
          </View>

          <View style={[styles.inputRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.label, { flex: 1 }]}>加班基准时间 (HH:mm)</Text>
            <TextInput
              style={styles.timeInput}
              value={overtimeEndInput}
              onChangeText={setOvertimeEndInput}
              placeholder="22:30"
              maxLength={5}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>月度配置</Text>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { flex: 1 }]}>本月应出勤天数</Text>
            <TextInput
              style={styles.input}
              value={targetDaysInput}
              onChangeText={setTargetDaysInput}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveTargetDays}>
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>当前周类型</Text>
            <View style={styles.weekToggle}>
              <TouchableOpacity
                style={[
                  styles.weekToggleButton,
                  config.currentWeekType === 'BIG_WEEK' && styles.weekToggleActive,
                ]}
                onPress={() => handleToggleWeekType('BIG_WEEK')}
              >
                <Text
                  style={[
                    styles.weekToggleText,
                    config.currentWeekType === 'BIG_WEEK' && styles.weekToggleTextActive,
                  ]}
                >
                  大周
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.weekToggleButton,
                  config.currentWeekType === 'SMALL_WEEK' && styles.weekToggleActive,
                ]}
                onPress={() => handleToggleWeekType('SMALL_WEEK')}
              >
                <Text
                  style={[
                    styles.weekToggleText,
                    config.currentWeekType === 'SMALL_WEEK' && styles.weekToggleTextActive,
                  ]}
                >
                  小周
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>数据管理</Text>

          <TouchableOpacity style={styles.dataButton} onPress={handleExport} activeOpacity={0.7}>
            <Text style={styles.dataButtonText}>导出数据 (保留历史结构)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dataButton, styles.dataButtonLast]}
            onPress={handleTriggerImport}
            activeOpacity={0.7}
          >
            <Text style={[styles.dataButtonText, { color: COLORS.warning }]}>
              导入数据 (兼容历史备份)
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 平台鉴权与连接配置弹窗 */}
      <GitLiteAuthModal
        visible={authModalVisible}
        currentStatus={dbStatus}
        onClose={() => setAuthModalVisible(false)}
        onConnect={handleConnectProvider}
      />

      {/* 确认导入弹窗 */}
      <ConfirmModal
        visible={importConfirmVisible}
        title="确认导入备份"
        message="导入将把备份文件合并写入 GitLite 数据库并更新配置，是否继续？"
        confirmText="确定导入"
        confirmStyle="danger"
        onConfirm={handleConfirmNativeImport}
        onCancel={() => setImportConfirmVisible(false)}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
  },
  headerSaveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.success,
    borderRadius: 6,
  },
  headerSaveButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dbStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.separator,
  },
  dbStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dbStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dbStatusTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dbStatusBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.separator,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  syncButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  syncBtn: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.success,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBtnSecondary: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  syncBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  syncBtnTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  switchPlatformBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.separator,
    marginTop: 4,
  },
  switchPlatformBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.separator,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.separator,
    gap: 10,
    minHeight: 56,
  },
  label: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '400',
  },
  input: {
    width: 60,
    height: 40,
    borderWidth: 1.5,
    borderColor: COLORS.separator,
    borderRadius: 8,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 15,
    fontFamily: 'JetBrainsMono-Regular',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  timeInput: {
    width: 80,
    height: 40,
    borderWidth: 1.5,
    borderColor: COLORS.separator,
    borderRadius: 8,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 15,
    fontFamily: 'JetBrainsMono-Regular',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  saveButton: {
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: COLORS.success,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  weekToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  weekToggleButton: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekToggleActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  weekToggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  weekToggleTextActive: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  dataButton: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.separator,
  },
  dataButtonLast: {
    borderBottomWidth: 0,
  },
  dataButtonText: {
    fontSize: 15,
    color: COLORS.success,
    fontWeight: '500',
  },
})

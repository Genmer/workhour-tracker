import { useState, useEffect } from 'react'
import { StyleSheet, View, ScrollView, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppStore } from '../stores/useAppStore'
import { COLORS } from '../constants'
import { WeekType } from '../types'
import { documentDirectory, writeAsStringAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy'
import { shareAsync } from 'expo-sharing'

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
      Alert.alert('无效上班时间', '请输入 HH:mm 格式（例如 09:00）')
      return
    }
    if (!timeRegex.test(overtimeEndInput)) {
      Alert.alert('无效加班基准时间', '请输入 HH:mm 格式（例如 22:30）')
      return
    }

    const lunch = parseFloat(lunchBreakInput)
    if (isNaN(lunch) || lunch < 0 || lunch > 5) {
      Alert.alert('无效午休时长', '请输入 0 到 5 之间的小时数')
      return
    }

    const target = parseFloat(targetHoursInput)
    if (isNaN(target) || target <= 0 || target > 24) {
      Alert.alert('无效目标工时', '请输入有效的目标工时（如 10.5）')
      return
    }

    updateConfig({
      dailyStartTime: startTimeInput,
      overtimeEndTime: overtimeEndInput,
      lunchBreakHours: lunch,
      targetDailyHours: target,
    })
    Alert.alert('工时配置已保存 ✓')
  }

  const handleSaveTargetDays = () => {
    const days = parseInt(targetDaysInput, 10)
    if (days > 0 && days <= 31) {
      setMonthlyTargetDays(days)
      Alert.alert('已保存 ✓')
    } else {
      Alert.alert('无效输入', '请输入1-31之间的天数')
    }
  }

  const handleToggleWeekType = (type: WeekType) => {
    updateConfig({ currentWeekType: type })
  }

  const handleManualFlush = async () => {
    if (isFlushing) return
    setIsFlushing(true)
    try {
      await syncToCloud()
      Alert.alert('推送成功 ✓', '本地数据已打包为 Git Commit 并同步到云端！')
    } catch (e: any) {
      Alert.alert('推送提示', e?.message || '已安全缓存在本地离线队列中')
    } finally {
      setIsFlushing(false)
    }
  }

  const handleManualPull = async () => {
    if (isPulling) return
    setIsPulling(true)
    try {
      await pullFromCloud()
      Alert.alert('拉取成功 ✓', '已从云端 Git 仓库拉取最新数据并完成三路合并！')
    } catch (e: any) {
      Alert.alert('拉取提示', e?.message || '当前处于离线模式或网络未连接')
    } finally {
      setIsPulling(false)
    }
  }

  const handleSwitchPlatform = () => {
    Alert.alert('切换 GitLite 云端平台', '请选择你要绑定的 Git 云端平台：', [
      { text: '取消', style: 'cancel' },
      {
        text: 'GitHub',
        onPress: async () => {
          try {
            await reconnectProvider('github')
            Alert.alert('已切换至 GitHub', '正在自动探测/连接私有仓库 gitlite-repo')
          } catch (e: any) {
            Alert.alert('连接提示', e?.message || '连接失败')
          }
        },
      },
      {
        text: 'Gitee',
        onPress: async () => {
          try {
            await reconnectProvider('gitee')
            Alert.alert('已切换至 Gitee', '正在自动探测/连接私有仓库 gitlite-repo')
          } catch (e: any) {
            Alert.alert('连接提示', e?.message || '连接失败')
          }
        },
      },
    ])
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
        Alert.alert('数据已导出 ✓', `已导出 ${Object.keys(data.records).length} 条考勤记录`)
        return
      }
      const fileUri = documentDirectory + 'workhour-backup.json'
      await writeAsStringAsync(fileUri, json)
      await shareAsync(fileUri)
      Alert.alert('数据已导出 ✓', `已导出 ${Object.keys(data.records).length} 条考勤记录`)
    } catch (error) {
      Alert.alert('导出失败', '无法导出数据')
    }
  }

  const handleImport = async () => {
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
            Alert.alert('导入失败', '备份文件格式不正确')
            return
          }
          const res = await importBackup({
            config: data.config,
            records: data.records,
          })
          Alert.alert(
            '导入成功 ✓',
            `已成功导入 ${res.importedRecordsCount} 条考勤记录${res.importedConfig ? '，配置已同步更新' : ''}`
          )
        } catch (err: any) {
          Alert.alert('导入失败', err?.message || '无法解析备份文件')
        }
      }
      input.click()
      return
    }

    Alert.alert('确认导入', '导入将把备份文件合并写入 GitLite 数据库并更新配置，是否继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定导入',
        style: 'destructive',
        onPress: async () => {
          try {
            const fileUri = documentDirectory + 'workhour-backup.json'
            const fileInfo = await getInfoAsync(fileUri)
            if (!fileInfo.exists) {
              Alert.alert('导入失败', '未在本地找到备份文件 workhour-backup.json，请先导出或放置备份文件。')
              return
            }

            const json = await readAsStringAsync(fileUri)
            const data = JSON.parse(json)

            if (!data || (typeof data !== 'object')) {
              Alert.alert('导入失败', '备份文件格式不正确')
              return
            }

            // 严格兼容历史格式与新格式
            const res = await importBackup({
              config: data.config,
              records: data.records,
            })

            Alert.alert(
              '导入成功 ✓',
              `已成功导入 ${res.importedRecordsCount} 条考勤记录${res.importedConfig ? '，配置已同步更新' : ''}`
            )
          } catch (error: any) {
            Alert.alert('导入失败', error?.message || '无法解析备份文件')
          }
        },
      },
    ])
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
              {dbStatus.provider === 'github' ? 'GitHub 云端分支' : dbStatus.provider}
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
            >
              {isPulling ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Text style={styles.syncBtnTextSecondary}>🔄 从云端拉取</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.switchPlatformBtn} onPress={handleSwitchPlatform}>
            <Text style={styles.switchPlatformBtnText}>🔑 切换平台 (GitHub / Gitee)</Text>
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

          <TouchableOpacity style={styles.dataButton} onPress={handleExport}>
            <Text style={styles.dataButtonText}>导出数据 (保留历史结构)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dataButton, styles.dataButtonLast]} onPress={handleImport}>
            <Text style={[styles.dataButtonText, { color: COLORS.warning }]}>导入数据 (兼容历史备份)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    fontWeight: '500',
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
    color: '#007AFF',
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

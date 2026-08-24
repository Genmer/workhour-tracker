import { useState } from 'react'
import { StyleSheet, View, ScrollView, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppStore } from '../stores/useAppStore'
import { CalendarGrid } from '../components/CalendarGrid'
import { Heatmap } from '../components/Heatmap'
import { TimePickerModal } from '../components/TimePickerModal'
import { Toast, ToastType } from '../components/Toast'
import { COLORS } from '../constants'
import { useLiveTime } from '../utils/useLiveTime'
import dayjs from 'dayjs'

export function CalendarScreen() {
  const { config, records, setRecordTime, toggleLeave } = useAppStore()
  const liveToday = useLiveTime()
  const [currentMonth, setCurrentMonth] = useState(() => dayjs())
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null)
  const [pickerVisible, setPickerVisible] = useState(false)

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  })

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type })
  }

  const handlePrevMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, 'month'))
  }

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'))
  }

  const handleDayPress = (dateId: string) => {
    setSelectedDateId(dateId)
    setPickerVisible(true)
  }

  const handleTimeConfirm = (clockOutTime: string) => {
    if (selectedDateId) {
      setRecordTime(selectedDateId, clockOutTime)
      showToast(`${selectedDateId} 下班时间已更新为 ${clockOutTime}`, 'success')
    }
    setPickerVisible(false)
    setSelectedDateId(null)
  }

  const handleMarkLeave = () => {
    if (selectedDateId) {
      toggleLeave(selectedDateId)
      const existing = records[selectedDateId]
      if (existing?.isLeave) {
        showToast(`已取消 ${selectedDateId} 的请假标记`, 'info')
      } else {
        showToast(`已将 ${selectedDateId} 标记为请假`, 'success')
      }
    }
    setPickerVisible(false)
    setSelectedDateId(null)
  }

  const handleClose = () => {
    setPickerVisible(false)
    setSelectedDateId(null)
  }

  const selectedRecord = selectedDateId ? records[selectedDateId] : undefined

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowButton} activeOpacity={0.7}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{currentMonth.format('YYYY年M月')}</Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.arrowButton} activeOpacity={0.7}>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <CalendarGrid
            month={currentMonth}
            records={records}
            targetHours={config.targetDailyHours}
            weekType={config.currentWeekType}
            today={liveToday}
            onDayPress={handleDayPress}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>年度热力图</Text>
          <Heatmap
            year={currentMonth.year()}
            records={records}
            targetHours={config.targetDailyHours}
          />
        </View>
      </ScrollView>

      <TimePickerModal
        visible={pickerVisible}
        dateId={selectedDateId ?? ''}
        existingRecord={selectedRecord}
        onConfirm={handleTimeConfirm}
        onMarkLeave={handleMarkLeave}
        onClose={handleClose}
      />

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
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 24,
  },
  arrowButton: {
    padding: 8,
  },
  arrowText: {
    fontSize: 28,
    color: COLORS.textPrimary,
    fontWeight: '300',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  section: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
})

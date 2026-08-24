import { useState, useEffect, useMemo, useRef } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native'
import { COLORS } from '../constants'
import { WorkRecord } from '../types'
import dayjs from 'dayjs'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const PICKER_ITEM_HEIGHT = 44
const VISIBLE_ITEMS = 5

const QUICK_TIMES = [
  { label: '18:00', hour: 18, minute: 0 },
  { label: '21:30', hour: 21, minute: 30 },
  { label: '22:30', hour: 22, minute: 30 },
]

interface TimePickerModalProps {
  visible: boolean
  dateId: string
  existingRecord?: WorkRecord
  onConfirm: (clockOutTime: string) => void
  onMarkLeave: () => void
  onClose: () => void
}

export function TimePickerModal({
  visible,
  dateId,
  existingRecord,
  onConfirm,
  onMarkLeave,
  onClose,
}: TimePickerModalProps) {
  const [hour, setHour] = useState(22)
  const [minute, setMinute] = useState(30)
  const [selectedQuickTime, setSelectedQuickTime] = useState<string | null>(null)
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (existingRecord?.clockOutTime) {
      const [h, m] = existingRecord.clockOutTime.split(':').map(Number)
      setHour(h)
      setMinute(m)
      const matchedQuick = QUICK_TIMES.find((t) => t.hour === h && t.minute === m)
      setSelectedQuickTime(matchedQuick?.label ?? null)
    } else {
      setHour(22)
      setMinute(30)
      setSelectedQuickTime(null)
    }
    setErrorMessage(null)
  }, [visible, existingRecord])

  const handleQuickSelect = (time: (typeof QUICK_TIMES)[0]) => {
    setHour(time.hour)
    setMinute(time.minute)
    setSelectedQuickTime(time.label)
    setErrorMessage(null)
  }

  const validateTime = (): string | null => {
    const now = dayjs().startOf('day')
    const selectedDate = dayjs(dateId).startOf('day')

    if (selectedDate.isAfter(now)) {
      return '不能选择未来日期'
    }

    return null
  }

  const handleSave = () => {
    const validationError = validateTime()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    const clockOutTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

    if (existingRecord && !existingRecord.isLeave && existingRecord.clockOutTime) {
      setShowOverwriteConfirm(true)
      return
    }

    onConfirm(clockOutTime)
  }

  const handleConfirmOverwrite = () => {
    const clockOutTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    setShowOverwriteConfirm(false)
    onConfirm(clockOutTime)
  }

  const minuteItems = useMemo(() => {
    const baseMinutes = Array.from({ length: 12 }, (_, i) => i * 5)
    if (!baseMinutes.includes(minute)) {
      return [...baseMinutes, minute].sort((a, b) => a - b)
    }
    return baseMinutes
  }, [minute])

  const formattedDateTitle = useMemo(() => {
    if (!dateId) return ''
    const d = dayjs(dateId)
    const isToday = d.isSame(dayjs(), 'day')
    return `${d.format('YYYY年M月D日 dddd')}${isToday ? ' (今天)' : ''}`
  }, [dateId])

  const WheelPicker = ({
    items,
    selected,
    onSelect,
  }: {
    items: number[]
    selected: number
    onSelect: (value: number) => void
  }) => {
    const scrollRef = useRef<ScrollView>(null)

    useEffect(() => {
      const selectedIndex = items.indexOf(selected)
      if (selectedIndex >= 0 && scrollRef.current) {
        scrollRef.current.scrollTo({
          y: selectedIndex * PICKER_ITEM_HEIGHT,
          animated: true,
        })
      }
    }, [selected, items])

    return (
      <View style={styles.wheelContainer}>
        <View style={styles.wheelHighlight} />
        <ScrollView
          ref={scrollRef}
          style={styles.wheelScroll}
          showsVerticalScrollIndicator={false}
          snapToInterval={PICKER_ITEM_HEIGHT}
          decelerationRate="fast"
          contentContainerStyle={styles.wheelContent}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT)
            if (index >= 0 && index < items.length) {
              onSelect(items[index])
            }
          }}
        >
          {items.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.wheelItem}
              onPress={() => onSelect(item)}
            >
              <Text
                style={[
                  styles.wheelItemText,
                  item === selected && styles.wheelItemTextSelected,
                ]}
              >
                {String(item).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>{formattedDateTitle}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {existingRecord?.isLeave ? (
              <View style={styles.leaveSection}>
                <Text style={styles.leaveIcon}>🏖️</Text>
                <Text style={styles.leaveText}>当日已标记为请假</Text>
                <TouchableOpacity style={styles.cancelLeaveButton} onPress={onMarkLeave}>
                  <Text style={styles.cancelLeaveText}>取消请假</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>快捷选择</Text>
                  <View style={styles.quickButtons}>
                    {QUICK_TIMES.map((time) => (
                      <TouchableOpacity
                        key={time.label}
                        style={[
                          styles.quickButton,
                          selectedQuickTime === time.label && styles.quickButtonActive,
                        ]}
                        onPress={() => handleQuickSelect(time)}
                      >
                        <Text
                          style={[
                            styles.quickButtonText,
                            selectedQuickTime === time.label && styles.quickButtonTextActive,
                          ]}
                        >
                          {time.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>详细选择</Text>
                  <View style={styles.timePickerContainer}>
                    <WheelPicker
                      items={Array.from({ length: 24 }, (_, i) => i)}
                      selected={hour}
                      onSelect={(h) => {
                        setHour(h)
                        setSelectedQuickTime(null)
                        setErrorMessage(null)
                      }}
                    />
                    <Text style={styles.timeSeparator}>:</Text>
                    <WheelPicker
                      items={minuteItems}
                      selected={minute}
                      onSelect={(m) => {
                        setMinute(m)
                        setSelectedQuickTime(null)
                        setErrorMessage(null)
                      }}
                    />
                  </View>
                </View>

                {errorMessage && (
                  <View style={styles.errorSection}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>保存</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.leaveButton} onPress={onMarkLeave}>
                    <Text style={styles.leaveButtonText}>标记请假</Text>
                  </TouchableOpacity>
                </View>

                {existingRecord && !existingRecord.isLeave && (
                  <View style={styles.infoSection}>
                    <Text style={styles.infoText}>
                      当日工时{' '}
                      <Text style={styles.infoValue}>{existingRecord.actualWorkHours}h</Text>
                    </Text>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showOverwriteConfirm} transparent animationType="fade">
        <Pressable
          style={styles.confirmOverlay}
          onPress={() => setShowOverwriteConfirm(false)}
        >
          <Pressable style={styles.confirmContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.confirmTitle}>覆盖已有数据</Text>
            <Text style={styles.confirmMessage}>
              当日已有打卡记录{' '}
              <Text style={styles.confirmHighlight}>{existingRecord?.clockOutTime}</Text>
              {'\n'}确定要覆盖为{' '}
              <Text style={styles.confirmHighlight}>
                {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
              </Text>{' '}
              吗？
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmCancelButton]}
                onPress={() => setShowOverwriteConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmSaveButton]}
                onPress={handleConfirmOverwrite}
              >
                <Text style={styles.confirmSaveText}>确定覆盖</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.separator,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  leaveSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  leaveIcon: {
    fontSize: 36,
  },
  leaveText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  cancelLeaveButton: {
    width: '100%',
    height: 44,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.separator,
    marginTop: 10,
  },
  cancelLeaveText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },

  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 10,
  },

  quickButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickButton: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.separator,
  },
  quickButtonActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  quickButtonTextActive: {
    color: '#FFFFFF',
  },

  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  wheelContainer: {
    width: 80,
    height: PICKER_ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
  },
  wheelHighlight: {
    position: 'absolute',
    top: PICKER_ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: PICKER_ITEM_HEIGHT,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    zIndex: -1,
  },
  wheelScroll: {
    flex: 1,
  },
  wheelContent: {
    paddingVertical: PICKER_ITEM_HEIGHT * 2,
  },
  wheelItem: {
    height: PICKER_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: 20,
    color: COLORS.textSecondary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  wheelItemTextSelected: {
    fontSize: 24,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  timeSeparator: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },

  errorSection: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    textAlign: 'center',
  },

  actions: {
    gap: 10,
  },
  saveButton: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  leaveButton: {
    width: '100%',
    height: 44,
    backgroundColor: 'transparent',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.separator,
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.leave,
  },

  infoSection: {
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.separator,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },

  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmHighlight: {
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'JetBrainsMono-Regular',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelButton: {
    backgroundColor: COLORS.background,
  },
  confirmSaveButton: {
    backgroundColor: COLORS.success,
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  confirmSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})

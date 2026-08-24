import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import { COLORS } from '../constants'
import { WorkRecord, WeekType } from '../types'
import { toDateId } from '../utils/workHours'
import dayjs from 'dayjs'

interface CalendarGridProps {
  month: dayjs.Dayjs
  records: Record<string, WorkRecord>
  targetHours: number
  weekType?: WeekType
  today?: dayjs.Dayjs
  onDayPress: (dateId: string) => void
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function CalendarGrid({
  month,
  records,
  targetHours,
  weekType = 'BIG_WEEK',
  today,
  onDayPress,
}: CalendarGridProps) {
  const currentToday = today ?? dayjs()
  const startOfMonth = month.startOf('month')
  const endOfMonth = month.endOf('month')
  const startDay = startOfMonth.day()
  const daysInMonth = endOfMonth.date()

  const offset = startDay === 0 ? 6 : startDay - 1

  const days: (number | null)[] = []
  for (let i = 0; i < offset; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const isDayWeekend = (dayOfWeek: number) => {
    if (dayOfWeek === 0) return true // 周日固定休息
    if (dayOfWeek === 6) return weekType === 'BIG_WEEK' // 周六大周休息，小周上班
    return false
  }

  return (
    <View style={styles.container}>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day, index) => {
          // index 5 = 周六, index 6 = 周日
          const isWeekendHeader = index === 6 || (index === 5 && weekType === 'BIG_WEEK')
          return (
            <Text
              key={day}
              style={[
                styles.weekdayText,
                isWeekendHeader && styles.weekdayWeekend,
              ]}
            >
              {day}
            </Text>
          )
        })}
      </View>

      <View style={styles.grid}>
        {days.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.dayCell} />
          }

          const date = month.date(day)
          const dateId = toDateId(date)
          const record = records[dateId]
          const isToday = date.isSame(currentToday, 'day')
          const isFuture = date.isAfter(currentToday, 'day')
          const dayOfWeek = date.day()
          const isWeekend = isDayWeekend(dayOfWeek)

          return (
            <TouchableOpacity
              key={dateId}
              style={[styles.dayCell, isToday && styles.todayCell]}
              onPress={() => !isFuture && onDayPress(dateId)}
              disabled={isFuture}
            >
              <Text
                style={[
                  styles.dayText,
                  isToday && styles.todayText,
                  isFuture && styles.futureText,
                  isWeekend && styles.weekendText,
                ]}
              >
                {day}
              </Text>
              {record && !record.isLeave && record.actualWorkHours > 0 && (
                <Text
                  style={[
                    styles.hoursText,
                    { color: record.actualWorkHours >= targetHours ? COLORS.success : COLORS.warning },
                  ]}
                >
                  {record.actualWorkHours}h
                </Text>
              )}
              {record?.isLeave && (
                <Text style={styles.leaveText}>休</Text>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    paddingVertical: 4,
  },
  weekdayWeekend: {
    color: COLORS.leave,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 2,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  todayText: {
    fontWeight: '700',
    color: COLORS.success,
  },
  futureText: {
    color: COLORS.textSecondary,
    opacity: 0.3,
  },
  weekendText: {
    color: COLORS.rest,
  },
  hoursText: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: 'JetBrainsMono-Regular',
  },
  leaveText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.leave,
  },
})

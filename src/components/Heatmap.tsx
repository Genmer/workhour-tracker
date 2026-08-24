import { useRef, useEffect } from 'react'
import { StyleSheet, View, Text, ScrollView } from 'react-native'
import { COLORS, HEATMAP_COLORS } from '../constants'
import { WorkRecord } from '../types'
import { toDateId, getHeatmapLevel, calculateYearlyAttendance } from '../utils/workHours'
import dayjs from 'dayjs'

interface HeatmapProps {
  year: number
  records: Record<string, WorkRecord>
  targetHours: number
}

const CELL_SIZE = 12
const CELL_GAP = 3
const COLUMN_WIDTH = CELL_SIZE + CELL_GAP

export function Heatmap({ year, records, targetHours }: HeatmapProps) {
  const scrollRef = useRef<ScrollView>(null)
  const startDate = dayjs(`${year}-01-01`)
  const endDate = dayjs(`${year}-12-31`)

  const weeks: dayjs.Dayjs[][] = []
  let currentWeek: dayjs.Dayjs[] = []

  let current = startDate
  const startDay = startDate.day()
  if (startDay !== 1) {
    const offset = startDay === 0 ? 6 : startDay - 1
    for (let i = 0; i < offset; i++) {
      currentWeek.push(startDate.subtract(offset - i, 'day'))
    }
  }

  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    currentWeek.push(current)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    current = current.add(1, 'day')
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  // 计算每个月份标签对应的起始周索引
  const monthLabelsWithOffset: { month: string; weekIndex: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, wIdx) => {
    const firstDayInYear = week.find((d) => d.year() === year)
    if (firstDayInYear) {
      const m = firstDayInYear.month()
      if (m !== lastMonth) {
        monthLabelsWithOffset.push({
          month: `${m + 1}月`,
          weekIndex: wIdx,
        })
        lastMonth = m
      }
    }
  })

  // 如果是当前年份，初始自动滚动到当前周附近
  useEffect(() => {
    if (year === dayjs().year() && scrollRef.current) {
      const currentWeekIndex = weeks.findIndex((w) =>
        w.some((d) => d.isSame(dayjs(), 'day'))
      )
      if (currentWeekIndex > 10) {
        scrollRef.current.scrollTo({
          x: Math.max(0, (currentWeekIndex - 5) * COLUMN_WIDTH),
          animated: true,
        })
      }
    }
  }, [year, weeks.length])

  const yearlyAttendance = calculateYearlyAttendance(year, records)
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View>
          <View style={styles.monthLabels}>
            {monthLabelsWithOffset.map(({ month, weekIndex }) => (
              <Text
                key={month}
                style={[
                  styles.monthText,
                  { left: weekIndex * COLUMN_WIDTH },
                ]}
              >
                {month}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.weekColumn}>
                {week.map((day) => {
                  const dateId = toDateId(day)
                  const record = records[dateId]
                  const hours = record?.actualWorkHours ?? 0
                  const level = getHeatmapLevel(hours, targetHours)
                  const isCurrentYear = day.year() === year

                  return (
                    <View
                      key={dateId}
                      style={[
                        styles.cell,
                        {
                          backgroundColor: isCurrentYear
                            ? HEATMAP_COLORS[level]
                            : 'transparent',
                        },
                      ]}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.legend}>
        <Text style={styles.legendText}>少</Text>
        {HEATMAP_COLORS.map((color, i) => (
          <View key={i} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={styles.legendText}>多</Text>
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.statsTitle}>每月出勤</Text>
        <View style={styles.statsGrid}>
          {yearlyAttendance.map((item, i) => (
            <View key={item.month} style={styles.statItem}>
              <Text style={styles.statMonth}>{monthLabels[i]}</Text>
              <Text style={styles.statDays}>{item.workDays}天</Text>
            </View>
          ))}
        </View>
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
  scrollContent: {
    paddingVertical: 4,
  },
  monthLabels: {
    height: 18,
    position: 'relative',
    marginBottom: 4,
  },
  monthText: {
    position: 'absolute',
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  weekColumn: {
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 4,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  statsSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.separator,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    flexBasis: '22.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  statMonth: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  statDays: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
})

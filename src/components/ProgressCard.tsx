import { useEffect, useRef } from 'react'
import { StyleSheet, View, Text, Animated } from 'react-native'
import { COLORS } from '../constants'

interface ProgressCardProps {
  title: string
  currentHours: number
  targetHours: number
  gap: number
  leaveDays: number
  overtimeDaysNeeded?: number
  alreadyOvertimeDays?: number
}

export function ProgressCard({
  title,
  currentHours,
  targetHours,
  gap,
  leaveDays,
  overtimeDaysNeeded,
  alreadyOvertimeDays,
}: ProgressCardProps) {
  const progress = targetHours > 0 ? Math.min(currentHours / targetHours, 1) : 0
  const isCompleted = gap <= 0
  const widthAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress * 100,
      duration: 800,
      useNativeDriver: false,
    }).start()
  }, [progress])

  // 格式化加班天数显示
  const formatOvertimeDays = (days: number, alreadyDone: number) => {
    const fullDays = Math.floor(days)
    const fractional = days - fullDays
    let text = ''

    if (alreadyDone > 0) {
      text += `已加 ${alreadyDone} 天`
    }

    if (days > 0) {
      if (fractional > 0.01) {
        text += text ? '，' : ''
        text += `还需 ${days} 天`
      } else if (fullDays > 0) {
        text += text ? '，' : ''
        text += `还需 ${fullDays} 天`
      }
    }

    return text
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>
          <Text style={styles.valueBold}>{currentHours}</Text>h / <Text style={styles.valueBold}>{targetHours}</Text>h
        </Text>
      </View>

      <View style={styles.progressBarBg}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: isCompleted ? '#34C759' : '#FF9F0A',
            },
          ]}
        />
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <View style={[styles.dot, { backgroundColor: isCompleted ? COLORS.success : COLORS.warning }]} />
          <Text style={styles.statText}>缺口 {gap > 0 ? `+${gap}` : gap}h</Text>
        </View>

        {leaveDays > 0 && (
          <View style={styles.stat}>
            <View style={[styles.dot, { backgroundColor: COLORS.leave }]} />
            <Text style={styles.statText}>请假 {leaveDays}天</Text>
          </View>
        )}

        {overtimeDaysNeeded !== undefined && overtimeDaysNeeded > 0 && (
          <View style={styles.stat}>
            <View style={[styles.dot, { backgroundColor: COLORS.warning }]} />
            <Text style={styles.statText}>
              {formatOvertimeDays(overtimeDaysNeeded, alreadyOvertimeDays ?? 0)}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  value: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  valueBold: {
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: 'JetBrainsMono-Regular',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
})

import { useEffect, useRef } from 'react'
import { StyleSheet, TouchableOpacity, Text, View, Animated } from 'react-native'
import { COLORS } from '../constants'

interface ClockOutButtonProps {
  isClocked: boolean
  onPress: () => void
}

export function ClockOutButton({ isClocked, onPress }: ClockOutButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current
  const opacityAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!isClocked) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.08,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.3,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      )
      pulse.start()
      return () => pulse.stop()
    } else {
      pulseAnim.setValue(1)
      opacityAnim.setValue(1)
    }
  }, [isClocked])

  return (
    <TouchableOpacity
      style={[styles.button, isClocked ? styles.buttonClocked : styles.buttonDefault]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {!isClocked && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
      )}
      <View style={styles.inner}>
        <Text style={styles.mainText}>
          {isClocked ? '已打卡' : '下班打卡'}
        </Text>
        <Text style={styles.subText}>
          {isClocked ? '点击撤销' : '点击记录下班时间'}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  buttonDefault: {
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonClocked: {
    backgroundColor: '#AEAEB2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  pulseRing: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 88,
    borderWidth: 2,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  inner: {
    alignItems: 'center',
    gap: 6,
  },
  mainText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  subText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '400',
  },
})

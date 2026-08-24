import { useState, useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import dayjs from 'dayjs'

/**
 * 提供实时响应式的当前时间
 * 支持定时器更新、应用回到前台（AppState active）、网页切回焦点（focus/visibilitychange）即时刷新
 */
export function useLiveTime(intervalMs: number = 10000): dayjs.Dayjs {
  const [now, setNow] = useState(() => dayjs())

  useEffect(() => {
    // 定时器定时刷新
    const timer = setInterval(() => {
      setNow(dayjs())
    }, intervalMs)

    // React Native AppState 监听
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setNow(dayjs())
      }
    })

    // Web 平台事件监听
    const handleWebFocus = () => {
      setNow(dayjs())
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', handleWebFocus)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            setNow(dayjs())
          }
        })
      }
    }

    return () => {
      clearInterval(timer)
      subscription.remove()
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWebFocus)
      }
    }
  }, [intervalMs])

  return now
}

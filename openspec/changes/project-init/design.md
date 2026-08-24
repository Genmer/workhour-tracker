# 项目初始化设计 (Project Init Design)

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                      App.tsx                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │              SafeAreaProvider                    │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │         Screen Router (useState)        │    │   │
│  │  │  ┌─────────┬─────────┬─────────┐       │    │   │
│  │  │  │Dashboard│Calendar │Settings │       │    │   │
│  │  │  └─────────┴─────────┴─────────┘       │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │              TabBar                     │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 状态管理架构

```
┌─────────────────────────────────────────────────────────┐
│                    Zustand Store                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │                 useAppStore                     │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │              State                      │    │   │
│  │  │  - config: AppConfig                    │    │   │
│  │  │  - records: Record<string, WorkRecord>  │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │              Actions                    │    │   │
│  │  │  - clockOut()                           │    │   │
│  │  │  - undoClockOut()                       │    │   │
│  │  │  - toggleLeave()                        │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
│                        │                               │
│                        ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Persistence Layer                  │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │  Platform-specific Storage Adapter      │    │   │
│  │  │  - Web: localStorage                    │    │   │
│  │  │  - Native: MMKV                         │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 存储适配器设计

```typescript
// 平台检测
function createStorage() {
  if (Platform.OS === 'web') {
    return {
      getItem: (name: string) => localStorage.getItem(name),
      setItem: (name: string, value: string) => localStorage.setItem(name, value),
      removeItem: (name: string) => localStorage.removeItem(name),
    }
  }
  
  // Native使用MMKV
  const { createMMKV } = require('react-native-mmkv')
  const storage = createMMKV()
  return {
    getItem: (name: string) => storage.getString(name) ?? null,
    setItem: (name: string, value: string) => storage.set(name, value),
    removeItem: (name: string) => storage.remove(name),
  }
}
```

## 类型系统设计

```typescript
// 核心类型
type WeekType = 'BIG_WEEK' | 'SMALL_WEEK'

interface AppConfig {
  dailyStartTime: string
  lunchBreakHours: number
  targetDailyHours: number
  overtimeEndTime: string
  monthlyTargetDays: number
  currentWeekType: WeekType
}

interface WorkRecord {
  dateId: string
  clockOutTime: string | null
  actualWorkHours: number
  isLeave: boolean
}
```

## 颜色系统

```typescript
const COLORS = {
  background: '#F5F5F7',  // 浅灰底
  card: '#FFFFFF',        // 白色卡片
  success: '#34C759',     // 达标绿
  warning: '#FF9F0A',     // 警示橙
  textPrimary: '#1C1C1E', // 主文本
  textSecondary: '#8E8E93', // 次文本
  separator: '#E5E5EA',   // 分割线
  leave: '#AEAEB2',       // 请假灰
  rest: '#D1D1D6',        // 休息日灰
}
```

## 关键决策

1. **使用Zustand而非Redux**
   - 理由：项目规模小，Zustand更轻量
   - 权衡：牺牲了一些DevTools支持

2. **使用MMKV而非AsyncStorage**
   - 理由：MMKV性能更好，同步API
   - 权衡：需要原生模块

3. **使用useState而非React Navigation**
   - 理由：页面少，不需要复杂路由
   - 权衡：无法支持深链接

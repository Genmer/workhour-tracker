# 核心功能设计 (Core Features Design)

## 打卡流程

```
┌─────────────────────────────────────────────────────────┐
│                    打卡流程图                           │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
               ┌────────────────┐
               │  用户点击打卡  │
               └───────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  获取当前时间   │
              └───────┬─────────┘
                      │
                      ▼
            ┌───────────────────┐
            │ 计算工时          │
            │ = 下班-上班-午休  │
            └───────┬───────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │ 创建WorkRecord     │
          │ {                   │
          │   dateId,           │
          │   clockOutTime,     │
          │   actualWorkHours,  │
          │   isLeave: false    │
          │ }                   │
          └───────┬─────────────┘
                  │
                  ▼
        ┌───────────────────────┐
        │ 保存到Zustand Store  │
        │ (自动持久化到本地)    │
        └───────────────────────┘
```

## 工时计算算法

```typescript
function calculateDailyHours(
  clockOutTime: string,  // "22:30"
  startTime: string,     // "09:00"
  lunchBreak: number     // 1.0
): number {
  const clockOut = dayjs(clockOutTime, 'HH:mm')
  const start = dayjs(startTime, 'HH:mm')
  
  // 计算总时长（小时）
  const totalHours = clockOut.diff(start, 'hour', true)
  
  // 减去午休
  const workHours = totalHours - lunchBreak
  
  // 保留一位小数
  return Math.round(workHours * 10) / 10
}
```

## 统计计算逻辑

### 本周统计

```typescript
function getWeekRecords(date: dayjs.Dayjs): WorkRecord[] {
  const records = get().records
  const dayOfWeek = date.day()
  // 调整到周一
  const start = date.subtract(dayOfWeek === 0 ? 6 : dayOfWeek - 1, 'day')
  
  const weekRecords: WorkRecord[] = []
  for (let i = 0; i < 7; i++) {
    const d = start.add(i, 'day')
    const id = toDateId(d)
    if (records[id]) {
      weekRecords.push(records[id])
    }
  }
  return weekRecords
}

function calculateWeekStats(records: WorkRecord[]): WorkStats {
  const totalHours = records.reduce((sum, r) => sum + r.actualWorkHours, 0)
  const targetHours = config.currentWeekType === 'BIG_WEEK' 
    ? BIG_WEEK_TARGET_HOURS 
    : SMALL_WEEK_TARGET_HOURS
  const gap = targetHours - totalHours
  const leaveDays = records.filter(r => r.isLeave).length
  
  return {
    totalHours,
    targetHours,
    gap,
    leaveDays,
    overtimeDaysNeeded: gap > 0 ? Math.ceil(gap / config.targetDailyHours) : 0
  }
}
```

### 本月统计

```typescript
function getMonthRecords(month: dayjs.Dayjs): WorkRecord[] {
  const records = get().records
  const start = month.startOf('month')
  const end = month.endOf('month')
  
  const monthRecords: WorkRecord[] = []
  let current = start
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const id = toDateId(current)
    if (records[id]) {
      monthRecords.push(records[id])
    }
    current = current.add(1, 'day')
  }
  return monthRecords
}
```

## 数据导入导出

### 导出格式

```typescript
interface ExportData {
  version: string
  exportDate: string
  config: AppConfig
  records: Record<string, WorkRecord>
}

function exportData(): ExportData {
  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    config: get().config,
    records: get().records
  }
}
```

### 导入逻辑

```typescript
function importData(data: ExportData): void {
  // 验证版本兼容性
  if (data.version !== '1.0') {
    throw new Error('不支持的数据版本')
  }
  
  // 覆盖现有数据
  set({
    config: data.config,
    records: data.records
  })
}
```

## 存储持久化

```typescript
const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ... state and actions
    }),
    {
      name: 'workhour-tracker-storage',
      storage: createJSONStorage(() => storageAdapter),
    }
  )
)
```

## 关键决策

1. **使用日期字符串作为ID**
   - 格式：YYYY-MM-DD
   - 理由：直观，便于查询

2. **工时保留一位小数**
   - 理由：足够精确，显示友好

3. **导入数据完全覆盖**
   - 理由：简化逻辑，用户有明确意图

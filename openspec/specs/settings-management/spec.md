# 设置管理功能 (Settings Management)

## 概述

管理应用配置，包括工时配置和数据导入导出。

## 用户故事

作为用户，我想要配置工时参数和管理数据，以便应用符合个人需求。

## 功能要求

### 工时配置区（只读展示）

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 上班时间 | 09:00 | 固定上班时间 |
| 午休时长 | 1.0 小时 | 午休扣除时长 |
| 每日目标工时 | 10.5 小时 | 每日需达到的工时 |
| 加班基准时间 | 22:30 | 超过此时间算加班 |

### 月度配置区（可编辑）

1. **本月应出勤天数**
   - 输入框 + 保存按钮
   - 范围：1-31
   - 用于计算本月目标工时

2. **当前周类型**
   - 点击切换：大周 ↔ 小周
   - 影响本周目标工时计算

### 数据管理区

1. **导出数据**
   - 按钮：「导出数据」
   - 导出 JSON 文件
   - 包含：配置 + 所有考勤记录

2. **导入数据**
   - 按钮：「导入数据」
   - 从备份文件恢复
   - 覆盖现有数据

### 数据模型

```typescript
interface AppConfig {
  dailyStartTime: string      // 上班时间，如 "09:00"
  lunchBreakHours: number     // 午休扣除小时数
  targetDailyHours: number    // 每日目标工时
  overtimeEndTime: string     // 加班基准下班时间
  monthlyTargetDays: number   // 本月应出勤天数
  currentWeekType: WeekType   // 大周 / 小周
}

type WeekType = 'BIG_WEEK' | 'SMALL_WEEK'
```

### 导出数据格式

```json
{
  "version": "1.0",
  "exportDate": "2024-01-15T10:30:00Z",
  "config": {
    "dailyStartTime": "09:00",
    "lunchBreakHours": 1.0,
    "targetDailyHours": 10.5,
    "overtimeEndTime": "22:30",
    "monthlyTargetDays": 22,
    "currentWeekType": "BIG_WEEK"
  },
  "records": {
    "2024-01-15": {
      "dateId": "2024-01-15",
      "clockOutTime": "22:30",
      "actualWorkHours": 12.5,
      "isLeave": false
    }
  }
}
```

## 验收标准

- [ ] 配置正确显示
- [ ] 应出勤天数可修改
- [ ] 周类型切换正常
- [ ] 数据导出格式正确
- [ ] 数据导入功能正常
- [ ] 导入后数据正确覆盖

## 依赖

- expo-file-system 文件操作
- expo-sharing 分享功能

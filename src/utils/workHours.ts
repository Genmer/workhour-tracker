import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { WorkRecord, WorkStats, WeekType } from '../types'

dayjs.extend(customParseFormat)

/** 标准工时（不含加班） */
const NORMAL_DAILY_HOURS = 8

// ─── 基础工具 ────────────────────────────────────────

/** 解析 "HH:mm" 为当天的分钟数 */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** 分钟数格式化为 "HH:mm" */
function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 计算正常下班时间（分钟数），如 09:00 + 8h + 1h = 18:00 */
function getNormalEndMinutes(startTime: string, lunchBreakHours: number): number {
  return parseTimeToMinutes(startTime) + NORMAL_DAILY_HOURS * 60 + lunchBreakHours * 60
}

// ─── 公开函数 ────────────────────────────────────────

/**
 * 计算单日实际工时
 */
export function calculateDailyHours(
  clockOutTime: string,
  startTime: string,
  lunchBreakHours: number
): number {
  const start = dayjs(startTime, 'HH:mm')
  let end = dayjs(clockOutTime, 'HH:mm')
  // 支持跨零点加班（如 09:00 上班，次日 00:30 下班）
  if (end.isBefore(start)) {
    end = end.add(1, 'day')
  }
  const totalMinutes = end.diff(start, 'minute')
  const workHours = totalMinutes / 60 - lunchBreakHours
  return Math.max(0, Math.round(workHours * 10) / 10)
}

/**
 * 判断当日工时是否达标
 */
export function isDailyTargetMet(actualHours: number, targetHours: number): boolean {
  return actualHours >= targetHours
}

/**
 * 判断今天是否已打卡
 */
function hasTodayRecord(records: WorkRecord[]): boolean {
  const todayId = dayjs().format('YYYY-MM-DD')
  return records.some(r => r.dateId === todayId && !r.isLeave && r.clockOutTime != null)
}

/**
 * 统计已加班天数（下班时间 ≥ 加班基准时间的天数）
 */
function countAlreadyOvertimeDays(workDays: WorkRecord[], overtimeEndTime: string): number {
  return workDays.filter(r => {
    if (!r.clockOutTime) return false
    return parseTimeToMinutes(r.clockOutTime) >= parseTimeToMinutes(overtimeEndTime)
  }).length
}

/**
 * 计算加班建议（公共逻辑）
 *
 * gap = 目标工时 - 已累计工时 - 剩余正常天数 × 8h
 * 每天加班到 overtimeEndTime 的盈余 = 加班工时 - 8h
 * 需加班天数 = gap / 盈余（浮点数）
 * 最后一个不完整天 → 建议下班时间
 */
function computeOvertimeGuidance(
  gap: number,
  remainingDays: number,
  dailyStartTime: string,
  lunchBreakHours: number,
  overtimeEndTime: string,
  workDays: WorkRecord[]
): Pick<WorkStats, 'overtimeDaysNeeded' | 'alreadyOvertimeDays' | 'todayOvertimeEndTime'> {
  const alreadyOvertimeDays = countAlreadyOvertimeDays(workDays, overtimeEndTime)

  if (gap <= 0 || remainingDays <= 0) {
    return { overtimeDaysNeeded: 0, alreadyOvertimeDays, todayOvertimeEndTime: null }
  }

  // 加班到 overtimeEndTime 的全天工时（含午休扣除）
  const fullOvertimeHours = calculateDailyHours(overtimeEndTime, dailyStartTime, lunchBreakHours)
  // 每天加班盈余 = 加班全天工时 - 正常 8h
  const overtimeSurplus = Math.max(0, fullOvertimeHours - NORMAL_DAILY_HOURS)

  if (overtimeSurplus <= 0) {
    return { overtimeDaysNeeded: 0, alreadyOvertimeDays, todayOvertimeEndTime: null }
  }

  // 需加班天数（浮点）
  const overtimeDaysNeeded = Math.round((gap / overtimeSurplus) * 10) / 10

  // 计算最后一个不完整天的建议下班时间
  let todayOvertimeEndTime: string | null = null
  const fractionalDay = overtimeDaysNeeded - Math.floor(overtimeDaysNeeded)
  if (fractionalDay > 0.01) {
    // 不完整天需要加班的时长（小时）
    const fractionalOvertimeHours = fractionalDay * overtimeSurplus
    // 正常下班时间 + 加班时长
    const normalEndMinutes = getNormalEndMinutes(dailyStartTime, lunchBreakHours)
    const endMinutes = normalEndMinutes + Math.ceil(fractionalOvertimeHours * 60)
    todayOvertimeEndTime = formatMinutesToTime(endMinutes)
  }

  return {
    overtimeDaysNeeded,
    alreadyOvertimeDays,
    todayOvertimeEndTime,
  }
}

/**
 * Pipeline A: 本周计算域
 */
export function calculateWeeklyStats(
  records: WorkRecord[],
  config: {
    weekType: WeekType
    dailyStartTime: string
    lunchBreakHours: number
    targetDailyHours: number
    overtimeEndTime: string
  }
): WorkStats {
  const { weekType, dailyStartTime, lunchBreakHours, targetDailyHours, overtimeEndTime } = config

  const today = dayjs().startOf('day')
  const todayId = toDateId(today)
  const recordsMap = new Map<string, WorkRecord>()
  records.forEach(r => recordsMap.set(r.dateId, r))

  // 本周日期范围（周一 ~ 周日）
  const dayOfWeek = today.day()
  const weekStart = today.subtract(dayOfWeek === 0 ? 6 : dayOfWeek - 1, 'day').startOf('day')
  const weekEnd = weekStart.add(6, 'day').endOf('day')

  // 筛选本周记录
  const weekRecords = records.filter(r => {
    const d = dayjs(r.dateId)
    return (d.isAfter(weekStart) || d.isSame(weekStart, 'day')) &&
           (d.isBefore(weekEnd) || d.isSame(weekEnd, 'day'))
  })

  const workDays = weekRecords.filter(r => !r.isLeave && r.actualWorkHours > 0)
  const leaveDays = weekRecords.filter(r => r.isLeave).length
  const totalHours = workDays.reduce((sum, r) => sum + r.actualWorkHours, 0)

  const actualWeekType = config.weekType ?? (config as any).currentWeekType ?? 'BIG_WEEK'

  // 本周计划工作天数：大周 5 天 / 小周 6 天
  const weekPlanDays = actualWeekType === 'BIG_WEEK' ? 5 : 6

  // 判断某天是否为工作日
  const isWorkday = actualWeekType === 'BIG_WEEK'
    ? (d: number) => d !== 0 && d !== 6
    : (d: number) => d !== 0

  // 精准计算本周剩余工作日（不重复扣减历史请假）
  let remainingDays = 0
  let current = weekStart
  while (current.isBefore(weekEnd) || current.isSame(weekEnd, 'day')) {
    if (isWorkday(current.day())) {
      const curId = toDateId(current)
      const curRecord = recordsMap.get(curId)
      const isCurLeave = curRecord?.isLeave ?? false
      const isCurClocked = curRecord?.clockOutTime != null && !isCurLeave

      if (current.isBefore(today, 'day')) {
        // 过去的日子：已过去，不计入剩余
      } else if (current.isSame(today, 'day')) {
        // 今天：如果未打卡且未请假，算作剩余需要出勤的工作日
        if (!isCurClocked && !isCurLeave) {
          remainingDays++
        }
      } else {
        // 未来的日子：若未提前标记请假，算作剩余工作日
        if (!isCurLeave) {
          remainingDays++
        }
      }
    }
    current = current.add(1, 'day')
  }

  // 本周目标 = 工作天数 × 每日目标 - 请假天数 × 每日目标
  const targetHours = Math.max(0, weekPlanDays * targetDailyHours - leaveDays * targetDailyHours)

  // 缺口 = 目标 - 已累计 - 剩余天数 × 正常8h
  const gap = Math.max(0, targetHours - totalHours - remainingDays * NORMAL_DAILY_HOURS)

  // 加班建议
  const overtimeGuidance = computeOvertimeGuidance(
    gap, remainingDays, dailyStartTime, lunchBreakHours, overtimeEndTime, workDays
  )

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    targetHours: Math.round(targetHours * 10) / 10,
    gap: Math.round(gap * 10) / 10,
    leaveDays,
    ...overtimeGuidance,
  }
}

/**
 * Pipeline B: 本月计算域
 */
export function calculateMonthlyStats(
  records: WorkRecord[],
  config: {
    monthlyTargetDays: number
    targetDailyHours: number
    dailyStartTime: string
    lunchBreakHours: number
    overtimeEndTime: string
  }
): WorkStats {
  const { monthlyTargetDays, targetDailyHours, dailyStartTime, lunchBreakHours, overtimeEndTime } = config

  const today = dayjs().startOf('day')
  const recordsMap = new Map<string, WorkRecord>()
  records.forEach(r => recordsMap.set(r.dateId, r))

  // 本月日期范围
  const monthStart = today.startOf('month')
  const monthEnd = today.endOf('month')

  // 筛选本月记录
  const monthRecords = records.filter(r => {
    const d = dayjs(r.dateId)
    return (d.isAfter(monthStart) || d.isSame(monthStart, 'day')) &&
           (d.isBefore(monthEnd) || d.isSame(monthEnd, 'day'))
  })

  const workDays = monthRecords.filter(r => !r.isLeave && r.actualWorkHours > 0)
  const leaveDays = monthRecords.filter(r => r.isLeave).length
  const totalHours = workDays.reduce((sum, r) => sum + r.actualWorkHours, 0)
  const workedDaysCount = workDays.length

  // 计算本月从今天起的剩余可用工作日（排除周末和已请假日）
  let remainingCalendarWorkdays = 0
  let current = today
  while (current.isBefore(monthEnd) || current.isSame(monthEnd, 'day')) {
    if (current.day() !== 0 && current.day() !== 6) {
      const curId = toDateId(current)
      const curRecord = recordsMap.get(curId)
      const isCurLeave = curRecord?.isLeave ?? false
      const isCurClocked = curRecord?.clockOutTime != null && !isCurLeave

      if (current.isSame(today, 'day')) {
        if (!isCurClocked && !isCurLeave) {
          remainingCalendarWorkdays++
        }
      } else {
        if (!isCurLeave) {
          remainingCalendarWorkdays++
        }
      }
    }
    current = current.add(1, 'day')
  }

  // 剩余需要出勤的天数（受月度应出勤目标天数与实际已出勤/请假天数约束）
  const remainingDays = Math.min(
    remainingCalendarWorkdays,
    Math.max(0, monthlyTargetDays - workedDaysCount - leaveDays)
  )

  // 本月目标 = 应出勤天数 × 每日目标 - 请假天数 × 每日目标
  const targetHours = Math.max(0, monthlyTargetDays * targetDailyHours - leaveDays * targetDailyHours)

  // 缺口 = 目标 - 已累计 - 剩余天数 × 正常8h
  const gap = Math.max(0, targetHours - totalHours - remainingDays * NORMAL_DAILY_HOURS)

  // 加班建议
  const overtimeGuidance = computeOvertimeGuidance(
    gap, remainingDays, dailyStartTime, lunchBreakHours, overtimeEndTime, workDays
  )

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    targetHours: Math.round(targetHours * 10) / 10,
    gap: Math.round(gap * 10) / 10,
    leaveDays,
    ...overtimeGuidance,
  }
}

// ─── 其他工具函数 ────────────────────────────────────

/**
 * 获取本周日期范围（周一到周日）
 */
export function getWeekRange(date: dayjs.Dayjs): { start: dayjs.Dayjs; end: dayjs.Dayjs } {
  const dayOfWeek = date.day()
  const start = date.subtract(dayOfWeek === 0 ? 6 : dayOfWeek - 1, 'day')
  const end = start.add(6, 'day')
  return { start, end }
}

/**
 * 生成日期 ID
 */
export function toDateId(date: dayjs.Dayjs): string {
  return date.format('YYYY-MM-DD')
}

/**
 * 获取热力图颜色等级（0-4）
 */
export function getHeatmapLevel(hours: number, targetHours: number): number {
  if (hours <= 0) return 0
  const ratio = hours / targetHours
  if (ratio < 0.5) return 1
  if (ratio < 0.8) return 2
  if (ratio < 1.0) return 3
  return 4
}

/** 月度考勤汇总 */
export interface MonthlyAttendance {
  month: string
  workDays: number
  leaveDays: number
  totalHours: number
}

/**
 * 计算指定年份每月考勤汇总
 */
export function calculateYearlyAttendance(
  year: number,
  records: Record<string, WorkRecord>
): MonthlyAttendance[] {
  const months: MonthlyAttendance[] = []

  for (let m = 1; m <= 12; m++) {
    const month = dayjs(`${year}-${String(m).padStart(2, '0')}-01`)
    const start = month.startOf('month')
    const end = month.endOf('month')

    let workDays = 0
    let leaveDays = 0
    let totalHours = 0

    let current = start
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const dateId = toDateId(current)
      const record = records[dateId]

      if (record) {
        if (record.isLeave) {
          leaveDays++
        } else {
          workDays++
          totalHours += record.actualWorkHours
        }
      }

      current = current.add(1, 'day')
    }

    months.push({
      month: month.format('YYYY-MM'),
      workDays,
      leaveDays,
      totalHours: Math.round(totalHours * 10) / 10,
    })
  }

  return months
}

/** 周类型：大周 / 小周 */
export type WeekType = 'BIG_WEEK' | 'SMALL_WEEK'

/** 应用配置实体 */
export interface AppConfig {
  /** 固定上班时间，默认 "09:00" */
  dailyStartTime: string
  /** 午休扣除小时数，默认 1.0 */
  lunchBreakHours: number
  /** 每日目标工时，默认 10.5 */
  targetDailyHours: number
  /** 加班下班基准时间，默认 "22:30" */
  overtimeEndTime: string
  /** 本月应出勤天数 */
  monthlyTargetDays: number
  /** 当前周类型 */
  currentWeekType: WeekType
}

/** 考勤记录实体 */
export interface WorkRecord {
  /** 日期 ID，格式 YYYY-MM-DD */
  dateId: string
  /** 下班打卡时间，如 "20:30"，null 表示未打卡 */
  clockOutTime: string | null
  /** 当日净工时（小时） */
  actualWorkHours: number
  /** 是否标记为全天请假 */
  isLeave: boolean
}

/** 工时统计结果 */
export interface WorkStats {
  /** 实际工时总和 */
  totalHours: number
  /** 目标工时总和 */
  targetHours: number
  /** 工时缺口（正数表示不足，负数表示溢出） */
  gap: number
  /** 请假天数 */
  leaveDays: number
  /** 还需加班天数（浮点数，如 2.5 表示 2 天半） */
  overtimeDaysNeeded: number
  /** 已加班天数（下班时间达到加班基准时间的天数） */
  alreadyOvertimeDays: number
  /** 今天建议加班到几点（如 "21:00"），null 表示今天不需要加班 */
  todayOvertimeEndTime: string | null
}

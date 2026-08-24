import { AppConfig } from '../types'

/** 默认应用配置 */
export const DEFAULT_CONFIG: AppConfig = {
  dailyStartTime: '09:00',
  lunchBreakHours: 1.0,
  targetDailyHours: 10.5,
  overtimeEndTime: '22:30',
  monthlyTargetDays: 22,
  currentWeekType: 'BIG_WEEK',
}

/** 米家风格颜色 */
export const COLORS = {
  /** 背景色 */
  background: '#F5F5F7',
  /** 卡片色 */
  card: '#FFFFFF',
  /** 达标/安全绿 */
  success: '#34C759',
  /** 缺口警示橙 */
  warning: '#FF9F0A',
  /** 主文本色 */
  textPrimary: '#1C1C1E',
  /** 次文本色 */
  textSecondary: '#8E8E93',
  /** 分割线色 */
  separator: '#E5E5EA',
  /** 请假灰 */
  leave: '#AEAEB2',
  /** 休息日灰 */
  rest: '#D1D1D6',
} as const

/** 热力图颜色梯度（由浅到深） */
export const HEATMAP_COLORS = [
  '#EBEDF0', // 无数据
  '#9BE9A8', // 浅绿
  '#40C463', // 中绿
  '#30A14E', // 深绿
  '#216E39', // 最深绿
] as const

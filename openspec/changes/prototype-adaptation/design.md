# 原型适配设计 (Prototype Adaptation Design)

## 颜色系统实现

```typescript
// src/constants/index.ts
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
```

## 打卡按钮样式适配

```typescript
// src/components/ClockOutButton.tsx
const styles = StyleSheet.create({
  container: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 24,
  },
  default: {
    backgroundColor: COLORS.success,
  },
  clocked: {
    backgroundColor: COLORS.textSecondary,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
})
```

## 请假按钮样式适配

```typescript
// src/components/LeaveToggle.tsx
const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  default: {
    backgroundColor: COLORS.separator,
  },
  active: {
    backgroundColor: COLORS.textSecondary,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
```

## 进度卡片样式适配

```typescript
// src/components/ProgressCard.tsx
const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.separator,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
})
```

## 日历网格样式适配

```typescript
// src/components/CalendarGrid.tsx
const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  todayRing: {
    borderWidth: 2,
    borderColor: COLORS.success,
    borderRadius: 16,
  },
  hoursText: {
    fontSize: 12,
    marginTop: 4,
  },
  hoursGreen: {
    color: COLORS.success,
  },
  hoursOrange: {
    color: COLORS.warning,
  },
  hoursGray: {
    color: COLORS.leave,
  },
  futureText: {
    color: COLORS.rest,
  },
})
```

## 热力图样式适配

```typescript
// src/components/Heatmap.tsx
const HEATMAP_COLORS = [
  '#EBEDF0', // 无数据
  '#9BE9A8', // 浅绿
  '#40C463', // 中绿
  '#30A14E', // 深绿
  '#216E39', // 最深绿
]

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  months: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  cell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
})
```

## 编辑弹窗样式适配

```typescript
// src/components/EditRecordSheet.tsx
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.separator,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.separator,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  leaveButton: {
    backgroundColor: COLORS.separator,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  leaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
})
```

## 底部导航样式适配

```typescript
// src/components/TabBar.tsx
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.separator,
    paddingBottom: 20, // safe area
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
  },
  activeLabel: {
    color: COLORS.success,
    fontWeight: '600',
  },
  inactiveLabel: {
    color: COLORS.textSecondary,
  },
})
```

## 页面背景样式

```typescript
// App.tsx
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
})
```

## 提示卡片样式

```typescript
// DashboardScreen.tsx
const styles = StyleSheet.create({
  warningCard: {
    backgroundColor: COLORS.warning,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
})
```

## 关键适配点

1. **颜色一致性**
   - 所有颜色值从COLORS常量获取
   - 确保与设计稿完全一致

2. **尺寸精确性**
   - 打卡按钮180×180
   - 请假按钮44×44
   - 卡片圆角12px

3. **间距规范**
   - 基准间距8px
   - 卡片内边距16px
   - 组件间距12px

4. **字体规范**
   - 标题24px
   - 正文16px
   - 辅助14px
   - 最小12px

# 日历历史数据补充功能设计 (Calendar History Data Fill Design)

## 组件架构

```
┌─────────────────────────────────────────────────────────┐
│                   CalendarScreen                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              CalendarGrid                        │   │
│  │         (onDatePress: 打开选择器)                │   │
│  └───────────────────────┬─────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │         TimePickerModal (新增)                   │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │         QuickSelectSection              │    │   │
│  │  │    [18:00] [21:30] [22:30]              │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │         DetailedSelectSection           │    │   │
│  │  │         [HourPicker] : [MinutePicker]   │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │         ActionSection                   │    │   │
│  │  │    [保存] [取消] [标记请假]             │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 数据流

```
┌─────────────────────────────────────────────────────────┐
│                    数据流                               │
└─────────────────────────────────────────────────────────┘

用户点击日期
     │
     ▼
┌─────────────────┐
│ CalendarGrid    │
│ onDatePress(    │
│   dateId        │
│ )               │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CalendarScreen  │
│ setSelectedDate │
│ setShowPicker   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ TimePickerModal │
│ visible=true    │
│ dateId=...      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Quick  │ │ Detail │
│ Select │ │ Select │
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         │
         ▼
┌─────────────────┐
│ onConfirm(      │
│   clockOutTime  │
│ )               │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ useAppStore     │
│ setRecordTime(  │
│   dateId,       │
│   clockOutTime  │
│ )               │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 本地存储        │
│ (MMKV/local     │
│  Storage)       │
└─────────────────┘
```

## TimePickerModal 组件设计

### Props 接口

```typescript
interface TimePickerModalProps {
  /** 是否显示弹窗 */
  visible: boolean
  /** 日期ID */
  dateId: string
  /** 已有记录（可选） */
  existingRecord?: WorkRecord
  /** 确认回调 */
  onConfirm: (clockOutTime: string) => void
  /** 请假回调 */
  onMarkLeave: () => void
  /** 关闭回调 */
  onClose: () => void
}
```

### 状态管理

```typescript
const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  dateId,
  existingRecord,
  onConfirm,
  onMarkLeave,
  onClose
}) => {
  // 小时状态 (0-23)
  const [hour, setHour] = useState(22)
  
  // 分钟状态 (0-59, 步长5)
  const [minute, setMinute] = useState(30)
  
  // 是否显示覆盖确认
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
  
  // 快捷选择时间
  const quickTimes = [
    { label: '18:00', hour: 18, minute: 0 },
    { label: '21:30', hour: 21, minute: 30 },
    { label: '22:30', hour: 22, minute: 30 },
  ]
  
  // 处理快捷选择
  const handleQuickSelect = (time: typeof quickTimes[0]) => {
    setHour(time.hour)
    setMinute(time.minute)
  }
  
  // 处理保存
  const handleSave = () => {
    const clockOutTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    
    // 如果已有数据，显示覆盖确认
    if (existingRecord && !existingRecord.isLeave) {
      setShowOverwriteConfirm(true)
      return
    }
    
    onConfirm(clockOutTime)
  }
  
  // 确认覆盖
  const handleConfirmOverwrite = () => {
    const clockOutTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    setShowOverwriteConfirm(false)
    onConfirm(clockOutTime)
  }
}
```

### 样式设计

```typescript
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  quickSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  quickButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickButtonActive: {
    backgroundColor: COLORS.success,
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  quickButtonTextActive: {
    color: '#FFFFFF',
  },
  detailedSection: {
    marginBottom: 24,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickerColumn: {
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  picker: {
    width: 80,
    height: 150,
  },
  pickerItem: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemText: {
    fontSize: 24,
    color: COLORS.textPrimary,
  },
  pickerItemTextSelected: {
    color: COLORS.success,
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 20,
  },
  buttonSection: {
    gap: 12,
  },
  saveButton: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  leaveButton: {
    backgroundColor: COLORS.separator,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  // 覆盖确认弹窗
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 24,
    width: '100%',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  confirmCancelButton: {
    backgroundColor: COLORS.background,
  },
  confirmSaveButton: {
    backgroundColor: COLORS.success,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
```

## 时间选择器实现方案

### 方案A: 自定义滚轮选择器

```typescript
// 使用ScrollView实现滚轮效果
const WheelPicker: React.FC<{
  items: number[]
  selected: number
  onSelect: (value: number) => void
}> = ({ items, selected, onSelect }) => {
  return (
    <ScrollView
      style={styles.picker}
      showsVerticalScrollIndicator={false}
      snapToInterval={50}
      decelerationRate="fast"
    >
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          style={[
            styles.pickerItem,
            item === selected && styles.pickerItemSelected
          ]}
          onPress={() => onSelect(item)}
        >
          <Text style={[
            styles.pickerItemText,
            item === selected && styles.pickerItemTextSelected
          ]}>
            {String(item).padStart(2, '0')}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}
```

### 方案B: 使用 @react-native-community/picker

```typescript
import { Picker } from '@react-native-community/picker'

const TimePicker: React.FC<{
  hour: number
  minute: number
  onHourChange: (hour: number) => void
  onMinuteChange: (minute: number) => void
}> = ({ hour, minute, onHourChange, onMinuteChange }) => {
  return (
    <View style={styles.timePickerContainer}>
      <Picker
        selectedValue={hour}
        onValueChange={onHourChange}
        style={styles.picker}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <Picker.Item key={i} label={String(i).padStart(2, '0')} value={i} />
        ))}
      </Picker>
      
      <Text style={styles.timeSeparator}>:</Text>
      
      <Picker
        selectedValue={minute}
        onValueChange={onMinuteChange}
        style={styles.picker}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <Picker.Item key={i} label={String(i * 5).padStart(2, '0')} value={i * 5} />
        ))}
      </Picker>
    </View>
  )
}
```

### 方案C: 使用 react-native-wheel-scroll-view-picker

```typescript
import ScrollPicker from 'react-native-wheel-scroll-view-picker'

const TimePicker: React.FC<{
  hour: number
  minute: number
  onHourChange: (hour: number) => void
  onMinuteChange: (minute: number) => void
}> = ({ hour, minute, onHourChange, onMinuteChange }) => {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
  
  return (
    <View style={styles.timePickerContainer}>
      <ScrollPicker
        dataSource={hours}
        selectedIndex={hour}
        onValueChange={(value) => onHourChange(parseInt(value))}
        wrapperHeight={150}
        wrapperWidth={80}
        itemHeight={50}
        highlightColor={COLORS.success}
      />
      
      <Text style={styles.timeSeparator}>:</Text>
      
      <ScrollPicker
        dataSource={minutes}
        selectedIndex={minute / 5}
        onValueChange={(value) => onMinuteChange(parseInt(value))}
        wrapperHeight={150}
        wrapperWidth={80}
        itemHeight={50}
        highlightColor={COLORS.success}
      />
    </View>
  )
}
```

## 推荐方案

**推荐使用方案A（自定义滚轮选择器）**，理由：

1. 无需额外依赖
2. 样式完全可控
3. 与米家风格一致
4. 性能表现良好

## 数据验证逻辑

```typescript
const validateTime = (hour: number, minute: number, dateId: string): string | null => {
  const now = dayjs()
  const selectedTime = dayjs(dateId).hour(hour).minute(minute)
  
  // 不能选择未来时间
  if (selectedTime.isAfter(now)) {
    return '不能选择未来时间'
  }
  
  // 不能选择早于上班时间
  if (hour < 9) {
    return '下班时间不能早于上班时间'
  }
  
  return null
}
```

## 与现有组件的集成

### CalendarGrid 组件修改

```typescript
// 修改前
interface CalendarGridProps {
  month: dayjs.Dayjs
  records: Record<string, WorkRecord>
  onDatePress: (dateId: string) => void
}

// 修改后（无需修改，已经支持onDatePress）
```

### CalendarScreen 组件修改

```typescript
const CalendarScreen: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  
  const handleDatePress = (dateId: string) => {
    setSelectedDate(dateId)
    setShowPicker(true)
  }
  
  const handleTimeConfirm = (clockOutTime: string) => {
    if (selectedDate) {
      setRecordTime(selectedDate, clockOutTime)
    }
    setShowPicker(false)
    setSelectedDate(null)
  }
  
  return (
    <View>
      <CalendarGrid
        month={currentMonth}
        records={records}
        onDatePress={handleDatePress}
      />
      
      <TimePickerModal
        visible={showPicker}
        dateId={selectedDate || ''}
        existingRecord={selectedDate ? records[selectedDate] : undefined}
        onConfirm={handleTimeConfirm}
        onMarkLeave={() => {
          if (selectedDate) {
            toggleLeave(selectedDate)
          }
          setShowPicker(false)
          setSelectedDate(null)
        }}
        onClose={() => {
          setShowPicker(false)
          setSelectedDate(null)
        }}
      />
    </View>
  )
}
```

## 关键决策

1. **使用自定义滚轮而非系统Picker**
   - 理由：样式一致性，跨平台兼容性

2. **快捷选择时间预设为18:00、21:30、22:30**
   - 理由：覆盖常见下班时间场景

3. **已有数据时显示覆盖确认**
   - 理由：防止误操作

4. **分钟步长设为5分钟**
   - 理由：平衡精度和易用性

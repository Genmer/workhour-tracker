# 核心功能任务 (Core Features Tasks)

## 任务列表

- [x] 实现工时计算工具
  - 创建 src/utils/workHours.ts
  - 实现 calculateDailyHours 函数
  - 实现 toDateId 日期格式化函数

- [x] 实现打卡功能
  - 在 useAppStore 中实现 clockOut action
  - 实现撤销打卡 undoClockOut
  - 实现请假切换 toggleLeave
  - 实现手动设置时间 setRecordTime

- [x] 实现记录查询
  - 实现 getRecord 查询单日记录
  - 实现 getWeekRecords 查询本周记录
  - 实现 getMonthRecords 查询本月记录

- [x] 实现配置管理
  - 实现 updateConfig 更新配置
  - 实现 setMonthlyTargetDays 设置出勤天数
  - 实现 setCurrentWeekType 切换周类型

- [x] 实现数据导入导出
  - 使用 expo-file-system 读写文件
  - 使用 expo-sharing 分享文件
  - 实现 JSON 序列化和反序列化

- [x] 实现月度初始化
  - 实现 markMonthInitialized
  - 实现 resetMonthInitialization
  - 跟踪初始化状态

## 验收标准

- [x] 打卡时间记录正确
- [x] 工时计算准确
- [x] 本周/本月统计正确
- [x] 数据导出格式正确
- [x] 数据导入功能正常
- [x] 配置修改生效

## 依赖

- project-init 完成
- dayjs 日期处理
- expo-file-system 文件操作

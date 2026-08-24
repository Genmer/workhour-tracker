# 项目初始化任务 (Project Init Tasks)

## 任务列表

- [x] 创建Expo项目
  - 使用 `npx create-expo-app` 初始化
  - 配置TypeScript支持
  
- [x] 配置项目依赖
  - 安装 zustand、dayjs、react-native-mmkv
  - 安装 expo-file-system、expo-sharing
  - 安装 react-native-safe-area-context

- [x] 搭建目录结构
  - 创建 src/components/
  - 创建 src/screens/
  - 创建 src/stores/
  - 创建 src/types/
  - 创建 src/constants/
  - 创建 src/utils/

- [x] 定义核心类型
  - 创建 src/types/index.ts
  - 定义 AppConfig、WorkRecord、WorkStats 类型
  - 定义 WeekType 枚举

- [x] 实现常量配置
  - 创建 src/constants/index.ts
  - 定义 DEFAULT_CONFIG
  - 定义 COLORS 颜色系统
  - 定义 HEATMAP_COLORS 热力图颜色

- [x] 实现存储适配器
  - 创建 src/stores/useAppStore.ts
  - 实现平台检测逻辑
  - 配置 Zustand persist 中间件

- [x] 实现基础导航
  - 创建 src/components/TabBar.tsx
  - 在 App.tsx 实现页面切换
  - 创建三个空白页面组件

## 验收标准

- [x] 项目能正常启动
- [x] TypeScript编译无错误
- [x] 三个Tab能正常切换
- [x] 状态管理能正常工作
- [x] 数据能持久化到本地存储

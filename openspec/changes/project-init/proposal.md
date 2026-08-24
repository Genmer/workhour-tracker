# 项目初始化 (Project Init)

## 概述

搭建WorkHourTracker项目的基础架构，包括技术选型、项目结构和核心配置。

## 目标

- 创建Expo + React Native项目
- 配置TypeScript
- 搭建基础目录结构
- 配置状态管理和本地存储
- 实现基础导航框架

## 非目标

- 实现具体业务功能
- 完善UI设计
- 添加测试用例

## 用户价值

为后续功能开发提供稳定的技术基础，确保项目架构清晰、可扩展。

## 技术选型

| 类别 | 选择 | 理由 |
|------|------|------|
| 框架 | Expo SDK 54 | 跨平台支持，开发效率高 |
| 语言 | TypeScript | 类型安全，代码质量高 |
| 状态管理 | Zustand | 轻量级，API简洁 |
| 本地存储 | MMKV | 高性能，原生支持 |
| 日期处理 | dayjs | 轻量级，API友好 |

## 目录结构

```
src/
├── components/     # 可复用UI组件
├── screens/        # 页面组件
├── stores/         # Zustand状态管理
├── types/          # TypeScript类型定义
├── constants/      # 常量配置
└── utils/          # 工具函数
```

## 风险与依赖

- **风险**: Expo版本兼容性问题
- **依赖**: Node.js 18+、npm/yarn

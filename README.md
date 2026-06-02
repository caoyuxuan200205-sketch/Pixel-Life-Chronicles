# 👾 Pixel Life Chronicles | 像素生活志

**Pixel Life Chronicles** 是一个基于 React + Vite 的城市探索 AIGC 原型项目，结合“塔罗 / 八字占卜”、高德地图导航与像素拼豆图纸生成，打造复古像素风的行走体验。

## 项目简介

该仓库采用 Monorepo 形式，包含：
- `client/`：React + Vite 前端应用
- `server/`：Node.js + Express 后端服务
- `api/index.ts`：Vercel Serverless 入口，导出 `server/src/index.ts` 的 Express app

前端侧重于用户体验、AI 占卜流程、地图探索与相机印章；后端侧重于图像处理、拼豆图纸渲染与 Supabase/SaaS 数据访问。

---

## 目录结构

```text
FreeWeek/
├── api/
│   └── index.ts
├── client/
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── lib/
│   │   └── store.ts
│   ├── package.json
│   └── tsconfig.json
├── docs/
├── server/
│   ├── data/
│   ├── src/
│   │   ├── baziHelper.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── package.json
└── vercel.json
```

---

## 核心功能

- AI 占卜：支持塔罗牌与八字命理结合情绪标签生成命运判词
- 城市探索：展示 POI 推荐、情绪驱动的探索体验和可解锁地图功能
- 像素视觉：复古 8-bit 风格 UI 与动画效果
- 相机印章：记录地点、生成像素化图像与拼豆图纸数据
- 后端图像处理：加载 Artkal 拼豆色板、渲染拼豆网格、生成图像
- Vercel 集成：Serverless API 与静态前端路由共存

---

## 技术栈

### 前端
- React 19 + Vite
- TypeScript
- React Router Dom
- Framer Motion
- AMap JS API
- Supabase 客户端

### 后端
- Node.js + Express
- TypeScript
- Supabase SDK
- axios
- sharp
- pdf-lib

---

## 快速启动

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

该命令会并行启动：
- 前端开发服务器（`client`）
- 后端开发服务器（`server`）

---

## 子项目脚本

### 根目录
- `npm run dev`：并行启动前端与后端
- `npm run client`：启动 `client` 开发服务器
- `npm run server`：启动 `server` 开发服务器

### 客户端
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

### 服务端
- `npm run dev`
- `npm run build`
- `npm run start`

---

## 环境变量

### 前端 (`client/.env`)
- `VITE_AMAP_KEY`
- `VITE_AMAP_SECURITY_JS_CODE`
- `VITE_BACKEND_URL`
- `VITE_DOUBAO_API_KEY`
- `VITE_DOUBAO_MODEL_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 后端 (`server/.env` 或 Vercel 环境变量)
- `SUPABASE_URL` 或 `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` 或 `VITE_SUPABASE_ANON_KEY`

> `client/src/services/ai.ts` 会优先使用后端地址；如果未配置后端，支持直接在客户端保存豆包 API Key 与模型 ID。

---

## 主要页面

- `/`：AI Portal
- `/explore`：探索页
- `/plan`：命运结果页
- `/map`：地图冒险页
- `/camera`：相机印章页
- `/collection`：收藏页
- `/profile`：个人页
- `/auth`：身份登录页

---

## Vercel 部署说明

`vercel.json` 已配置：
- `/api/(.*)` 重写为 `api/index.ts`
- 非 API 请求重写为 `index.html`

`api/index.ts` 导出 `server/src/index.ts` 的 Express app，适配 Vercel Serverless 部署。

---

## 推荐开发入口

- `client/src/services/ai.ts`：AI 占卜与豆包 prompt 逻辑
- `client/src/store.ts`：应用数据类型与本地存储
- `server/src/index.ts`：后端图像处理与拼豆渲染
- `server/data/artkal_m_series.json`：Artkal 拼豆色板数据
- `client/src/pages/`：前端页面与路由

---

## 迭代建议

1. 完善 `server` 的 AI / 图像生成与后端 API
2. 完善 `/map`、`/camera` 和 `/plan` 页面交互
3. 增强 Supabase 数据持久化与用户系统
4. 完善 Vercel 部署与环境变量管理

---

## 版权

© 2026 Pixel Life Chronicles


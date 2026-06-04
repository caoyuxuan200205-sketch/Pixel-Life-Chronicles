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

- **AI 命运之轨规划 (Chrono-Destiny Plan)**：结合“八字干支五行”与“西方塔罗神谕”，整合用户的当前情绪状态（如疲惫、无聊），推演出今日特定时空下的联合命运出游契约。
- **🔮 沉浸式塔罗抽选仪式 (Interactive Tarot Draw)**：
  - **78张全量牌库**：同步引入全量 78 张大/小阿卡纳卡牌数据库。
  - **多档选牌规则**：支持单牌占卜（1张）与时间之流三牌阵（过去/现在/未来，3张不重复卡牌）。
  - **左右自选滑动牌堆**：首创横向自由滚动的 78 张神秘背面卡牌牌堆，支持用户自己挑牌置入卡槽，告别死板的随机数。
  - **硬性契约前置拦截**：在开启召唤前强校验所有结界成员是否完成规定数量的抽牌或八字填写，前置拦截防空包运行。
  - **多卡牌 3D 独立翻转**：规划结果页提供极其精致的 3D 卡牌偏转悬停及翻转动画。
- **📝 结界伙伴契约修改 (Partner Covenant Management)**：
  - 在“我的”个人档案页面，针对“结界契约伙伴”增加了快捷“修改 (📝)”入口，支持对旅伴称呼、关系标签和玄学八字时空/塔罗参数进行实时回显修改，实现本地数据的闭环流转。
- **🎫 真实出行车票/机票查询**：**星耀AI** 直连 **美团酒旅服务**。支持输入出行指令，后端自动提取意图，流式返回真实班次（带直达美团一键购票/抢票链接），生成复古像素风的“时空列车/飞行契约”实体卡。
- **🛍️ 美团即时导购与隐藏福袋 (Meituan Direct Guide)**：
  - 智能解析大模型返回的 Markdown 超链接，展示专属金色导购链接。
  - **唤醒美团 App**：移动端点击超链接直接通过原生协议 `imeituan://` 呼叫并唤醒手机端美团 App，实现无缝导购闭环。
- **📸 城市印章与拼豆创作**：通过 AR 探索与相机记录，将景点一键转化为 8-bit 像素图纸，并支持 Artkal 拼豆色卡统计及 PDF/PNG 图纸生成，联动美团闪购周边耗材包。

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
- `MEITUAN_TRAVEL_TOKEN`（美团酒旅 CLI 抢票直连 Token，用于直连真实供给查询车票/机票）

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


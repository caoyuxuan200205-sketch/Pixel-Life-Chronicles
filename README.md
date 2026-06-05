# 👾 Pixel Life Chronicles | 像素生活志

**Pixel Life Chronicles** 是一个基于 React 19 + Vite + Express + Node.js 的城市探索与 AIGC 决策引擎原型项目。它创造性地将“玄学八字 / 塔罗神谕”与现代城市出行规划完美结合，并深度融入美团即时酒旅、导购生态与像素拼豆创作，为用户提供复古像素风（8-bit）的沉浸式行走与决策体验。

---

## 🚀 最新特性亮点

本项目在原有基础上进行了重大架构重构与交互升级，核心亮点包括：

1. **🤖 LangGraph.js 多智能体架构 (Multi-Agent System)**
   - **StateGraph 决策工作流**：基于 LangGraph.js 重构了后端的 AI 决策链路，采用 StateGraph 编排多智能体协同网络。
   - **Router 智能路由节点**：整合高性能正则表达式与大语言模型（LLM）的双重校验，实时解析用户意图。
   - **专项专家节点协同**：
     - `Coupon Agent`：智能分发美团大额隐藏优惠券与专享红包福利。
     - `Ticket Agent`：实时提取出行起止地，直连美团酒旅数据源查询真实机票/车票。
     - `Weekend Agent`：针对家庭带娃（如 5 岁孩子、老婆减肥）或朋友聚会（如 2男2女）等特定群体画像，智能定制 4-6 小时包含“吃、喝、玩、乐”的综合出行方案。
     - `Venue Agent`：精准搜寻匹配的餐饮、娱乐、外卖等商户信息与排队状态。
     - `Chat Agent`：处理日常闲聊与玄学运势占卜的兜底回复。

2. **⚡ SSE 实时流式响应与推演步骤展示 (SSE & Compass Deduction UI)**
   - 后端基于 Server-Sent Events (SSE) 协议提供极速的流式文本吐字响应。
   - **AI 推演过程 (Reasoning Steps)**：在前端消息气泡上方直观渲染 agent 的推理思考过程（如 *“正在提取行程意图...”* -> *“正在调用美团酒旅 CLI...”*），并结合尺寸经过优化的 **罗盘旋转动画**。推演卡片宽度与聊天气泡/契约卡片 **100% 宽度对齐**，且去除了冗余的头像展示，使得整体对话流干净、专业。

3. **🔮 沉浸式滑动选牌塔罗仪式 (Tarot Draw & 3D Spread)**
   - **78张全量牌库**：完整接入大/小阿卡纳全套塔罗牌。
   - **左右滑动自选牌堆**：首创横向自由滚动的神秘背面卡牌牌堆，支持用户手动滑动并挑选心仪卡牌置入卡槽，极大提升仪式感。
   - **硬性契约拦截**：在开启召唤前强校验所有结界成员是否完成规定数量的抽牌或八字填写，前置拦截防空包运行。
   - **3D 悬浮翻转**：在命运规划页提供精致的 3D 卡牌偏转悬停及 180° 翻转动画。

4. **📝 结界伙伴契约修改 (Partner Covenant Management)**
   - 在“我的”个人档案页面，为“结界契约伙伴”增加了快捷“修改 (📝)”入口，支持对旅伴称呼、关系标签和玄学八字时空/塔罗参数进行实时回显与保存，实现本地及云端数据的闭环修改。

5. **🎫 美团酒旅 CLI 直连与车票契约卡 (Real Travel Booking)**
   - **星耀AI** 直连 **美团酒旅服务**。通过大模型提取出行意图，后端运行美团酒旅 CLI 工具（配置 `MEITUAN_TRAVEL_TOKEN`），拉取真实班次并生成复古像素风的“时空列车/飞行契约”实体卡。
   - 修复了车票卡片中日期和标签文本可能与分割线重合的遮挡缺陷，改用标准垂直 Flex 布局，保证在各种分辨率下清晰可读。

6. **🛍️ 唤醒美团 App 原生协议 (App Deep Linking)**
   - 前端智能解析大模型返回的 Markdown 超链接。
   - 在移动端点击专属金色导购超链接时，直接通过原生协议 `imeituan://` 呼叫并唤醒手机端美团 App，实现从 AI 规划到美团生态直接下单的 O2O 闭环。

---

## 📂 目录结构

```text
FreeWeek/
├── api/
│   └── index.ts          # Vercel Serverless 入口，导出 server Express app
├── client/
│   ├── public/
│   ├── src/
│   │   ├── pages/        # 前端页面（AIPortalPage, HomePage, MapPage 等）
│   │   ├── services/     # API 服务 (SSE/AI等客户端请求)
│   │   ├── lib/          # 工具库 (fetchSSE, Map API 等)
│   │   └── store.ts      # Zustand 状态管理 (包含旅伴、塔罗等)
│   ├── package.json
│   └── tsconfig.json
├── docs/                 # 产品需求与架构设计文档
├── server/
│   ├── data/             # 静态拼豆色卡及业务数据
│   ├── src/
│   │   ├── agents/       # LangGraph 智能体网络 (nodes, tools, state, prompts)
│   │   ├── baziHelper.ts # 八字干支计算逻辑
│   │   └── index.ts      # Express 核心 API、SSE 路由与拼豆图像渲染
│   ├── package.json
│   └── tsconfig.json
├── package.json          # Monorepo 根配置
└── vercel.json           # Vercel 部署路由重写规则
```

---

## 🛠️ 技术栈

### 前端 (Client)
- **React 19 + Vite 6**
- **TypeScript**
- **Zustand** (状态管理与本地持久化)
- **React Router Dom** (路由编排)
- **Framer Motion** (像素风与 3D 动效渲染)
- **AMap JS API v2.0** (高德地图探索与定位)
- **Supabase Client** (数据同步与第三方登录)

### 后端 (Server & Serverless)
- **Node.js + Express**
- **TypeScript**
- **@langchain/langgraph** & **@langchain/core** (智能体流式编排)
- **Server-Sent Events (SSE)** (大模型流式传输)
- **Sharp** (拼豆图纸高像素网格化处理)
- **PDF-Lib** (拼豆制作图纸 PDF 导出)
- **Supabase SDK** (后端数据持久化)

---

## ⚡ 快速启动

### 1. 安装依赖
在项目根目录下，执行以下命令安装所有 workspace 的依赖项：
```bash
npm install
```

### 2. 配置环境变量

#### 前端配置 (`client/.env`)
新建并配置如下变量：
```env
VITE_AMAP_KEY=你的高德地图Key
VITE_AMAP_SECURITY_JS_CODE=你的高德地图安全码
VITE_BACKEND_URL=http://localhost:3000
VITE_DOUBAO_API_KEY=你的豆包APIKey
VITE_DOUBAO_MODEL_ID=你的豆包模型ID
VITE_SUPABASE_URL=你的SupabaseUrl
VITE_SUPABASE_ANON_KEY=你的SupabaseAnonKey
```

#### 后端配置 (`server/.env` 或 Vercel 环境变量)
新建并配置如下变量：
```env
VITE_SUPABASE_URL=你的SupabaseUrl
VITE_SUPABASE_ANON_KEY=你的SupabaseAnonKey
MEITUAN_TRAVEL_TOKEN=你的美团酒旅CLI_Token
# 如果后端需要直接请求大模型，也可以在这里配 Doubao 或 OpenAI 的 Key
```

### 3. 启动本地开发
在根目录下运行以下命令，将同时启动前端 `client`（运行在 5173 端口）与后端 `server`（运行在 3000 端口）：
```bash
npm run dev
```

---

## 💻 命令行脚本

### 根目录
- `npm run dev`：利用 `concurrently` 同时启动前端与后端
- `npm run client`：单独启动前端开发环境
- `npm run server`：单独启动后端开发环境

### 前端子项目 (`client/`)
- `npm run dev`：启动前端 Vite 开发服务器
- `npm run build`：打包前端应用
- `npm run preview`：预览打包后的静态页面
- `npm run lint`：运行 ESLint 校验

### 后端子项目 (`server/`)
- `npm run dev`：使用 tsx/nodemon 启动后端热重载
- `npm run build`：编译 TypeScript 为 JS
- `npm run start`：启动编译后的 Express 服务

---

## 🗺️ 主要路由说明

- `/`：系统探索主界面 (`HomePage.tsx`)
- `/ai`：星耀 AI 对话中心，包含 LangGraph 推演与实时行程定制 (`AIPortalPage.tsx`)
- `/plan`：命定出游结果页，展示 3D 翻转卡牌与行程契约 (`PlanPage.tsx`)
- `/map`：像素风高德地图冒险页，支持 AR 景点寻找 (`MapPage.tsx`)
- `/camera`：相机印章页，生成 AR 贴纸像素相片 (`CameraPage.tsx`)
- `/collection`：我的收藏与拼豆图纸导出 (`CollectionPage.tsx`)
- `/profile`：个人中心，支持配置并修改结界契约旅伴信息 (`ProfilePage.tsx`)
- `/auth`：玄学结界身份登录 (`AuthPage.tsx`)

---

## ☁️ Vercel 部署说明

项目已通过 `vercel.json` 完美适配 Vercel Serverless 架构：
- 根目录 `api/index.ts`（导出 `server/src/index.ts` 的 Express 实例）承接所有 `/api/*` 请求。
- 非 `/api` 请求将自动重写回前端根目录，由前端 `react-router` 承接单页路由。
- 部署时，请在 Vercel 控制台将前端和后端的环境变量统一配入 **Environment Variables** 中。

---

© 2026 Pixel Life Chronicles

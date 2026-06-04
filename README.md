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

- **🕸️ LangGraph.js 多节点状态图智能代理 (StateGraph Agent Architecture)**：
  - 后端 `/api/agent/chat` 接口采用 `Express.js` + `@langchain/langgraph` 重构，支持基于状态机（StateGraph）的多阶段工作流推理。
  - **动态意图分流 (Router Node)**：由大模型担当智能路由器，根据用户最新消息对意图进行分类归入 `coupon` (领券), `ticket` (车票), `weekend` (周末规划), `venue` (导购), `chat` (日常闲聊) 等不同执行路径。
  - **周末群像合盘时间线 (Weekend Node)**：当识别到周末出游或群像出游意向时，智能合盘当前结界内所有旅伴的八字五行和塔罗状态，量身定做 4-6 小时的综合游玩餐饮时间线，并直连真实商户预测排队桌数和特色轻食减脂/亲子服务。
  - **美团特惠生活导购 (Venue Node)**：绑定本地化的 `meituan-venue-guide` 技能，通过解析 Markdown 链接并以 `imeituan://` 原生协议呼起手机美团 App 并直达专属优惠会场，实现无缝导购闭环。
  - **商旅车票/机票直连 (Ticket Node & Tool)**：当查询出行票务时，触发 Tool 并拉取美团真实供给数据，流式输出带抢票直达链接的复古时空车票/机票卡。
  - **静态意图直接响应 (Coupon Node)**：拦截并直达隐藏福利礼包券卡，支持非流式静态回复。
  - **SSE 保底流式与单次运行优化**：在 streamEvents 事件流中自动通过 `on_chain_end` 捕获最终状态，避免 Graph 的双重调用（减少 50% 额外 LLM 延迟及 Token 消费）；针对非流式静态节点，实现 chunk 补偿写入，杜绝前端气泡白屏问题。
- **🔮 沉浸式塔罗抽选仪式 (Interactive Tarot Draw)**：
  - **78张全量牌库**：同步引入全量 78 张大/小阿卡纳卡牌数据库。
  - **多档选牌规则**：支持单牌占卜（1张）与时间之流三牌阵（过去/现在/未来，3张不重复卡牌）。
  - **左右自选滑动牌堆**：首创横向自由滚动的 78 张神秘背面卡牌牌堆，支持用户自己挑牌置入卡槽，告别死板的随机数。
  - **硬性契约前置拦截**：在开启召唤前强校验所有结界成员是否完成规定数量的抽牌或八字填写，前置拦截防空包运行。
  - **多卡牌 3D 独立翻转**：规划结果页提供极其精致的 3D 卡牌偏转悬停及翻转动画。
- **📝 结界伙伴契约修改 (Partner Covenant Management)**：
  - 在“我的”个人档案页面，针对“结界契约伙伴”增加了快捷“修改 (📝)”入口，支持对旅伴称呼、关系标签和玄学八字时空/塔罗参数进行实时回显修改，实现本地数据的闭环流转。
- **🎨 视觉系统与精致排版升级**：
  - **合理步骤推演层级**：将探路祭司的“推演过程”步骤面板（`LoadingStepsPanel`）重构至对话文本/契约卡片上方展示，符合先推导推理、后作答的认知逻辑。
  - **绝对垂直对齐**：对话泡、卡片、推演面板宽度统一限制为 `320px`。移除推演面板的独立祭司头像，并通过 `marginLeft: '46px'` 保证了三者在竖直方向上完美对齐于同一条垂线上，极其精巧美观。
  - **星罗盘交互视觉放大**：下移页面布局中心，放大星盘尺寸（外环直径增至 `190px`，磁针长度增至 `105px`，五行中心文字字号增至 `1.2rem`），增强玄学仪式感。
  - **Markdown 粗体高亮**：解析气泡内 Markdown 格式的 `**粗体文本**` 渲染为金色主题发光字体（`#FFE169`），烘托神秘魔幻像素风格。

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
- LangGraph.js (`@langchain/langgraph` & `@langchain/core`)
- LangChain OpenAI Adapter (`@langchain/openai`)
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
- `QWEN_API_KEY`（首选通义千问 API Key，如果配置则自动使用 Qwen 模型进行图推理路由）
- `QWEN_MODEL`（通义千问模型 ID，例如 `Qwen/Qwen3.5-35B-A3B`）
- `QWEN_BASE_URL`（通义千问 API Base URL）
- `DOUBAO_API_KEY` / `VITE_DOUBAO_API_KEY`（保底豆包大模型 API Key）
- `DOUBAO_MODEL_ID` / `VITE_DOUBAO_MODEL_ID`（保底豆包模型 Endpoint ID）
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


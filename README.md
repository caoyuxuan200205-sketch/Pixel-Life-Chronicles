# 👾 Pixel Life Chronicles | 像素生活志

> **“在城市的折叠处，凝结你的命运印章。”**

![Version](https://img.shields.io/badge/version-1.0.0--beta-blue)
![Tech](https://img.shields.io/badge/Tech-React%20%7C%20Node.js%20%7C%20AIGC-orange)
![Style](https://img.shields.io/badge/Style-8--bit%20Retro%20Pixel-red)

**Pixel Life Chronicles (像素生活志)** 是一款专为城市探索者设计的“玄学 + AIGC”驱动的像素风冒险应用。它将真实世界的商户发现与 8-bit RPG 体验完美结合，让每一次日常出行都变成一场充满仪式感的探险。

---

## 🌟 核心特性

### 🔮 1. 命运导向的城市探索
*   **AI 像素占卜**：集成**豆包 (Ark) 大模型**。根据用户实时情绪（如：电量告急、灵感枯竭）抽取塔罗牌，并结合城市真实商户（POI）生成独特的占卜判词。
*   **动态契约**：只有完成“今日占卜”并开启命运契约后，探险（地图）与创作（相机）功能才会解锁。

### 🗺️ 2. 应用内像素导航
*   **高德地图深度集成**：内置高德地图 JS API v2.0，实现精准的步行路径规划。
*   **8-bit 视觉定制**：通过自定义 Canvas 渲染，将地图路线转化为粗体、高对比度的像素风格路径，并在地图上显示个性化的像素英雄定位点。

### 📸 3. AIGC 实景印章与拼豆图纸
*   **实景转像素**：到达目的地后，调用相机拍摄实景，AI 算法即时将其重绘为 64x64/32x32 规格的像素插画。
*   **拼豆 (Perler Beads) 图纸生成**：自动提取像素插画的色块网格，生成标准拼豆操作图纸，支持线下手工复现。

### 🛒 4. 美团商业化闭环
*   **实体化入口**：在生成图纸页面无缝对接美团生态：
    *   **美团闪购**：一键下单拼豆材料包，30分钟送达。
    *   **线下引流**：搜索并预订周边的拼豆店/手作工坊。

---

## 🛠️ 技术栈

### 前端 (Client)
- **框架**: React 18 + Vite
- **语言**: TypeScript
- **动画**: Framer Motion (实现丝滑的 8-bit 界面切换)
- **图标**: Lucide-React
- **地图**: AMap JS API v2.0

### 后端 (Server)
- **框架**: Node.js + Express
- **语言**: TypeScript (tsx 驱动)
- **特性**: Monorepo 架构，预留 AI 请求代理与数据持久化接口

---

## 📂 项目结构

```text
/Pixel-Life-Chronicles
  ├── client/              # 前端 React 应用
  │    ├── src/
  │    │    ├── pages/     # 包含首页、地图、相机、个人中心等
  │    │    ├── services/  # AI 与外部 API 逻辑
  │    │    └── store.ts   # 状态管理与本地存储
  │    └── package.json
  ├── server/              # 后端 Express 服务 (全栈重构中)
  │    ├── src/
  │    │    └── index.ts   # 后端入口
  │    └── package.json
  └── package.json         # 根目录 Monorepo 配置
```

---

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/caoyuxuan200205-sketch/Pixel-Life-Chronicles.git
```

### 2. 安装依赖
在根目录下执行：
```bash
npm install
```

### 3. 启动开发环境
```bash
npm run dev
```
此命令将同时启动前端 (`localhost:5173`) 和后端 (`localhost:3001`)。

---

## 📝 开发者备注 (Security)

本项目目前处于测试阶段：
- **API Keys**: 部分 Key 目前硬编码在前端代码中。在生产环境下，请务必迁移至 `server/.env` 文件。
- **数据存储**: 当前数据暂存在 `LocalStorage` 中。

---

## 🎨 设计美学
*   **配色**: 采用美团黄 (#e2b553) 作为主色，配合深色背景与高对比度边框。
*   **字体**: 使用像素风格字体（如需正式部署请确保字体授权）。

---

© 2026 Pixel Life Chronicles Team. Built for Hackathon.

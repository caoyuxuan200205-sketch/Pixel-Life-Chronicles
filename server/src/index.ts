import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 基础路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pixel Life Chronicles Backend is running' });
});

// AI 代理占位 (后续将 services/ai.ts 的逻辑迁移到这里)
app.post('/api/ai/reading', async (req, res) => {
  // TODO: 实现豆包 API 的后端调用，保护 API Key
  res.status(501).json({ error: 'AI Proxy not yet implemented' });
});

app.listen(PORT, () => {
  console.log(`
  👾 Pixel Life Chronicles Backend
  🚀 Server running on http://localhost:${PORT}
  `);
});

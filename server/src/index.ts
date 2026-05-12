import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 加载 Artkal 标准色板
interface ArtkalBead {
  code: string;
  name_zh: string;
  hex: string;
  rgb: [number, number, number];
}

let ARTKAL_DATA: ArtkalBead[] = [];
try {
  // 适配 Vercel 环境和本地环境的路径
  const dataPath = path.join(process.cwd(), 'server', 'data', 'artkal_m_series.json');
  const fallbackPath = path.join(process.cwd(), 'data', 'artkal_m_series.json');
  const finalPath = fs.existsSync(dataPath) ? dataPath : fallbackPath;
  
  if (fs.existsSync(finalPath)) {
    ARTKAL_DATA = JSON.parse(fs.readFileSync(finalPath, 'utf-8'));
    console.log(`Successfully loaded ${ARTKAL_DATA.length} Artkal colors.`);
  }
} catch (e) {
  console.error('Failed to load Artkal palette:', e);
}

const FULL_BEAD_PALETTE = ARTKAL_DATA.map(b => b.hex.toUpperCase());
const FULL_BEAD_NAMES = ARTKAL_DATA.map(b => b.name_zh);
const FULL_BEAD_CODES = ARTKAL_DATA.map(b => b.code);

app.use(cors());
app.use(express.json({ limit: '20mb' }));

interface BeadGenerateRequest {
  dataUrl: string;
  mode?: 'fixed_grid' | 'pixel_size';
  gridSize?: number;
  gridWidth?: number;
  gridHeight?: number;
  pixelSize?: number;
  palettePreset?: '96' | '120' | '144' | '168' | '221';
  useDithering?: boolean;
  maxColors?: number;
  mergeThreshold?: number;
  removeBg?: boolean;
  contrast?: number;
  saturation?: number;
  sharpness?: number;
}

interface BeadGenerateResponse {
  pixelUrl: string;
  source: 'backend';
  sessionId: string;
  pattern: {
    grid: number[][];
    palette: string[];
    codes: string[];
    names: string[];
  };
  colorCount: number;
  totalBeads: number;
  colorSummary: Array<{ index: number; hex: string; count: number; code: string; name: string }>;
}
const PRESET_COUNTS: Record<'96' | '120' | '144' | '168' | '221', number> = {
  '96': 96,
  '120': 120,
  '144': 144,
  '168': 168,
  '221': 221,
};

type BeadSession = {
  grid: number[][];
  palette: string[];
};

const beadSessions = new Map<string, BeadSession>();

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function nearestPaletteIndex(r: number, g: number, b: number, paletteRgb: Array<[number, number, number]>): number {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < paletteRgb.length; i += 1) {
    const [pr, pg, pb] = paletteRgb[i];
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function renderPatternRaw(grid: number[][], paletteRgb: Array<[number, number, number]>, cellSize = 8, showGrid = true): { raw: Buffer; width: number; height: number } {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  const width = w * cellSize;
  const height = h * cellSize;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b] = paletteRgb[grid[y][x]] || [255, 255, 255];
      for (let py = 0; py < cellSize; py += 1) {
        for (let px = 0; px < cellSize; px += 1) {
          const rx = x * cellSize + px;
          const ry = y * cellSize + py;
          const i = (ry * width + rx) * 3;
          raw[i] = r;
          raw[i + 1] = g;
          raw[i + 2] = b;
        }
      }
      if (showGrid) {
        // 横线 (Horizontal)
        for (let px = 0; px < cellSize; px += 1) {
          const rx = x * cellSize + px;
          const top = (y * cellSize * width + rx) * 3;
          raw[top] = 0; raw[top + 1] = 0; raw[top + 2] = 0;
        }
        // 竖线 (Vertical)
        for (let py = 0; py < cellSize; py += 1) {
          const ry = y * cellSize + py;
          const left = (ry * width + x * cellSize) * 3;
          raw[left] = 0; raw[left + 1] = 0; raw[left + 2] = 0;
        }
      }
    }
  }
  // 补齐右边界和下边界
  if (showGrid) {
    for (let ry = 0; ry < height; ry += 1) {
      const right = (ry * width + (width - 1)) * 3;
      raw[right] = 0; raw[right + 1] = 0; raw[right + 2] = 0;
    }
    for (let rx = 0; rx < width; rx += 1) {
      const bottom = ((height - 1) * width + rx) * 3;
      raw[bottom] = 0; raw[bottom + 1] = 0; raw[bottom + 2] = 0;
    }
  }
  return { raw, width, height };
}

function colorDistanceSq(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function countColors(grid: number[][]): Map<number, number> {
  const counter = new Map<number, number>();
  for (const row of grid) {
    for (const c of row) {
      counter.set(c, (counter.get(c) || 0) + 1);
    }
  }
  return counter;
}

function cleanupRareColors(grid: number[][], paletteRgb: Array<[number, number, number]>, minRatio: number): number[][] {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  const total = h * w;
  const counter = countColors(grid);
  const rare = [...counter.entries()].filter(([, n]) => n / total < minRatio).map(([c]) => c);
  if (rare.length === 0) return grid;

  const keep = [...counter.keys()].filter((c) => !rare.includes(c));
  if (keep.length === 0) return grid;

  return grid.map((row) => row.map((c) => {
    if (!rare.includes(c)) return c;
    let best = keep[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const k of keep) {
      const d = colorDistanceSq(paletteRgb[c], paletteRgb[k]);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    return best;
  }));
}

function mergeSimilarColors(grid: number[][], paletteRgb: Array<[number, number, number]>, threshold: number): number[][] {
  if (threshold <= 0) return grid;
  const thresholdSq = threshold * threshold;
  const counter = countColors(grid);
  const sorted = [...counter.entries()].sort((a, b) => a[1] - b[1]).map(([c]) => c);
  const map = new Map<number, number>();

  for (const c of sorted) {
    if (map.has(c)) continue;
    const cCount = counter.get(c) || 0;
    let bestTarget: number | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [target, tCount] of counter.entries()) {
      if (target === c || tCount < cCount) continue;
      const d = colorDistanceSq(paletteRgb[c], paletteRgb[target]);
      if (d <= thresholdSq && d < bestDist) {
        bestDist = d;
        bestTarget = target;
      }
    }
    if (bestTarget !== null) map.set(c, bestTarget);
  }

  if (map.size === 0) return grid;
  return grid.map((row) => row.map((c) => map.get(c) ?? c));
}

function capMaxColors(grid: number[][], paletteRgb: Array<[number, number, number]>, maxColors: number): number[][] {
  if (maxColors <= 0) return grid;
  const counter = countColors(grid);
  if (counter.size <= maxColors) return grid;

  const keep = [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxColors).map(([c]) => c);
  return grid.map((row) => row.map((c) => {
    if (keep.includes(c)) return c;
    let best = keep[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const k of keep) {
      const d = colorDistanceSq(paletteRgb[c], paletteRgb[k]);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    return best;
  }));
}

function smoothEdges(grid: number[][]): number[][] {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  if (h < 3 || w < 3) return grid;
  const out = grid.map((r) => [...r]);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const center = grid[y][x];
      const neighbors = [
        grid[y - 1][x], grid[y + 1][x], grid[y][x - 1], grid[y][x + 1],
        grid[y - 1][x - 1], grid[y - 1][x + 1], grid[y + 1][x - 1], grid[y + 1][x + 1],
      ];
      const same = neighbors.filter((n) => n === center).length;
      if (same >= 2) continue;
      const freq = new Map<number, number>();
      neighbors.forEach((n) => freq.set(n, (freq.get(n) || 0) + 1));
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 4) out[y][x] = top[0];
    }
  }
  return out;
}

function removeBackground(grid: number[][]): number[][] {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  if (!h || !w) return grid;

  const border: number[] = [];
  for (let x = 0; x < w; x += 1) {
    border.push(grid[0][x], grid[h - 1][x]);
  }
  for (let y = 1; y < h - 1; y += 1) {
    border.push(grid[y][0], grid[y][w - 1]);
  }
  const freq = new Map<number, number>();
  border.forEach((c) => freq.set(c, (freq.get(c) || 0) + 1));
  const bg = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (bg === undefined) return grid;

  const out = grid.map((r) => [...r]);
  const visited = Array.from({ length: h }, () => Array<boolean>(w).fill(false));
  const q: Array<[number, number]> = [];
  const pushIfBg = (y: number, x: number) => {
    if (!visited[y][x] && out[y][x] === bg) {
      visited[y][x] = true;
      q.push([y, x]);
    }
  };
  for (let x = 0; x < w; x += 1) {
    pushIfBg(0, x);
    pushIfBg(h - 1, x);
  }
  for (let y = 1; y < h - 1; y += 1) {
    pushIfBg(y, 0);
    pushIfBg(y, w - 1);
  }

  while (q.length) {
    const [y, x] = q.shift()!;
    const neighbors: Array<[number, number]> = [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]];
    for (const [ny, nx] of neighbors) {
      if (ny < 0 || nx < 0 || ny >= h || nx >= w) continue;
      if (!visited[ny][nx] && out[ny][nx] === bg) {
        visited[ny][nx] = true;
        q.push([ny, nx]);
      }
    }
    out[y][x] = 1; // 将背景替换为浅色，避免透明导致现有 UI 不兼容
  }
  return out;
}

app.post('/api/bead/generate', async (req, res) => {
  try {
    const {
      dataUrl,
      mode = 'fixed_grid',
      gridSize = 32,
      gridWidth,
      gridHeight,
      pixelSize = 8,
      palettePreset = '221',
      useDithering = false,
      maxColors = 24,
      mergeThreshold = 0,
      removeBg = false,
      contrast = 10,
      saturation = 10,
      sharpness = 10,
    } = req.body as BeadGenerateRequest;
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image dataUrl' });
    }
    let safeGridW = Math.max(16, Math.min(128, Number(gridWidth) || Number(gridSize) || 32));
    let safeGridH = Math.max(16, Math.min(128, Number(gridHeight) || Number(gridSize) || 32));

    const base64 = dataUrl.split(',')[1];
    const inputBuffer = Buffer.from(base64, 'base64');
    const meta = await sharp(inputBuffer).metadata();
    if (mode === 'pixel_size') {
      const srcW = meta.width || safeGridW * pixelSize;
      const srcH = meta.height || safeGridH * pixelSize;
      safeGridW = Math.max(16, Math.min(128, Math.floor(srcW / Math.max(2, pixelSize))));
      safeGridH = Math.max(16, Math.min(128, Math.floor(srcH / Math.max(2, pixelSize))));
    }

    const aaFactor = 4;
    const midW = safeGridW * aaFactor;
    const midH = safeGridH * aaFactor;
    const contrastAlpha = 1 + Math.max(-50, Math.min(50, contrast)) / 100;
    const contrastBias = 128 * (1 - contrastAlpha);

    let pipeline = sharp(inputBuffer)
      .resize(midW, midH, { fit: 'cover' })
      .removeAlpha()
      .modulate({ saturation: 1 + Math.max(-50, Math.min(50, saturation)) / 100 });
    if (sharpness > 0) {
      pipeline = pipeline.sharpen(1 + sharpness / 30);
    } else if (sharpness < 0) {
      pipeline = pipeline.blur(1 + Math.abs(sharpness) / 30);
    }
    const raw = await pipeline.linear(contrastAlpha, contrastBias).raw().toBuffer();

    const presetCount = PRESET_COUNTS[palettePreset] ?? 221;
    const activePalette = FULL_BEAD_PALETTE.slice(0, presetCount);
    const activeNames = FULL_BEAD_NAMES.slice(0, presetCount);
    const activeCodes = FULL_BEAD_CODES.slice(0, presetCount);
    const paletteRgb = activePalette.map(hexToRgb);

    // 1) 在中间分辨率上量化（可选 Floyd-Steinberg 抖动）
    const q = new Int16Array(midW * midH);
    const work = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) work[i] = raw[i];

    for (let y = 0; y < midH; y += 1) {
      for (let x = 0; x < midW; x += 1) {
        const i = (y * midW + x) * 3;
        const r = Math.max(0, Math.min(255, Math.round(work[i])));
        const g = Math.max(0, Math.min(255, Math.round(work[i + 1])));
        const b = Math.max(0, Math.min(255, Math.round(work[i + 2])));
        const idx = nearestPaletteIndex(r, g, b, paletteRgb);
        q[y * midW + x] = idx;

        if (useDithering) {
          const [pr, pg, pb] = paletteRgb[idx];
          const er = r - pr;
          const eg = g - pg;
          const eb = b - pb;
          const spread = (tx: number, ty: number, ratio: number) => {
            if (tx < 0 || ty < 0 || tx >= midW || ty >= midH) return;
            const ti = (ty * midW + tx) * 3;
            work[ti] += er * ratio;
            work[ti + 1] += eg * eg * ratio;
            work[ti + 2] += eb * ratio;
          };
          spread(x + 1, y, 7 / 16);
          spread(x - 1, y + 1, 3 / 16);
          spread(x, y + 1, 5 / 16);
          spread(x + 1, y + 1, 1 / 16);
        }
      }
    }

    // 2) mode-pool 到目标网格
    let grid: number[][] = [];
    for (let gy = 0; gy < safeGridH; gy += 1) {
      const row: number[] = [];
      for (let gx = 0; gx < safeGridW; gx += 1) {
        const freq = new Map<number, number>();
        for (let py = 0; py < aaFactor; py += 1) {
          for (let px = 0; px < aaFactor; px += 1) {
            const x = gx * aaFactor + px;
            const y = gy * aaFactor + py;
            const c = q[y * midW + x];
            freq.set(c, (freq.get(c) || 0) + 1);
          }
        }
        const best = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
        row.push(best);
      }
      grid.push(row);
    }

    // 3) 高级后处理
    grid = cleanupRareColors(grid, paletteRgb, 0.005);
    grid = mergeSimilarColors(grid, paletteRgb, Math.max(0, Math.min(80, mergeThreshold)));
    grid = capMaxColors(grid, paletteRgb, Math.max(0, Math.min(64, maxColors)));
    grid = smoothEdges(grid);
    if (removeBg) grid = removeBackground(grid);
    const colorCounter = countColors(grid);
    const colorSummary = [...colorCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([index, count]) => ({ 
        index, 
        hex: activePalette[index], 
        count,
        code: activeCodes[index],
        name: activeNames[index]
      }));
    const totalBeads = safeGridW * safeGridH;

    const { raw: previewRaw, width: previewW, height: previewH } = renderPatternRaw(grid, paletteRgb, 8, true);
    const previewBuffer = await sharp(previewRaw, {
      raw: { width: previewW, height: previewH, channels: 3 },
    }).png().toBuffer();

    const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    beadSessions.set(sessionId, { grid, palette: activePalette });
    
    const payload: BeadGenerateResponse = {
      pixelUrl: `data:image/png;base64,${previewBuffer.toString('base64')}`,
      source: 'backend',
      sessionId,
      pattern: {
        grid,
        palette: activePalette,
        codes: activeCodes,
        names: activeNames
      },
      colorCount: colorSummary.length,
      totalBeads,
      colorSummary,
    };
    return res.json(payload);
  } catch (error: any) {
    console.error('Bead generate error:', error?.message || error);
    return res.status(500).json({ error: 'Bead generation failed' });
  }
});

app.post('/api/bead/update-cell', (req, res) => {
  try {
    const { sessionId, row, col, colorIndex } = req.body as { sessionId: string; row: number; col: number; colorIndex: number };
    const session = beadSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!Number.isInteger(row) || !Number.isInteger(col) || !Number.isInteger(colorIndex)) {
      return res.status(400).json({ error: 'Invalid params' });
    }
    const h = session.grid.length;
    const w = session.grid[0]?.length || 0;
    if (row < 0 || col < 0 || row >= h || col >= w) return res.status(400).json({ error: 'Out of range' });
    if (colorIndex < 0 || colorIndex >= session.palette.length) return res.status(400).json({ error: 'Invalid colorIndex' });
    session.grid[row][col] = colorIndex;
    const counter = countColors(session.grid);
    const colorSummary = [...counter.entries()].sort((a, b) => b[1] - a[1]).map(([index, count]) => ({ 
      index, 
      hex: session.palette[index], 
      count,
      code: FULL_BEAD_CODES[index],
      name: FULL_BEAD_NAMES[index]
    }));
    return res.json({ success: true, colorSummary, totalBeads: h * w, colorCount: colorSummary.length });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Update failed' });
  }
});

app.post('/api/bead/export/png', async (req, res) => {
  try {
    const { grid, palette, cellSize = 12, showGrid = true } = req.body as { grid: number[][]; palette: string[]; cellSize?: number; showGrid?: boolean };
    if (!Array.isArray(grid) || !Array.isArray(palette)) return res.status(400).json({ error: 'Invalid payload' });
    const rgb = palette.map(hexToRgb);
    const { raw, width, height } = renderPatternRaw(grid, rgb, Math.max(4, Math.min(30, cellSize)), showGrid);
    const png = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
    return res.json({ dataUrl: `data:image/png;base64,${png.toString('base64')}` });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Export PNG failed' });
  }
});

app.post('/api/bead/export/pdf', async (req, res) => {
  try {
    const { grid, palette, cellSize = 12, showGrid = true } = req.body as { grid: number[][]; palette: string[]; cellSize?: number; showGrid?: boolean };
    if (!Array.isArray(grid) || !Array.isArray(palette)) return res.status(400).json({ error: 'Invalid payload' });
    const rgb = palette.map(hexToRgb);
    const { raw, width, height } = renderPatternRaw(grid, rgb, Math.max(4, Math.min(30, cellSize)), showGrid);
    const png = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const doc = await PDFDocument.create();
    const page = doc.addPage([Math.max(200, width), Math.max(200, height)]);
    const image = await doc.embedPng(png);
    page.drawImage(image, { x: 0, y: 0, width: Math.max(200, width), height: Math.max(200, height) });
    const pdfBytes = await doc.save();
    return res.json({ dataUrl: `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}` });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Export PDF failed' });
  }
});

// ==========================================
// AI 逻辑迁移至后端 (保护 API Key)
// ==========================================
const DOUBAO_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const buildSystemPrompt = (method: string) => {
  const isBazi = method === 'bazi';
  return `你是"像素生活志"APP中的一位顶级神秘学大师。你不仅精通${isBazi ? '四柱八字命理' : '西方神秘塔罗'}，还是一位洞察力极强的城市空间策展人。
你的任务：
1. ${isBazi ? '根据用户的出生信息进行排盘。' : '根据用户当前的时间和情绪状态，从塔罗牌中选出一张牌。'}
2. 从提供的商户列表中，锁定那家最适合用户的店面。
3. 撰写一段具有宿命感和文学美感的占卜判词（60-80字）。

必须严格返回 JSON 格式：
{
  "cardName": "名称",
  "emoji": "对应emoji",
  "meaning": "寓意短语",
  "poiId": "商户id",
  "reading": "判词内容"
}`;
};

app.post('/api/ai/reading', async (req, res) => {
  try {
    const { mood, pois, method, baziInfo, timeContext, stream = false, card } = req.body;
    const apiKey = process.env.DOUBAO_API_KEY || process.env.VITE_DOUBAO_API_KEY;
    const modelId = process.env.DOUBAO_MODEL_ID || process.env.VITE_DOUBAO_MODEL_ID;

    if (!apiKey || !modelId) {
      return res.status(500).json({ error: 'Backend AI not configured' });
    }

    const payload = {
      model: modelId,
      messages: [
        { role: 'system', content: buildSystemPrompt(method) },
        { 
          role: 'user', 
          content: `【当前环境】${timeContext}
【用户倾向】${JSON.stringify(mood)}
【占卜方式】${method}
${card ? `【抽中塔罗牌】${card.name} (${card.emoji}) - 含义: ${card.meaning}` : ''}
${baziInfo ? `【八字信息】${JSON.stringify(baziInfo)}` : ''}
【候选商户】：${JSON.stringify(pois.slice(0, 10))}
请返回 JSON 占卜结果。` 
        },
      ],

      temperature: 0.8,
      stream, // 支持流式开关
    };

    if (stream) {
      // 流式响应处理
      const response = await axios.post(DOUBAO_ENDPOINT, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        responseType: 'stream',
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      response.data.on('data', (chunk: Buffer) => {
        res.write(chunk);
      });

      response.data.on('end', () => {
        res.end();
      });

      response.data.on('error', (err: any) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      // 普通 JSON 响应
      const response = await axios.post(DOUBAO_ENDPOINT, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      let content = response.data.choices?.[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/({[\s\S]*})/);
        if (jsonMatch) content = jsonMatch[1];
        res.json(JSON.parse(content));
      } else {
        throw new Error('Empty AI response');
      }
    }
  } catch (error: any) {
    console.error('AI Proxy Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI processing failed' });
    }
  }
});


// 基础路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pixel Life Chronicles Backend is running' });
});

// 导出 app 供 Vercel 使用
export default app;

// 仅在非 Vercel 环境下启动服务器
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
    👾 Pixel Life Chronicles Backend
    🚀 Server running on http://localhost:${PORT}
    `);
  });
}

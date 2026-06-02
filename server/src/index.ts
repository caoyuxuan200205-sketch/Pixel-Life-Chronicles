import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { calculateBazi } from './baziHelper';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execFileAsync = promisify(execFile);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 初始化 Supabase 客户端 (后端使用)
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

console.log('Supabase Backend Init (Trimmed):', { 
  url: supabaseUrl ? 'Set' : 'MISSING', 
  urlValue: supabaseUrl,
  key: supabaseAnonKey ? 'Set' : 'MISSING' 
});

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
const getAIConfig = () => {
  const qwenApiKey = process.env.QWEN_API_KEY;
  if (qwenApiKey && qwenApiKey !== 'YOUR_QWEN_API_KEY_HERE' && qwenApiKey.trim() !== '') {
    return {
      apiKey: qwenApiKey.trim(),
      baseUrl: (process.env.QWEN_BASE_URL || 'https://api-inference.modelscope.cn/v1').trim(),
      modelId: (process.env.QWEN_MODEL || 'Qwen/Qwen3.5-35B-A3B').trim(),
      isQwen: true
    };
  }

  // Fallback to Doubao
  return {
    apiKey: (process.env.DOUBAO_API_KEY || process.env.VITE_DOUBAO_API_KEY || '').trim(),
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    modelId: (process.env.DOUBAO_MODEL_ID || process.env.VITE_DOUBAO_MODEL_ID || '').trim(),
    isQwen: false
  };
};

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
    const { apiKey, baseUrl, modelId } = getAIConfig();

    if (!apiKey || !modelId) {
      return res.status(500).json({ error: 'Backend AI not configured' });
    }

    const endpoint = `${baseUrl}/chat/completions`;
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
      const response = await axios.post(endpoint, payload, {
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
      const response = await axios.post(endpoint, payload, {
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

// ==========================================
// 身份验证中转 API (解决国内直连 Supabase 困难)
// ==========================================
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(error.status || 400).json(error);
    
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(error.status || 400).json(error);
    
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 业务数据中转 API (印章记录)
// ==========================================

// 获取用户的全部印章
app.get('/api/stamps', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing authorization' });

    // 用用户的 Token 初始化一个临时客户端，以遵循 RLS
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data, error } = await userClient
      .from('stamps')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json(error);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 保存新印章
app.post('/api/stamps', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing authorization' });

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { poi_name, poi_type, pixel_image_data, reading, card_name, bead_pattern } = req.body;
    
    // 获取当前用户 ID
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Invalid session' });

    const { data, error } = await userClient
      .from('stamps')
      .insert([
        { 
          user_id: user.id,
          poi_name, 
          poi_type, 
          pixel_image_data, 
          reading, 
          card_name,
          bead_pattern 
        }
      ])
      .select();

    if (error) return res.status(400).json(error);
    res.json(data[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/session', async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body;
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) return res.status(error.status || 400).json(error);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// 👾 时空命格结界 - 多人协同规划 Agent 接口
// ==========================================

const LOCAL_TAROT_CARDS = [
  { name: 'The Lovers', emoji: '❤️', meaning: '吸引、爱、美与命运的交汇。' },
  { name: 'The Sun', emoji: '☀️', meaning: '生命的活力、光明、纯粹的快乐。' },
  { name: 'Wheel Of Fortune', emoji: '🎡', meaning: '命运之轮转动，带来转机与巧合。' },
  { name: 'The Star', emoji: '⭐', meaning: '希望、灵感与宇宙源源不断的能量。' },
  { name: 'The Fool', emoji: '🃏', meaning: '自由、探索新的冒险旅程、踏入未知。' },
  { name: 'The Magician', emoji: '🪄', meaning: '创造力、沟通、化理想为现实的魔力。' }
];

app.post('/api/agent/plan', async (req, res) => {
  try {
    const { members = [], pois = [], timeBudget = 4 } = req.body;
    
    if (members.length === 0) {
      return res.status(400).json({ error: '成员列表不能为空' });
    }

    // 1. 在后端进行八字排盘数据补充，作为 AI 的深度上下文
    const processedMembers = members.map((member: any) => {
      if (member.divinationMethod === 'bazi' && member.baziInfo) {
        const baziChart = calculateBazi(member.baziInfo.birthDate, member.baziInfo.birthTime);
        return {
          ...member,
          baziChart
        };
      }
      return member;
    });

    const { apiKey, baseUrl, modelId } = getAIConfig();

    // 筛选前15个候选商户进行规划，防止 prompt 过长
    const candidatePois = pois.length > 0 ? pois.slice(0, 15) : [
      { id: 'poi_1', name: '猫空时光咖啡馆', type: '咖啡馆', rating: 4.8, distance: 350, location: [120.153, 30.258], address: '南山路22号' },
      { id: 'poi_2', name: '涌金门遗址公园', type: '公园/名胜', rating: 4.7, distance: 820, location: [120.155, 30.252], address: '西湖风景区内' },
      { id: 'poi_3', name: '像素盒子桌游密室', type: '娱乐空间', rating: 4.9, distance: 1200, location: [120.162, 30.261], address: '定安路108号' },
      { id: 'poi_4', name: '半山草木素食餐厅', type: '餐饮/素食', rating: 4.6, distance: 1500, location: [120.148, 30.245], address: '阔石板路8号' }
    ];

    let planData: any = null;

    if (apiKey && modelId) {
      try {
        const systemPrompt = `你是一个融合了东方命理学（生辰八字）与西方神秘学（塔罗占卜）的“时空命运规划御史” (Chrono-Destiny Plan Agent)。
你的任务是为结界中的所有成员，在候选商户 POI 中，规划一条长约 ${timeBudget} 小时的周末出行轨迹，并完成各自的命运解读。你必须严格甄选商户，使行程顺次相连（由近及远或圆弧线路），并且具备命运关联的寓意。

请必须按照以下 JSON 格式返回，不要包含任何 markdown 标记、\`\`\`json 块或多余解释文本：
{
  "divinationSynthesis": "一段优美的命运交织综述，说明为何大家今天走在一起，各自的能量如何互补（中文，富有玄学意境和诗意，约150字）",
  "itinerary": [
    {
      "id": "活动1的唯一ID",
      "poiId": "对应的候选商户ID",
      "timeSlot": "例如 14:00 - 15:30",
      "activityName": "例如 命定灵感、乾坤补水 等富有玄学像素风的名字",
      "mysticReasoning": "命运羁绊分析：结合成员的塔罗牌或八字五行，解释为什么在这个时间在这个地方活动，能给他们补充什么能量",
      "suggestedBooking": {
        "type": "didi" | "coupon" | "ticket" | "none",
        "name": "例如：呼叫像素专车 / 领取满100减20代金券 / 预订手作双人票",
        "detail": "补充预订说明参数"
      }
    }
  ],
  "individualReadings": [
    {
      "memberId": "成员的ID",
      "readingText": "针对该成员的详细命运占卜词。若是塔罗牌，必须结合你为他抽中的牌面和其情绪标签来解读；若是八字，必须分析其日主五行、喜用五行以及和今日行程的契合点。",
      "tarotCardName": "如果是塔罗，返回抽中的塔罗牌英文名（如 The Sun，必须在标准大阿卡纳中），否则不填",
      "tarotCardEmoji": "如果是塔罗，返回对应的 emoji，否则不填"
    }
  ]
}`;

        const response = await axios.post(`${baseUrl}/chat/completions`, {
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: `【结界成员配置】：
${JSON.stringify(processedMembers, null, 2)}

【候选商户】：
${JSON.stringify(candidatePois, null, 2)}

请对上述成员与商户进行命轨编织，合理利用时间预算（${timeBudget} 小时），返回纯 JSON。`
            }
          ],
          temperature: 0.8
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        });

        const content = response.data?.choices?.[0]?.message?.content;
        if (content) {
          const jsonMatch = content.match(/({[\s\S]*})/);
          if (jsonMatch) {
            planData = JSON.parse(jsonMatch[1]);
          }
        }
      } catch (err) {
        console.error('Doubao Agent API call failed, falling back to local generator:', err);
      }
    }

    // 2. 健壮的本地备用生成逻辑 (在 API 失败或未配置时确保 100% 成功返回，保证演示流畅)
    if (!planData) {
      console.log('Generating high-fidelity fallback plan locally...');
      const planId = `plan_${Date.now()}`;
      
      // 精选 2-3 个 POI 作为路线
      const itineraryCount = timeBudget <= 3 ? 2 : 3;
      const selectedPois = candidatePois.slice(0, Math.min(itineraryCount, candidatePois.length));
      
      const itinerary = selectedPois.map((poi: any, idx: number) => {
        const timeSlots = ["14:00 - 15:30", "15:45 - 17:15", "17:30 - 19:30"];
        const names = ["【命定探幽】释放尘世尘嚣", "【结界补充】汲取星灵之力", "【乾坤契约】命运之火炙烤"];
        const reasons = [
          `此地气场纯净，极佳地回应了成员在命盘中对于环境互补的渴求，是一场天意注定的停留。`,
          `此处处于结界的生气方位，五行交织，是平衡结界内成员各自命轨中短板能量的最佳时空节点。`,
          `在今日命运的收尾时刻，选择此处共进晚宴或聚会，将为结界诸人的运势牢牢打上命定钢印。`
        ];
        const bookingTypes: ('didi' | 'coupon' | 'ticket' | 'none')[] = ['didi', 'ticket', 'coupon'];
        const bookingNames = [
          `呼叫像素专车往返接送`,
          `获取商户门票/预约手作材料包`,
          `一键获取专享满百减二十代金券`
        ];

        return {
          id: `event_${planId}_${idx}`,
          poiId: poi.id,
          poi: poi,
          timeSlot: timeSlots[idx] || "18:00 - 19:30",
          activityName: names[idx] || "命运余晖",
          mysticReasoning: reasons[idx],
          bookingStatus: bookingTypes[idx] !== 'none' ? {
            type: bookingTypes[idx],
            name: bookingNames[idx],
            status: 'pending'
          } : undefined
        };
      });

      const individualReadings = processedMembers.map((member: any) => {
        if (member.divinationMethod === 'tarot') {
          const cardIdx = member.tarotCardIndex !== undefined ? member.tarotCardIndex : Math.floor(Math.random() * LOCAL_TAROT_CARDS.length);
          const drawn = LOCAL_TAROT_CARDS[cardIdx % LOCAL_TAROT_CARDS.length];
          return {
            memberId: member.id,
            tarotCard: drawn,
            readingText: `您感应并抽中了【${drawn.name}】牌 (${drawn.emoji})。针对您当前“${member.mood || '随便走走'}”的心态，此牌昭示着一次能量的大跨步。今日的行程将为您拂去心灵的负荷，在命定锚点与朋友的磁场共振，注入崭新的创造力。`
          };
        } else {
          const chart = member.baziChart;
          return {
            memberId: member.id,
            baziChart: chart,
            readingText: `您的生辰八字命盘排定：日主属【${chart?.mainElement || '土'}】。今日时空星轨中，【${chart?.luckyElement || '水'}】气最旺。而今日为您规划的目的地正好极富【${chart?.luckyElement || '水'}】之本源，与您的命盘产生良性的相生磁场，对于您所求的“出行与气运”将带来极佳的护持与净化。`
          };
        }
      });

      planData = {
        divinationSynthesis: "星斗偏转，金木互济。今天结界诸人的缘分线在时空经纬中悄然重叠。这是一场动静相宜的旅程：用塔罗的热烈与探寻去点燃平静的乾坤，同时用八字五行的浑厚土木之气去包容情绪的波动。这是一场上苍早有安排的完美会盟。",
        itinerary,
        individualReadings
      };
    }

    // 3. 对预订项初始化 pending 状态，并在返回前进行结构调整
    const planId = `plan_${Date.now()}`;
    const finalizedPlan = {
      id: planId,
      members: processedMembers,
      timeBudget,
      divinationSynthesis: planData.divinationSynthesis,
      itinerary: planData.itinerary.map((event: any, idx: number) => {
        // 如果是从 AI 返回的，POI 实体需要在这里组装好
        const poiEntity = pois.find((p: any) => p.id === event.poiId) || 
                          candidatePois[idx % candidatePois.length];
        
        // 提取建议 of booking
        let bookingStatus = undefined;
        if (event.suggestedBooking && event.suggestedBooking.type !== 'none') {
          bookingStatus = {
            type: event.suggestedBooking.type,
            name: event.suggestedBooking.name,
            status: 'pending',
            detail: event.suggestedBooking.detail
          };
        } else if (event.bookingStatus) {
          bookingStatus = event.bookingStatus;
        }

        return {
          id: event.id || `event_${planId}_${idx}`,
          poi: poiEntity,
          timeSlot: event.timeSlot,
          activityName: event.activityName,
          mysticReasoning: event.mysticReasoning,
          bookingStatus
        };
      }),
      individualReadings: planData.individualReadings.map((reading: any) => {
        const member = processedMembers.find((m: any) => m.id === reading.memberId);
        
        let tarotCard = undefined;
        if (reading.tarotCardName) {
          tarotCard = {
            name: reading.tarotCardName,
            emoji: reading.tarotCardEmoji || '🔮',
            meaning: '命运的神秘感应。'
          };
        } else if (reading.tarotCard) {
          tarotCard = reading.tarotCard;
        } else if (member && member.divinationMethod === 'tarot') {
          const cardIdx = member.tarotCardIndex !== undefined ? member.tarotCardIndex : 0;
          tarotCard = LOCAL_TAROT_CARDS[cardIdx % LOCAL_TAROT_CARDS.length];
        }

        return {
          memberId: reading.memberId,
          readingText: reading.readingText,
          tarotCard,
          baziChart: member?.baziChart || reading.baziChart
        };
      }),
      createdAt: new Date().toISOString()
    };

    res.json(finalizedPlan);
  } catch (error: any) {
    console.error('Plan creation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/book', (req, res) => {
  try {
    const { planId, eventId, bookingType } = req.body;
    
    // 模拟不同业务的实时履约情况
    let detail = '';
    if (bookingType === 'didi') {
      detail = '【像素打车呼叫成功】专车司机（李师傅 浙A·88P8X）正火速驾车赶来，预计3分钟到达！';
    } else if (bookingType === 'ticket') {
      detail = '【时空通行证购买成功】已成功为您预订手作门票包，入场码：PX-9928-88，美团同城闪购材料配送中！';
    } else if (bookingType === 'coupon') {
      detail = '【限时天降福利 claimed】满100减20代金券已成功放入您的美团卡包，直接付款立减！';
    } else {
      detail = '预订项目已确认履约！';
    }

    res.json({
      success: true,
      status: 'success',
      detail
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 美团酒旅真实 API & 离线 Mock 双核服务层 (参考 manlv-backend 规范)
app.post('/api/agent/meituan', async (req, res) => {
  try {
    const { city = '杭州', query = '周边游温泉度假', luckyElement = '金' } = req.body;
    
    // 构造高保真动态兜底数据
    const fallbackMock = {
      hotel: {
        name: `🏨 ${city}星曜${luckyElement}灵隐私汤山庄`,
        rating: '4.9分 (美团金牌推荐)',
        tag: `五行${luckyElement}系能量 | 隐奢私汤`,
        price: '￥580/晚',
        room: `观澜${luckyElement}耀玄机大床房`,
        desc: `依傍时空结界，特别融合您的幸运五行【${luckyElement}】属性进行建筑规划与能量微调，能完美消解近期疲劳并达成出行愿望：“${query}”。`
      },
      scenic: {
        name: `🏕️ ${city}${luckyElement}曜森林自驾探索景区`,
        rating: '4.8分 (本周自驾热度No.1)',
        tag: `五行${luckyElement}互补 | 宿命探索`,
        price: '￥88 (大门票+时空体验)',
        desc: `该景区磁场具有深厚的【${luckyElement}】元素特质，契合您的天命八字，漫步或自驾其中可感应到极佳的能量流动，消解：“${query}”。`
      },
      auspiciousHour: {
        time: '07:00-09:00 (辰时)',
        label: '天乙贵人',
        luckLevel: '大吉',
        desc: '贵人临门，吉星高照，自驾出行大吉。'
      }
    };

    // 1. 尝试使用真实的 Qwen / 大模型 AI 接口生成
    const { apiKey, baseUrl, modelId } = getAIConfig();
    if (apiKey && modelId) {
      console.log(`Connecting to Qwen/Backend AI to generate surrounding tour for luckyElement=${luckyElement}, query=${query}...`);
      try {
        const systemPrompt = `你是一位精通东方神秘学（八字、五行生克）与现代生活美学的"时空探路祭司"。
你的任务是根据用户的幸运五行属性、所处城市以及出游心里话（天命契机），利用AI为他们推荐一款高度契合的美团特色隐奢民宿/酒店、一款开运自驾景区，并推算一个本周末最佳的出征吉时。

你必须严格按照以下 JSON 格式返回结果，不得包含任何 Markdown 格式标记（如 \`\`\`json）：
{
  "hotel": {
    "name": "🏨 [富有神秘意境与五行色彩的特色民宿/酒店名称]",
    "rating": "4.9分 (美团必住榜推荐)",
    "tag": "五行[五行属性，如金水]开运 | [特色短标签，如野奢私汤]",
    "price": "￥[价格]/晚",
    "room": "[富有神秘古画画风或开运意境的房型名称]",
    "desc": "[阐述该民宿是如何契合用户的幸运五行与出行心里话，并结合周边自然人文气场温养其身心气场的描述，80-120字]"
  },
  "scenic": {
    "name": "🏕️ [具有大自然野趣或人文地利的自驾开运景区名称]",
    "rating": "4.8分 (自驾热度No.1)",
    "tag": "五行[五行属性]互补 | [玩法短标签，如山川徒步]",
    "price": "￥[门票/套票价格] ([门票套餐描述])",
    "desc": "[阐述该景区如何根据地理方位、自然元素磁场（如竹林补木、水系补水、矿脉补金）契合幸运五行，指引开运出行的描述，80-120字]"
  },
  "auspiciousHour": {
    "time": "[具体出征吉时，例如：07:00-09:00 (辰时) 或 11:00-13:00 (午时)]",
    "label": "[吉星格局，例如：天乙贵人 或 青龙返首 或 三奇得使]",
    "luckLevel": "大吉",
    "desc": "[结合八字干支五行的吉时自驾出发建议，20-30字]"
  }
}`;

        const userMessage = `【用户基本天命参数】
- 当前探索地盘：${city}
- 用户幸运五行：${luckyElement}
- 用户心里话出行心里话 (自定义天命契机)："${query || '放松身心，呼吸大自然'}"

请结合上述信息，编织专属的周边游美团酒旅契约！`;

        const endpoint = `${baseUrl}/chat/completions`;
        const payload = {
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        };

        const aiResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData?.choices?.[0]?.message?.content;
          if (content) {
            let cleanedContent = content.trim();
            if (cleanedContent.startsWith('```json')) {
              cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedContent.startsWith('```')) {
              cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            const aiResult = JSON.parse(cleanedContent);
            console.log("Successfully generated real AI travel items from Qwen!");
            return res.json({
              success: true,
              source: 'real_qwen_ai',
              aiResult,
              luckyElement,
              city,
              query
            });
          }
        }
      } catch (err: any) {
        console.error('Qwen AI generation failed, falling back to mock:', err);
      }
    }

    // 2. 尝试使用真实美团 API
    const mtToken = process.env.MEITUAN_TRAVEL_TOKEN || process.env.VITE_MEITUAN_TRAVEL_TOKEN;
    if (mtToken) {
      console.log(`Connecting to real Meituan API for city=${city}, query=${query}...`);
      try {
        const mtConfigDir = path.join(os.homedir(), '.config', 'meituan-travel');
        await fs.promises.mkdir(mtConfigDir, { recursive: true });
        await fs.promises.writeFile(
          path.join(mtConfigDir, 'config.json'), 
          JSON.stringify({ key: mtToken }), 
          'utf-8'
        );

        const { stdout, stderr } = await execFileAsync('npx', [
          '-p', '@meituan-travel/travel-cli', 'mttravel',
          city.trim(), query.trim()
        ], {
          timeout: 120000,
          maxBuffer: 1024 * 1024 * 10,
          windowsHide: true,
          shell: process.platform === 'win32'
        });
        
        const output = [stdout, stderr].map(String).filter(Boolean).join('\n');
        return res.json({ 
          success: true,
          source: 'real_meituan_api', 
          result: output,
          aiResult: fallbackMock
        });
      } catch (err: any) {
        console.error('Real Meituan API failed, falling back to mock dataset:', err);
      }
    }

    // 3. 离线沙盒高保真数据兜底
    console.log(`Using mock Meituan dataset for luckyElement=${luckyElement}...`);
    return res.json({
      success: true,
      source: 'offline_sandbox',
      aiResult: fallbackMock,
      luckyElement,
      city,
      query
    });
  } catch (error: any) {
    console.error('Meituan API handler error:', error);
    res.status(500).json({ error: error.message || '内部服务异常' });
  }
});

// AI 探路祭司自然语言对话交互接口
app.post('/api/agent/chat', async (req, res) => {
  try {
    const { messages = [], luckyElement = '金', city = '杭州', username = '探索者' } = req.body;

    const { apiKey, baseUrl, modelId } = getAIConfig();
    if (!apiKey || !modelId) {
      return res.status(500).json({ error: 'Backend AI not configured' });
    }

    const systemPrompt = `你是一位精通东方神秘学（八字五行、奇门遁甲）与现代旅行美学的"时空探路祭司"智能出行 Agent。
你正在 Pixel Life Chronicles 中与探险者【${username}】交谈。用户的幸运五行为【${luckyElement}】，当前处于地盘【${city}】。

你的交谈规则：
1. 采用神秘、温暖、具有像素RPG祭司宿命感的口吻进行对话。
2. 引导用户向你述说心里话天命意向、出游意向、偏好等。
3. 当用户表达了具体的周边游意愿时，你可以动态推荐一个隐奢民宿/酒店、一个自驾开运景区，并给出一个出征吉时。
4. 如果你要给出上述周游推荐，请在你的文字回复的【最后】，附带一个严格符合以下 XML 标记包裹的 JSON 结构，以便前端进行高保真卡片渲染：

<travel_deal>
{
  "hotel": {
    "name": "🏨 [富有神秘意境与五行色彩的特色民宿/酒店名称]",
    "rating": "4.9分 (美团必住榜推荐)",
    "tag": "五行[五行属性，如金水]开运 | [特色短标签，如野奢私汤]",
    "price": "￥[价格]/晚",
    "room": "[富有开运意境的房型名称]",
    "desc": "[该民宿契合用户幸运五行与出游心里话的描述，60-80字]"
  },
  "scenic": {
    "name": "🏕️ [具有自然野趣或地利的自驾开运景区名称]",
    "rating": "4.8分 (自驾热度No.1)",
    "tag": "五行[五行属性]互补 | [玩法短标签，如山川徒步]",
    "price": "￥[门票价格] ([门票套餐描述])",
    "desc": "[该景区契合用户幸运五行与地理方位开运的描述，60-80字]"
  },
  "auspiciousHour": {
    "time": "[出征吉时时段，如 07:00-09:00 (辰时)]",
    "label": "[吉格，如天乙贵人]",
    "luckLevel": "大吉",
    "desc": "[出行自驾建议，20字]"
  }
}
</travel_deal>

请直接以自然语言跟用户对话，需要推荐时再附带上述标记。请不要包含 markdown 的 \`\`\`json 标记。`;

    const endpoint = `${baseUrl}/chat/completions`;
    const payload = {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7
    };

    const aiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const reply = aiData?.choices?.[0]?.message?.content || '时空结界微弱，祭司未能完全接收您的脑波，请重新感应。';
      return res.json({ success: true, reply });
    } else {
      throw new Error(`AI Gateway returned ${aiResponse.status}`);
    }
  } catch (error: any) {
    console.error('Chat API handler error:', error);
    res.status(500).json({ error: error.message || '内部服务异常' });
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

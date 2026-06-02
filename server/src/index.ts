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

// 通用流式 AI 代理：调用上游 LLM 的 stream 模式，转发 SSE 给客户端
// 通过持续发送数据保持 Vercel 连接存活，突破 10s 超时限制
async function streamingAIProxy(
  res: any,
  endpoint: string,
  payload: any,
  apiKey: string,
  postProcess?: (fullContent: string) => any
) {
  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 心跳定时器：每 3 秒发送一次保活 ping
  const heartbeat = setInterval(() => {
    try { res.write('data: {"type":"ping"}\n\n'); } catch (_) {}
  }, 3000);

  let fullContent = '';

  try {
    const response = await axios.post(endpoint, { ...payload, stream: true }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      responseType: 'stream',
      timeout: 120000
    });

    await new Promise<void>((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullContent += delta;
                // 转发进度 chunk 给客户端
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
              }
            } catch (_) {}
          }
        }
      });

      response.data.on('end', () => resolve());
      response.data.on('error', (err: any) => reject(err));
    });

    clearInterval(heartbeat);

    // 后处理：解析完整 JSON 并发送最终结果
    let result: any;
    if (postProcess) {
      result = postProcess(fullContent);
    } else {
      const jsonMatch = fullContent.match(/({[\s\S]*})/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('未能从 AI 响应中解析出 JSON');
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    clearInterval(heartbeat);
    console.error('Streaming AI proxy error:', error.message);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || 'AI 调用失败' })}\n\n`);
      res.end();
    } catch (_) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  }
}


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
    const { mood, pois, method, baziInfo, timeContext, card } = req.body;
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
      max_tokens: 500
    };

    await streamingAIProxy(res, endpoint, payload, apiKey);
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
    
    // 1. 随机打乱商户列表，并且仅提取前 8 家作为候选，极大地减小 AI 上下文，将生成耗时缩短 50% 以上，彻底规避 Vercel 超时限制
    const shuffledPois = [...pois].sort(() => Math.random() - 0.5);
    const candidatePois = shuffledPois.length > 0 ? shuffledPois.slice(0, 8) : [
      { id: 'poi_1', name: '猫空时光咖啡馆', type: '咖啡馆', rating: 4.8, distance: 350, location: [120.153, 30.258], address: '南山路22号' },
      { id: 'poi_2', name: '涌金门遗址公园', type: '公园/名胜', rating: 4.7, distance: 820, location: [120.155, 30.252], address: '西湖风景区内' },
      { id: 'poi_3', name: '像素盒子桌游密室', type: '娱乐空间', rating: 4.9, distance: 1200, location: [120.162, 30.261], address: '定安路108号' },
      { id: 'poi_4', name: '半山草木素食餐厅', type: '餐饮/素食', rating: 4.6, distance: 1500, location: [120.148, 30.245], address: '阔石板路8号' }
    ];

    let planData: any = null;

    if (apiKey && modelId) {
      try {
        const systemPrompt = `你是一个融合了东方命理学（生辰八字）与西方神秘学（塔罗占卜）的“时空命运规划御史” (Chrono-Destiny Plan Agent)。
你的任务是为结界中的所有成员，在候选商户 POI 中，规划一条长约 ${timeBudget} 小时的周末出行轨迹，并完成各自的命运解读。你必须根据成员的具体八字、喜用五行、塔罗运势、当前情绪倾向、以及他们键入的【心里话/天命出游意向】，进行极具“绝对说服力”和“深厚宿命感”的量身定制分析，严禁空洞笼统的套话！

【编织分析的硬性准则】：
1. 【命运交织综述 (divinationSynthesis)】：撰写一段 100-150 字的极具玄学意境和文学美感的联合解盘词。深度分析成员们的五行气场（如金木相克、水火既济）与心理倾向是如何在今日的特定时空交汇的，解释他们一同出行的“宿命契机”。
2. 【行进图谱命运分析 (mysticReasoning)】：为行程中的每个 POI 撰写一段 60-90 字的深度时空共鸣解析。不能使用笼统的一句话，必须结合这一商户的地理属性（如靠近湖泊补水、高山补木）、商户品类（如静心书店、热闹密室）以及它如何调和、温养结界内成员当前的本命能量，给出富有哲学哲理的理由。
3. 【成员专属解盘词 (readingText)】：为每个成员撰写一段 100-150 字极其精准的专属解盘分析：
   - 八字成员：必须展示对其“干支排盘”和“喜用神”的专业剖析，并紧密结合其【心里话/出行契机意向】（例如：若用户心里话是“想带爸爸去安静的温泉”，必须剖析这如何契合其孝道、水系温润命局等），指出今日行程对他们这趟出游愿望在运势上的神奇护持作用。
   - 塔罗成员：剖析其抽中的塔罗牌画面意象，将其与该成员当前的【心里话/出游愿望】及【情绪倾向】（如疲惫、无聊）产生宿命级共鸣，指引其在今日旅程中如何与自我达成和解，达成改运。

请必须按照以下 JSON 格式返回，绝对不要包含任何 markdown 标记（如 \`\`\`json）、多余解释或属性外文本，必须是纯粹的可解析 JSON：
{
  "divinationSynthesis": "命运交织深度综述，剖析结界气场与出行宿命（中文，100-150字）",
  "itinerary": [
    {
      "id": "活动1的唯一ID",
      "poiId": "对应的候选商户ID",
      "timeSlot": "例如 14:00 - 15:30",
      "activityName": "命定开运名称，如 坎水涤尘 等富有玄学像素风的名字，限8字",
      "mysticReasoning": "深度命运分析：详述此商户的磁场、五行地利与结界气场的宿命共鸣，限60-90字！",
      "suggestedBooking": {
        "type": "didi" | "coupon" | "ticket" | "none",
        "name": "预订建议名称，限10字",
        "detail": "参数"
      }
    }
  ],
  "individualReadings": [
    {
      "memberId": "成员的ID",
      "readingText": "专属深度解盘词。深度解构八字干支五行与心里话诉求的奇妙和解，或是塔罗牌面与情绪心里话的宿命共鸣，限100-150字！",
      "tarotCardName": "如果是塔罗，返回抽中的塔罗牌英文名（如 The Sun），否则不填",
      "tarotCardEmoji": "如果是塔罗，返回对应的 emoji，否则不填"
    }
  ]
}`;

        // 构造高动态性的时空命运扰动变数，强迫大模型在语言表达上打破固定句式
        const hexagrams = ['乾为天', '坤为地', '水雷屯', '山水蒙', '水天需', '天水讼', '地水师', '水地比', '风天小畜', '天泽履', '地天泰', '天地否', '天火同人', '火天大有', '地山谦', '雷地豫', '泽雷随', '山风蛊', '地泽临', '风地观', '火雷噬嗑', '山火贲', '山地剥', '地雷复', '天雷无妄', '山天大畜', '山雷颐', '泽风大过', '坎为水', '离为火', '泽山咸', '雷风恒', '天山遯', '雷天大壮', '火地晋', '地火明夷', '风火家人', '火泽睽', '水山蹇', '雷水解', '山泽损', '风雷益', '泽天夬', '天风姤', '泽地萃', '地风升', '泽水困', '巽为风', '兑为泽', '风水涣', '水泽节', '风泽中孚', '雷泽归妹', '雷火丰', '火山旅'];
        const randomHexagram = hexagrams[Math.floor(Math.random() * hexagrams.length)];
        const randomAngle = Math.floor(Math.random() * 360);
        const randomSeed = Math.random().toString(36).substring(7);

        const cosmicContext = `【本日天命时空星轨微小偏转扰动因子】：
- 当前值日卦象：${randomHexagram}
- 星轨偏转角：${randomAngle}°
- 混沌天命数：${randomSeed}
（🚨极其重要：每次召唤的“时空元气数”都在发生偏转！你必须以这一玄学动能为开运基调，打破陈规，结合这些随机玄学参数，每次都编织出全新的、风格迥异的出游轨迹，撰写视角独特、绝不重复的命运解盘词！）`;

        const endpoint = `${baseUrl}/chat/completions`;
        const payload = {
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: `【结界成员配置】：
${JSON.stringify(processedMembers, null, 2)}

【候选商户】：
${JSON.stringify(candidatePois, null, 2)}

${cosmicContext}

请对上述成员与商户进行命轨编织，合理利用时间预算（${timeBudget} 小时），返回纯 JSON。`
            }
          ],
          temperature: 0.85, // 提高温度以赋予大模型灵感，确保结果充满随机多样性与玄学奇遇
          max_tokens: 1500
        };

        const postProcess = (fullContent: string) => {
          let planData: any = null;
          const jsonMatch = fullContent.match(/({[\s\S]*})/);
          if (jsonMatch) {
            planData = JSON.parse(jsonMatch[1]);
          }
          if (!planData) {
            throw new Error('AI时空命格编织未能生成有效方案，请检查您的 QWEN_API_KEY 配置并重试。');
          }

          const planId = `plan_${Date.now()}`;
          return {
            id: planId,
            members: processedMembers,
            timeBudget,
            divinationSynthesis: planData.divinationSynthesis,
            itinerary: planData.itinerary.map((event: any, idx: number) => {
              const poiEntity = pois.find((p: any) => p.id === event.poiId) || 
                                candidatePois[idx % candidatePois.length];
              
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
        };

        await streamingAIProxy(res, endpoint, payload, apiKey, postProcess);
      } catch (err: any) {
        console.error('Qwen Agent plan API call failed:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: `时空编织大模型响应失败: ${err.message || '网络连接超时'}` });
        }
      }
    } else {
      if (!res.headersSent) {
        res.status(500).json({ error: 'AI 服务未配置' });
      }
    }
  } catch (error: any) {
    console.error('Plan creation failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
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

app.post('/api/agent/meituan', async (req, res) => {
  try {
    const { city = '杭州', query = '周边游温泉度假', luckyElement = '金' } = req.body;
    
    // 1. 尝试使用真实的 Qwen / 大模型 AI 接口生成
    const { apiKey, baseUrl, modelId } = getAIConfig();
    if (!apiKey || !modelId) {
      return res.status(500).json({ error: 'AI 大模型服务未配置，降级策略已禁用' });
    }

    console.log(`Connecting to Qwen/Backend AI to generate surrounding tour for luckyElement=${luckyElement}, query=${query}...`);
    
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
      response_format: { type: "json_object" },
      max_tokens: 800
    };

    const postProcess = (fullContent: string) => {
      let cleanedContent = fullContent.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const aiResult = JSON.parse(cleanedContent);
      console.log("Successfully generated real AI travel items from Qwen!");
      return {
        success: true,
        source: 'real_qwen_ai',
        aiResult,
        luckyElement,
        city,
        query
      };
    };

    await streamingAIProxy(res, endpoint, payload, apiKey, postProcess);
  } catch (error: any) {
    console.error('Meituan AI generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: `AI周边游契约生成失败: ${error.message || '内部服务异常'}` });
    }
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
      temperature: 0.7,
      max_tokens: 1000
    };

    const postProcess = (fullContent: string) => {
      const reply = fullContent || '时空结界微弱，祭司未能完全接收您的脑波，请重新感应。';
      return { success: true, reply };
    };

    await streamingAIProxy(res, endpoint, payload, apiKey, postProcess);
  } catch (error: any) {
    console.error('Chat API handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || '内部服务异常' });
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

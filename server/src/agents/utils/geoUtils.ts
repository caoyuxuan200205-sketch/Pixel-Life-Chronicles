// 地理坐标计算库
const HANGZHOU_POI_COORDS: Record<string, [number, number]> = {
  "杭州植物园": [120.116, 30.254],
  "杭州植物园·苏堤春晓段": [120.116, 30.254],
  "苏堤": [120.134, 30.242],
  "西湖": [120.148, 30.246],
  "西湖风景名胜区": [120.148, 30.246],
  "浅草·轻食": [120.138, 30.260],
  "浅草·轻食料理 (北山街店)": [120.138, 30.260],
  "湖滨银泰": [120.160, 30.253],
  "湖滨银泰 in77 E 区·室内儿童乐园": [120.160, 30.253],
  "雷峰塔": [120.142, 30.219],
  "灵隐寺": [120.096, 30.241],
  "断桥": [120.149, 30.262],
  "西溪湿地": [120.063, 30.272],
  "清河坊": [120.165, 30.240]
};

// 确定性 Hash Fallback
export function getCoordinates(placeName: string): [number, number] {
  const cleanName = placeName.trim();
  for (const key of Object.keys(HANGZHOU_POI_COORDS)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return HANGZHOU_POI_COORDS[key];
    }
  }
  // 杭州市中心 [120.15, 30.25] 确定性抖动
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const latOffset = ((Math.abs(hash) % 100) / 1000) - 0.05; // -0.05 ~ +0.05
  const lngOffset = (((Math.abs(hash) >> 8) % 100) / 1000) - 0.05;
  return [120.15 + lngOffset, 30.25 + latOffset];
}

// 计算球面距离 (米)
export function getHaversineDistance(c1: [number, number], c2: [number, number]): number {
  const R = 6371000;
  const lat1 = c1[1] * Math.PI / 180;
  const lat2 = c2[1] * Math.PI / 180;
  const dLat = (c2[1] - c1[1]) * Math.PI / 180;
  const dLng = (c2[0] - c1[0]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 通行方式与时间估算 (分钟)
export function estimateTravel(c1: [number, number], c2: [number, number]): {
  distanceMeters: number;
  durationMinutes: number;
  mode: "walking" | "driving";
  modeZh: string;
} {
  const dist = getHaversineDistance(c1, c2);
  if (dist <= 1500) {
    // 步行: 75米 / 分钟
    const mins = Math.max(3, Math.ceil(dist / 75));
    return { distanceMeters: Math.round(dist), durationMinutes: mins, mode: "walking", modeZh: "步行" };
  } else {
    // 驱车/打车: 500米 / 分钟 + 3分钟等车/红绿灯 Buffer
    const mins = Math.max(5, Math.ceil(dist / 500) + 3);
    return { distanceMeters: Math.round(dist), durationMinutes: mins, mode: "driving", modeZh: "载具/打车" };
  }
}

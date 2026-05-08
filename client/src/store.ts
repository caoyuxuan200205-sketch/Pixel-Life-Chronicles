// ============================================
// Pixel Life Chronicles - Shared App Store
// ============================================

export interface User {
  id: string;
  username: string;
  level: number;
  exp: number;
}

export interface POIData {
  id: string;
  name: string;
  type: string;
  rating: number;
  reviews: number;
  tags: string[];
  distance: number;       // meters
  direction: string;      // 方位
  location: [number, number]; // [lng, lat]
  openHours: string;
  coupon?: string;
}

export interface BeadPattern {
  grid: number[][]; // 颜色索引网格
  palette: string[]; // 调色盘（Hex颜色列表）
}

export interface StampRecord {
  id: string;
  poiName: string;
  poiType: string;
  pixelImageData: string;   // 像素化后的图片 DataURL
  beadPattern: BeadPattern; // 拼豆图纸数据
  createdAt: string;
  cardName: string;
  reading: string;
}

export interface ReadingResult {
  card: TarotCard;
  poi: POIData;
  reading: string;
  drawnAt: string;
}

export interface TarotCard {
  id: number;
  name: string;
  emoji: string;
  meaning: string;
}

// ==========================================
// 塔罗牌组
// ==========================================
export const TAROT_CARDS: TarotCard[] = [
  { id: 0, name: '愚者', emoji: '🃏', meaning: '勇敢地踏入未知' },
  { id: 1, name: '魔法师', emoji: '🔮', meaning: '万物皆为你所用' },
  { id: 2, name: '女祭司', emoji: '🌙', meaning: '倾听内心的低语' },
  { id: 3, name: '星星', emoji: '⭐', meaning: '希望如约而至' },
  { id: 4, name: '月亮', emoji: '🌕', meaning: '迷雾中自有光芒' },
  { id: 5, name: '太阳', emoji: '☀️', meaning: '热烈地拥抱世界' },
  { id: 6, name: '命运之轮', emoji: '🎡', meaning: '一切自有安排' },
  { id: 7, name: '隐者', emoji: '🏔️', meaning: '独处是最好的答案' },
  { id: 8, name: '力量', emoji: '🦁', meaning: '温柔即是力量' },
  { id: 9, name: '世界', emoji: '🌍', meaning: '完整在于接受' },
];

// ==========================================
// 模拟 POI 数据库 (美团冷门高质量商户)
// ==========================================
export const POI_DATABASE: POIData[] = [
  {
    id: 'poi_001',
    name: '无名咖啡实验室',
    type: '独立咖啡馆',
    rating: 4.9,
    reviews: 127,
    tags: ['手冲', '安静', '独立咖啡馆'],
    distance: 3200,
    direction: '西南方',
    location: [116.385, 39.915],
    openHours: '10:00-22:00',
    coupon: '满50减8',
  },
  {
    id: 'poi_002',
    name: '旧时光书局',
    type: '旧书店',
    rating: 4.8,
    reviews: 248,
    tags: ['二手书', '文艺', '旧书店'],
    distance: 4500,
    direction: '东北方',
    location: [116.420, 39.930],
    openHours: '09:00-21:00',
  },
  {
    id: 'poi_003',
    name: '街角猫咖·秘境',
    type: '猫咖',
    rating: 4.7,
    reviews: 356,
    tags: ['撸猫', '甜品', '猫咖'],
    distance: 1800,
    direction: '正南方',
    location: [116.397, 39.900],
    openHours: '11:00-23:00',
    coupon: '首单立减15',
  },
  {
    id: 'poi_004',
    name: '野地植物园',
    type: '公园绿地',
    rating: 4.6,
    reviews: 89,
    tags: ['户外', '散步', '公园绿地'],
    distance: 2800,
    direction: '西北方',
    location: [116.378, 39.925],
    openHours: '06:00-20:00',
  },
  {
    id: 'poi_005',
    name: '陶瓦手作工坊',
    type: '手作体验',
    rating: 4.9,
    reviews: 64,
    tags: ['陶艺', '手工', '文创'],
    distance: 3500,
    direction: '东南方',
    location: [116.415, 39.895],
    openHours: '10:00-20:00',
    coupon: '体验课减30',
  },
  {
    id: 'poi_006',
    name: '深巷黑胶唱片店',
    type: '唱片店',
    rating: 4.8,
    reviews: 42,
    tags: ['黑胶', '音乐', '复古'],
    distance: 4100,
    direction: '正东方',
    location: [116.430, 39.910],
    openHours: '13:00-22:00',
  },
];

// ==========================================
// 玄学文案生成器
// ==========================================
const READING_TEMPLATES = [
  (poi: POIData, card: TarotCard) =>
    `【${card.name}】牌面暗示——你本周灵气损耗严重。${poi.direction} ${(poi.distance / 1000).toFixed(1)} 公里处隐藏着一个结界，那里有"${poi.tags[0]}"的能量场。去喝一杯黑色的魔药，找回平静。`,
  (poi: POIData, card: TarotCard) =>
    `【${card.name}】的指引——命运之线在${poi.direction}交汇。${(poi.distance / 1000).toFixed(1)} 公里外有一个被城市遗忘的角落——"${poi.type}"。${card.meaning}。这是今天宇宙为你准备的疗愈空间。`,
  (poi: POIData, card: TarotCard) =>
    `【${card.name}】翻开的瞬间，第六感在${poi.direction}方向共振。距你 ${(poi.distance / 1000).toFixed(1)} 公里，一个名为"${poi.tags[0]}"的秘密结界正在召唤你。放弃计划，跟随直觉。`,
  (poi: POIData, card: TarotCard) =>
    `你抽中了【${card.name}】——${card.meaning}。星象在${poi.direction} ${(poi.distance / 1000).toFixed(1)} 公里处标记了一个温柔的坐标，那里藏着"${poi.type}"的秘密。今天的你值得被这个城市善待。`,
  (poi: POIData, card: TarotCard) =>
    `【${card.name}】揭示了一条被遗忘的路径。在${poi.direction} ${(poi.distance / 1000).toFixed(1)} 公里处，有个地方正散发着"${poi.tags[0]}"的微光。宇宙说——别做攻略了，命运自有安排。`,
];

export function generateReading(poi: POIData, card: TarotCard): string {
  const template = READING_TEMPLATES[Math.floor(Math.random() * READING_TEMPLATES.length)];
  return template(poi, card);
}

// ==========================================
// LocalStorage helpers
// ==========================================
const STORAGE_KEYS = {
  CURRENT_READING: 'plc_current_reading',
  STAMPS: 'plc_stamps',
  DRAW_COUNT: 'plc_draw_count',
  LAST_DRAW_WEEK: 'plc_last_draw_week',
  CURRENT_USER: 'plc_current_user',
  USERS_DB: 'plc_users_db',
} as const;

function getWeekId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  const weekNum = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${weekNum}`;
}

export function saveReading(result: ReadingResult): void {
  localStorage.setItem(STORAGE_KEYS.CURRENT_READING, JSON.stringify(result));
  const weekId = getWeekId();
  const lastWeek = localStorage.getItem(STORAGE_KEYS.LAST_DRAW_WEEK);
  let count = 0;
  if (lastWeek === weekId) {
    count = parseInt(localStorage.getItem(STORAGE_KEYS.DRAW_COUNT) || '0');
  }
  localStorage.setItem(STORAGE_KEYS.DRAW_COUNT, String(count + 1));
  localStorage.setItem(STORAGE_KEYS.LAST_DRAW_WEEK, weekId);
}

export function getCurrentReading(): ReadingResult | null {
  const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_READING);
  return raw ? JSON.parse(raw) : null;
}

export function getDrawCount(): number {
  const weekId = getWeekId();
  const lastWeek = localStorage.getItem(STORAGE_KEYS.LAST_DRAW_WEEK);
  if (lastWeek !== weekId) return 0;
  return parseInt(localStorage.getItem(STORAGE_KEYS.DRAW_COUNT) || '0');
}

export function canDraw(): boolean {
  return getDrawCount() < 2; // 每周最多2次
}

export function resetForDemo(): void {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_READING);
  localStorage.removeItem(STORAGE_KEYS.DRAW_COUNT);
  localStorage.removeItem(STORAGE_KEYS.LAST_DRAW_WEEK);
}

export function saveStamp(stamp: StampRecord): void {
  const stamps = getStamps();
  stamps.push(stamp);
  localStorage.setItem(STORAGE_KEYS.STAMPS, JSON.stringify(stamps));
}

export function getStamps(): StampRecord[] {
  const raw = localStorage.getItem(STORAGE_KEYS.STAMPS);
  return raw ? JSON.parse(raw) : [];
}

export function clearStamps(): void {
  localStorage.removeItem(STORAGE_KEYS.STAMPS);
}

// ==========================================
// Auth helpers
// ==========================================
export function getCurrentUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return raw ? JSON.parse(raw) : null;
}

export function login(username: string): User | null {
  const rawDb = localStorage.getItem(STORAGE_KEYS.USERS_DB);
  const users: User[] = rawDb ? JSON.parse(rawDb) : [];
  
  const user = users.find(u => u.username === username);
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    return user;
  }
  return null;
}

export function register(username: string): User | null {
  const rawDb = localStorage.getItem(STORAGE_KEYS.USERS_DB);
  const users: User[] = rawDb ? JSON.parse(rawDb) : [];
  
  if (users.find(u => u.username === username)) {
    return null; // Username exists
  }

  const newUser: User = {
    id: `user_${Date.now()}`,
    username,
    level: 1,
    exp: 0,
  };
  
  users.push(newUser);
  localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
  return newUser;
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}

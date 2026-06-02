// ============================================
// Pixel Life Chronicles - Shared App Store
// ============================================

export interface User {
  id: string;
  username: string;
  email?: string;
  level: number;
  exp: number;
  divinationPreference?: 'tarot' | 'bazi';
  baziInfo?: {
    birthDate: string;
    birthTime: string;
    birthPlace: string;
  };
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
  address?: string;
}

export interface BeadPattern {
  grid: number[][]; // 颜色索引网格
  palette: string[]; // 调色盘（Hex颜色列表）
  codes?: string[];  // 对应色号 (如 A1, B15)
  names?: string[];  // 对应颜色名称
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

export interface GroupMember {
  id: string;
  name: string;
  divinationMethod: 'tarot' | 'bazi';
  mood?: string;
  tarotCardIndex?: number;
  baziInfo?: {
    birthDate: string;
    birthTime: string;
    birthPlace: string;
    queryType: 'travel' | 'fortune' | 'relation' | 'work';
  };
}

export interface ActivityEvent {
  id: string;
  poi: POIData;
  timeSlot: string;
  activityName: string;
  mysticReasoning: string;
  bookingStatus?: {
    type: 'didi' | 'coupon' | 'ticket' | 'none';
    name: string;
    status: 'pending' | 'success' | 'failed';
    detail?: string;
  };
}

export interface JointPlanResult {
  id: string;
  members: GroupMember[];
  timeBudget: number;
  divinationSynthesis: string;
  itinerary: ActivityEvent[];
  individualReadings: {
    memberId: string;
    readingText: string;
    tarotCard?: TarotCard;
    baziChart?: {
      fourPillars: string[];
      elements: { name: string; value: number; color: string }[];
      mainElement: string;
      luckyElement: string;
    };
  }[];
  createdAt: string;
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
  { id: 0, name: 'The Magician', emoji: '🪄', meaning: 'Skill, diplomacy, address, subtlety' },
  { id: 1, name: 'The High Priestess', emoji: '🌙', meaning: 'Secrets, mystery, the future as yet unrevealed' },
  { id: 2, name: 'The Empress', emoji: '👑', meaning: 'Fruitfulness, action, initiative, length of days' },
  { id: 3, name: 'The Emperor', emoji: '🏛️', meaning: 'Stability, power, protection, realization' },
  { id: 4, name: 'The Hierophant', emoji: '📜', meaning: 'Marriage, alliance, captivity, servitude' },
  { id: 5, name: 'The Lovers', emoji: '❤️', meaning: 'Attraction, love, beauty, trials overcome.' },
  { id: 6, name: 'The Chariot', emoji: '🏎️', meaning: 'Succour, providence also war, triumph, presumption, vengeance, trouble.' },
  { id: 7, name: 'Fortitude', emoji: '🦁', meaning: 'Power, energy, action, courage, magnanimity' },
  { id: 8, name: 'The Hermit', emoji: '🏔️', meaning: 'Prudence, circumspection' },
  { id: 9, name: 'Wheel Of Fortune', emoji: '🎡', meaning: 'Destiny, fortune, success, elevation, luck, felicity.' },
  { id: 10, name: 'Justice', emoji: '⚖️', meaning: 'Equity, rightness, probity, executive' },
  { id: 11, name: 'The Hanged Man', emoji: '🙃', meaning: 'Wisdom, circumspection, discernment, trials, sacrifice, intuition, divination, prophecy.' },
  { id: 12, name: 'Death', emoji: '💀', meaning: 'End, mortality, destruction, corruption also, for a man, the loss of a benefactor for a woman, many contrarieties' },
  { id: 13, name: 'Temperance', emoji: '🍶', meaning: 'Economy, moderation, frugality, management, accommodation.' },
  { id: 14, name: 'The Devil', emoji: '😈', meaning: 'Ravage, violence, vehemence, extraordinary efforts, force, fatality' },
  { id: 15, name: 'The Tower', emoji: '💥', meaning: 'Misery, distress, indigence, adversity, calamity, disgrace, deception, ruin. It is a card in particular of unforeseen catastrophe.' },
  { id: 16, name: 'The Star', emoji: '⭐', meaning: 'Loss, theft, privation, abandonment' },
  { id: 17, name: 'The Moon', emoji: '🌕', meaning: 'Hidden enemies, danger, calumny, darkness, terror, deception, occult forces, error.' },
  { id: 18, name: 'The Sun', emoji: '☀️', meaning: 'Material happiness, fortunate marriage, contentment.' },
  { id: 19, name: 'The Last Judgment', emoji: '🎺', meaning: 'Change of position, renewal, outcome. Another account specifies total loss though lawsuit.' },
  { id: 20, name: 'The Fool', emoji: '🃏', meaning: 'Folly, mania, extravagance, intoxication, delirium, frenzy, bewrayment.' },
  { id: 21, name: 'The World', emoji: '🌍', meaning: 'Assured success, recompense, voyage, route, emigration, flight, change of place.' },
  { id: 22, name: 'Page of Wands', emoji: '🪄', meaning: 'Dark young man, faithful, a lover, an envoy, a postman. Beside a man, he will bear favourable testimony concerning him. A dangerous rival, if followed by the Page of Cups. Has the chief qualities of his suit. He may signify family intelligence.' },
  { id: 23, name: 'Knight of Wands', emoji: '🪄', meaning: 'Departure, absence, flight, emigration. A dark young man, friendly. Change of residence.' },
  { id: 24, name: 'Queen of Wands', emoji: '🪄', meaning: 'A dark woman, countrywoman, friendly, chaste, loving, honourable. If the card beside her signifies a man, she is well disposed towards him' },
  { id: 25, name: 'King of Wands', emoji: '🪄', meaning: 'Dark man, friendly, countryman, generally married, honest and conscientious. The card always signifies honesty, and may mean news concerning an unexpected heritage to fall in before very long.' },
  { id: 26, name: 'Ace of Wands', emoji: '🪄', meaning: 'Creation, invention, enterprise, the powers which result in these' },
  { id: 27, name: 'Two of Wands', emoji: '🪄', meaning: 'Between the alternative readings there is no marriage possible' },
  { id: 28, name: 'Three of Wands', emoji: '🪄', meaning: 'He symbolizes established strength, enterprise, effort, trade, commerce, discovery' },
  { id: 29, name: 'Four of Wands', emoji: '🪄', meaning: 'They are for once almost on the surface--country life, haven of refuge, a species of domestic harvest-home, repose, concord, harmony, prosperity, peace, and the perfected work of these.' },
  { id: 30, name: 'Five of Wands', emoji: '🪄', meaning: 'Imitation, as, for example, sham fight, but also the strenuous competition and struggle of the search after riches and fortune. In this sense it connects with the battle of life. Hence some attributions say that it is a card of gold, gain, opulence.' },
  { id: 31, name: 'Six of Wands', emoji: '🪄', meaning: 'The card has been so designed that it can cover several significations' },
  { id: 32, name: 'Seven of Wands', emoji: '🪄', meaning: 'It is a card of valour, for, on the surface, six are attacking one, who has, however, the vantage position. On the intellectual plane, it signifies discussion, wordy strife' },
  { id: 33, name: 'Eight of Wands', emoji: '🪄', meaning: 'Activity in undertakings, the path of such activity, swiftness, as that of an express messenger' },
  { id: 34, name: 'Nine of Wands', emoji: '🪄', meaning: 'The card signifies strength in opposition. If attacked, the person will meet an onslaught boldly' },
  { id: 35, name: 'Ten of Wands', emoji: '🪄', meaning: 'A card of many significances, and some of the readings cannot be harmonized. I set aside that which connects it with honour and good faith. The chief meaning is oppression simply, but it is also fortune, gain, any kind of success, and then it is the oppression of these things. It is also a card of false-seeming, disguise, perfidy. The place which the figure is approaching may suffer from the rods that he carries. Success is stultified if the Nine of Swords follows, and if it is a question of a lawsuit, there will be certain loss.' },
  { id: 36, name: 'Page of Cups', emoji: '🏆', meaning: 'Fair young man, one impelled to render service and with whom the Querent will be connected' },
  { id: 37, name: 'Knight of Cups', emoji: '🏆', meaning: 'Arrival, approach--sometimes that of a messenger' },
  { id: 38, name: 'Queen of Cups', emoji: '🏆', meaning: 'Good, fair woman' },
  { id: 39, name: 'King of Cups', emoji: '🏆', meaning: 'Fair man, man of business, law, or divinity' },
  { id: 40, name: 'Ace of Cups', emoji: '🏆', meaning: 'House of the true heart, joy, content, abode, nourishment, abundance, fertility' },
  { id: 41, name: 'Two of Cups', emoji: '🏆', meaning: 'Love, passion, friendship, affinity, union, concord, sympathy, the interrelation of the sexes, and--as a suggestion apart from all offices of divination--that desire which is not in Nature, but by which Nature is sanctified.' },
  { id: 42, name: 'Three of Cups', emoji: '🏆', meaning: 'The conclusion of any matter in plenty, perfection and merriment' },
  { id: 43, name: 'Four of Cups', emoji: '🏆', meaning: 'Weariness, disgust, aversion, imaginary vexations, as if the wine of this world had caused satiety only' },
  { id: 44, name: 'Five of Cups', emoji: '🏆', meaning: 'A dark, cloaked figure, looking sideways at three prone cups two others stand upright behind him' },
  { id: 45, name: 'Six of Cups', emoji: '🏆', meaning: 'A card of the past and of memories, looking back, as--for example--on childhood' },
  { id: 46, name: 'Seven of Cups', emoji: '🏆', meaning: 'Fairy favours, images of reflection, sentiment, imagination, things seen in the glass of contemplation' },
  { id: 47, name: 'Eight of Cups', emoji: '🏆', meaning: 'The card speaks for itself on the surface, but other readings are entirely antithetical--giving joy, mildness, timidity, honour, modesty. In practice, it is usually found that the card shews the decline of a matter, or that a matter which has been thought to be important is really of slight consequence--either for good or evil.' },
  { id: 48, name: 'Nine of Cups', emoji: '🏆', meaning: 'Concord, contentment, physical bien-être' },
  { id: 49, name: 'Ten of Cups', emoji: '🏆', meaning: 'Contentment, repose of the entire heart' },
  { id: 50, name: 'Page of Pentacles', emoji: '🪙', meaning: 'Application, study, scholarship, reflection another reading says news, messages and the bringer thereof' },
  { id: 51, name: 'Knight of Pentacles', emoji: '🪙', meaning: 'Utility, serviceableness, interest, responsibility, rectitude-all on the normal and external plane.' },
  { id: 52, name: 'Queen of Pentacles', emoji: '🪙', meaning: 'Opulence, generosity, magnificence, security, liberty.' },
  { id: 53, name: 'King of Pentacles', emoji: '🪙', meaning: 'Valour, realizing intelligence, business and normal intellectual aptitude, sometimes mathematical gifts and attainments of this kind' },
  { id: 54, name: 'Ace of Pentacles', emoji: '🪙', meaning: 'Perfect contentment, felicity, ecstasy' },
  { id: 55, name: 'Two of Pentacles', emoji: '🪙', meaning: 'On the one hand it is represented as a card of gaiety, recreation and its connexions, which is the subject of the design' },
  { id: 56, name: 'Three of Pentacles', emoji: '🪙', meaning: 'Métier, trade, skilled labour' },
  { id: 57, name: 'Four of Pentacles', emoji: '🪙', meaning: 'The surety of possessions, cleaving to that which one has, gift, legacy, inheritance.' },
  { id: 58, name: 'Five of Pentacles', emoji: '🪙', meaning: 'The card foretells material trouble above all, whether in the form illustrated--that is, destitution--or otherwise. For some cartomancists, it is a card of love and lovers-wife, husband, friend, mistress' },
  { id: 59, name: 'Six of Pentacles', emoji: '🪙', meaning: 'Presents, gifts, gratification another account says attention, vigilance now is the accepted time, present prosperity, etc.' },
  { id: 60, name: 'Seven of Pentacles', emoji: '🪙', meaning: 'These are exceedingly contradictory' },
  { id: 61, name: 'Eight of Pentacles', emoji: '🪙', meaning: 'Work, employment, commission, craftsmanship, skill in craft and business, perhaps in the preparatory stage.' },
  { id: 62, name: 'Nine of Pentacles', emoji: '🪙', meaning: 'Prudence, safety, success, accomplishment, certitude, discernment.' },
  { id: 63, name: 'Ten of Pentacles', emoji: '🪙', meaning: 'Gain, riches' },
  { id: 64, name: 'Page of Swords', emoji: '⚔️', meaning: 'Authority, overseeing, secret service, vigilance, spying, examination, and the qualities thereto belonging.' },
  { id: 65, name: 'Knight of Swords', emoji: '⚔️', meaning: 'Skill, bravery, capacity, defence, address, enmity, wrath, war, destruction, opposition, resistance, ruin. There is therefore a sense in which the card signifies death, but it carries this meaning only in its proximity to other cards of fatality.' },
  { id: 66, name: 'Queen of Swords', emoji: '⚔️', meaning: 'Widowhood, female sadness and embarrassment, absence, sterility, mourning, privation, separation.' },
  { id: 67, name: 'King of Swords', emoji: '⚔️', meaning: 'Whatsoever arises out of the idea of judgment and all its connexions-power, command, authority, militant intelligence, law, offices of the crown, and so forth.' },
  { id: 68, name: 'Ace of Swords', emoji: '⚔️', meaning: 'Triumph, the excessive degree in everything, conquest, triumph of force. It is a card of great force, in love as well as in hatred. The crown may carry a much higher significance than comes usually within the sphere of fortune-telling.' },
  { id: 69, name: 'Two of Swords', emoji: '⚔️', meaning: 'Conformity and the equipoise which it suggests, courage, friendship, concord in a state of arms' },
  { id: 70, name: 'Three of Swords', emoji: '⚔️', meaning: 'Removal, absence, delay, division, rupture, dispersion, and all that the design signifies naturally, being too simple and obvious to call for specific enumeration.' },
  { id: 71, name: 'Four of Swords', emoji: '⚔️', meaning: 'Vigilance, retreat, solitude, hermit\'s repose, exile, tomb and coffin. It is these last that have suggested the design.' },
  { id: 72, name: 'Five of Swords', emoji: '⚔️', meaning: 'Degradation, destruction, revocation, infamy, dishonour, loss, with the variants and analogues of these.' },
  { id: 73, name: 'Six of Swords', emoji: '⚔️', meaning: 'Journey by water, route, way, envoy, commissionary, expedient.' },
  { id: 74, name: 'Seven of Swords', emoji: '⚔️', meaning: 'Design, attempt, wish, hope, confidence' },
  { id: 75, name: 'Eight of Swords', emoji: '⚔️', meaning: 'Bad news, violent chagrin, crisis, censure, power in trammels, conflict, calumny' },
  { id: 76, name: 'Nine of Swords', emoji: '⚔️', meaning: 'Death, failure, miscarriage, delay, deception, disappointment, despair.' },
  { id: 77, name: 'Ten of Swords', emoji: '⚔️', meaning: 'Whatsoever is intimated by the design' },
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
  ROUTE_CACHE: 'plc_route_cache',
  JOINT_PLAN: 'plc_joint_plan',
} as const;

export interface CachedRoute {
  distance: string;
  duration: string;
  path: [number, number][];
}

export function saveRouteCache(cache: CachedRoute): void {
  localStorage.setItem(STORAGE_KEYS.ROUTE_CACHE, JSON.stringify(cache));
}

export function getRouteCache(): CachedRoute | null {
  const raw = localStorage.getItem(STORAGE_KEYS.ROUTE_CACHE);
  return raw ? JSON.parse(raw) : null;
}

export function clearRouteCache(): void {
  localStorage.removeItem(STORAGE_KEYS.ROUTE_CACHE);
}

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
// Joint Plan helpers
// ==========================================
export function saveJointPlan(plan: JointPlanResult): void {
  localStorage.setItem(STORAGE_KEYS.JOINT_PLAN, JSON.stringify(plan));
}

export function getLatestJointPlan(): JointPlanResult | null {
  const raw = localStorage.getItem(STORAGE_KEYS.JOINT_PLAN);
  return raw ? JSON.parse(raw) : null;
}

export function clearJointPlans(): void {
  localStorage.removeItem(STORAGE_KEYS.JOINT_PLAN);
}

// ==========================================
// Bound Members & Relationships
// ==========================================
export interface BoundMember {
  id: string;
  name: string;
  divinationMethod: 'tarot' | 'bazi';
  relationTag: 'family' | 'friend' | 'partner' | 'other';
  mood?: string;
  baziInfo?: {
    birthDate: string;
    birthTime: string;
    birthPlace: string;
    queryType: string;
  };
}

export function getBoundMembers(): BoundMember[] {
  const raw = localStorage.getItem('plc_bound_members');
  if (!raw) {
    // 默认注入 2 个有趣的家人与伴侣，作为极佳的冷启动体验
    const defaultMembers: BoundMember[] = [
      {
        id: 'bound_family_1',
        name: '大雷 (爸爸)',
        divinationMethod: 'bazi',
        relationTag: 'family',
        baziInfo: {
          birthDate: '1970-05-10',
          birthTime: '08:30',
          birthPlace: '杭州',
          queryType: 'fortune'
        }
      },
      {
        id: 'bound_partner_1',
        name: '小花 (伴侣)',
        divinationMethod: 'tarot',
        relationTag: 'partner',
        mood: 'tired'
      }
    ];
    localStorage.setItem('plc_bound_members', JSON.stringify(defaultMembers));
    return defaultMembers;
  }
  return JSON.parse(raw);
}

export function saveBoundMembers(members: BoundMember[]): void {
  localStorage.setItem('plc_bound_members', JSON.stringify(members));
}

export function saveCurrentUser(user: User): void {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
}

// ==========================================
// Auth helpers
// ==========================================
export function getCurrentUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return raw ? JSON.parse(raw) : null;
}

export function login(
  username: string, 
  userId?: string, 
  email?: string,
  divinationPreference?: 'tarot' | 'bazi',
  baziInfo?: { birthDate: string; birthTime: string; birthPlace: string }
): User | null {
  try {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return null;

    const user: User = {
      id: userId || `user_${Date.now()}`,
      username: trimmedUsername,
      email: email,
      level: 1,
      exp: 0,
      divinationPreference,
      baziInfo
    };
    
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    return user;
  } catch (e) {
    console.error('Login error:', e);
  }
  return null;
}

export function register(
  username: string, 
  userId?: string, 
  email?: string,
  divinationPreference?: 'tarot' | 'bazi',
  baziInfo?: { birthDate: string; birthTime: string; birthPlace: string }
): User | null {
  try {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return null;

    const newUser: User = {
      id: userId || `user_${Date.now()}`,
      username: trimmedUsername,
      email: email,
      level: 1,
      exp: 0,
      divinationPreference,
      baziInfo
    };
    
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
    return newUser;
  } catch (e) {
    console.error('Register error:', e);
  }
  return null;
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}


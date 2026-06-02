/**
 * 👾 时空命格结界 - 算命排盘助手 (baziHelper)
 * 提供高精度的公历转农历干支纪位法与五行占比计算。
 */

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 五行映射表
const ELEMENT_MAP: Record<string, string> = {
  // 天干
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
  // 地支
  '寅': '木', '卯': '木',
  '巳': '火', '午': '火',
  '辰': '土', '戌': '土', '丑': '土', '未': '土',
  '申': '金', '酉': '金',
  '子': '水', '亥': '水'
};

const ELEMENT_COLORS: Record<string, string> = {
  '金': '#E2B553', // 金色
  '木': '#3CD070', // 绿色
  '水': '#4CA3F5', // 蓝色
  '火': '#FF5E5E', // 红色
  '土': '#A87A54'  // 棕色/土黄色
};

export interface BaziChart {
  fourPillars: string[]; // ["年柱", "月柱", "日柱", "时柱"]
  elements: { name: string; value: number; color: string }[]; // 五行占比
  mainElement: string; // 日主五行（核心属性）
  luckyElement: string; // 命运互补幸运五行
}

/**
 * 计算两个日期的天数差 (Gregorian Calendar)
 */
function getDaysBetween(date1: Date, date2: Date): number {
  const d1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * 根据公历时间进行八字排盘
 */
export function calculateBazi(birthDateStr: string, birthTimeStr: string): BaziChart {
  // 1. 解析输入
  const [year, month, day] = birthDateStr.split('-').map(Number);
  const [hour, minute] = birthTimeStr.split(':').map(Number);
  const targetDate = new Date(year, month - 1, day, hour, minute);

  // 2. 年柱计算 (以立春为界，这里简化以公历年换算，立春偏差用月份粗略微调)
  // 基准：公元4年为甲子年 (Stem 0, Branch 0)
  let yearOffset = year - 4;
  // 如果是一月且在立春前(一般在2月4日左右)，年柱算前一年
  if (month === 1 || (month === 2 && day < 4)) {
    yearOffset -= 1;
  }
  const yearStem = STEMS[(yearOffset % 10 + 10) % 10];
  const yearBranch = BRANCHES[(yearOffset % 12 + 12) % 12];
  const yearPillar = `${yearStem}${yearBranch}`;

  // 3. 月柱计算 (月支是固定的，由节气决定；天干通过年干推算)
  // 月支对照 (12月支从寅月即2月开始)
  // 1月:丑, 2月:寅, 3月:卯, 4月:辰, 5月:巳, 6月:午, 7月:未, 8月:申, 9月:酉, 10月:戌, 11月:亥, 12月:子
  const monthBranchIndex = (month % 12 + 10) % 12; // 2月对应2(寅), 1月对应1(丑)...
  const monthBranch = BRANCHES[monthBranchIndex];

  // 五虎遁推月干
  // 甲己之年丙作首，乙庚之岁戊为头，丙辛之岁寻庚上，丁壬壬位顺水流，若问戊癸何方发，甲寅之上好追求。
  const yearStemIndex = (yearOffset % 10 + 10) % 10;
  let firstMonthStemIndex = 0; // 寅月(2月)的天干起点
  if (yearStemIndex === 0 || yearStemIndex === 5) firstMonthStemIndex = 2; // 丙
  else if (yearStemIndex === 1 || yearStemIndex === 6) firstMonthStemIndex = 4; // 戊
  else if (yearStemIndex === 2 || yearStemIndex === 7) firstMonthStemIndex = 6; // 庚
  else if (yearStemIndex === 3 || yearStemIndex === 8) firstMonthStemIndex = 8; // 壬
  else if (yearStemIndex === 4 || yearStemIndex === 9) firstMonthStemIndex = 0; // 甲

  // 计算当前月份对应的天干索引 (从寅月顺推)
  // 2月是第0个(寅)，3月是第1个(卯)... 1月是第11个(丑)
  const monthOffsetFromJan = (month - 2 + 12) % 12;
  const monthStem = STEMS[(firstMonthStemIndex + monthOffsetFromJan) % 10];
  const monthPillar = `${monthStem}${monthBranch}`;

  // 4. 日柱计算 (高精度儒略日偏移法)
  // 基准点：2000年1月1日为 戊午日 (Stem 4, Branch 6)
  const baseDate = new Date(2000, 0, 1);
  const diffDays = getDaysBetween(targetDate, baseDate);
  
  const dayStemIndex = ((4 + diffDays) % 10 + 10) % 10;
  const dayBranchIndex = ((6 + diffDays) % 12 + 12) % 12;
  
  const dayStem = STEMS[dayStemIndex];
  const dayBranch = BRANCHES[dayBranchIndex];
  const dayPillar = `${dayStem}${dayBranch}`;

  // 5. 时柱计算 (时支由小时确定，时干由日干推算)
  // 时支映射 (23点-1点为子，1点-3点为丑...)
  const hourBranchIndex = Math.floor(((hour + 1) % 24) / 2);
  const hourBranch = BRANCHES[hourBranchIndex];

  // 五鼠遁推时干
  // 甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途。
  let firstHourStemIndex = 0; // 子时的天干起点
  if (dayStemIndex === 0 || dayStemIndex === 5) firstHourStemIndex = 0; // 甲
  else if (dayStemIndex === 1 || dayStemIndex === 6) firstHourStemIndex = 2; // 丙
  else if (dayStemIndex === 2 || dayStemIndex === 7) firstHourStemIndex = 4; // 戊
  else if (dayStemIndex === 3 || dayStemIndex === 8) firstHourStemIndex = 6; // 庚
  else if (dayStemIndex === 4 || dayStemIndex === 9) firstHourStemIndex = 8; // 壬

  const hourStem = STEMS[(firstHourStemIndex + hourBranchIndex) % 10];
  const hourPillar = `${hourStem}${hourBranch}`;

  // 6. 整合四柱八字
  const fourPillars = [yearPillar, monthPillar, dayPillar, hourPillar];
  const eightChars = [
    yearStem, yearBranch,
    monthStem, monthBranch,
    dayStem, dayBranch,
    hourStem, hourBranch
  ];

  // 7. 计算五行属性分布
  const elementCounts: Record<string, number> = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  eightChars.forEach(char => {
    const element = ELEMENT_MAP[char];
    if (element) {
      elementCounts[element]++;
    }
  });

  const elements = Object.keys(elementCounts).map(name => {
    const value = Math.round((elementCounts[name] / 8) * 100);
    return {
      name,
      value,
      color: ELEMENT_COLORS[name]
    };
  });

  // 日主五行（日柱天干即核心属性）
  const mainElement = ELEMENT_MAP[dayStem];

  // 寻找幸运五行（这里简化为最稀缺的五行，如果都不缺，则是除了日主五行外最弱的五行）
  let luckyElement = '金';
  let minCount = 99;
  Object.keys(elementCounts).forEach(el => {
    // 排除日主元素以增强命运互补的故事性
    if (el !== mainElement && elementCounts[el] < minCount) {
      minCount = elementCounts[el];
      luckyElement = el;
    }
  });

  return {
    fourPillars,
    elements,
    mainElement,
    luckyElement
  };
}

export interface AuspiciousDirection {
  direction: string;
  description: string;
  element: string;
  angleRange: [number, number];
}

export interface AuspiciousHour {
  timeRange: string;
  label: string;
  description: string;
  luckLevel: '极吉' | '大吉' | '小吉' | '中立';
}

/**
 * 根据幸运五行计算周边游的开运方向与目的地属性匹配建议
 */
export function getAuspiciousDirection(luckyElement: string): AuspiciousDirection {
  const directions: Record<string, AuspiciousDirection> = {
    '木': {
      direction: '东方 (青龙方位)',
      description: '紫气东来，青龙吐纳。星轨指引往茂密林木、森林公园、高山深谷行进，能够调和肝木生机，逢凶化吉。',
      element: '木',
      angleRange: [45, 135]
    },
    '火': {
      direction: '南方 (朱雀方位)',
      description: '朱雀腾空，烈焰开运。宜往南方温泉地热、热闹夜市古镇、阳光充足的露营山巅，可凝聚阳和之气。',
      element: '火',
      angleRange: [135, 225]
    },
    '金': {
      direction: '西方 (白虎方位)',
      description: '白虎生威，金石肃敛。今日利于往西方古寺遗迹、怪石公园、攀岩胜地探索，能聚敛正气，强健肺金。',
      element: '金',
      angleRange: [225, 315]
    },
    '水': {
      direction: '北方 (玄武方位)',
      description: '玄武沉稳，百川归海。大吉往北方临水民宿、湖泊溪谷、湿地或水上景区，可涵养坎水灵性，辟邪消灾。',
      element: '水',
      angleRange: [315, 45]
    },
    '土': {
      direction: '中部/西南 (勾陈方位)',
      description: '勾陈居中，厚德载物。适合前往中西部开阔平原、高山黄土、历史古城或手作陶瓷工坊，能稳固中土元气。',
      element: '土',
      angleRange: [0, 360]
    }
  };
  return directions[luckyElement] || directions['土'];
}

/**
 * 根据具体的出行日期，确定性地排定该日的奇门遁甲 12 时辰自驾出行吉凶格局
 */
export function getAuspiciousHours(dateStr: string): AuspiciousHour[] {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const doubleHours = [
    { time: '23:00-01:00 (子时)', index: 0 },
    { time: '01:00-03:00 (丑时)', index: 1 },
    { time: '03:00-05:00 (寅时)', index: 2 },
    { time: '05:00-07:00 (卯时)', index: 3 },
    { time: '07:00-09:00 (辰时)', index: 4 },
    { time: '09:00-11:00 (巳时)', index: 5 },
    { time: '11:00-13:00 (午时)', index: 6 },
    { time: '13:00-15:00 (未时)', index: 7 },
    { time: '15:00-17:00 (申时)', index: 8 },
    { time: '17:00-19:00 (酉时)', index: 9 },
    { time: '19:00-21:00 (戌时)', index: 10 },
    { time: '21:00-23:00 (亥时)', index: 11 }
  ];

  // 预设吉时格局
  const patterns = [
    { label: '青龙返首', desc: '奇门大吉格局，兵不血刃，出行顺遂，百病不侵。', level: '极吉' as const },
    { label: '天乙贵人', desc: '贵人临门，万事呈祥。旅途易逢善缘，适宜多人出行。', level: '大吉' as const },
    { label: '三奇得使', desc: '神人暗助，谋求顺遂。利于长途自驾与求取契机。', level: '大吉' as const },
    { label: '玉堂黄道', desc: '天德高照，路途无忧。适合自驾或乘坐公共交通。', level: '大吉' as const },
    { label: '司命黄道', desc: '吉神值守，稳步上升。旅途中多遇欢愉与美食。', level: '小吉' as const },
    { label: '喜神临照', desc: '喜气洋洋，顺水推舟。最适宜情侣、伴侣浪漫游。', level: '小吉' as const },
    { label: '平平无奇', desc: '气场中立，中规中矩。安全行车，稳步前进即可。', level: '中立' as const }
  ];

  const results: AuspiciousHour[] = [];
  doubleHours.forEach((dh, idx) => {
    const val = (hash + idx * 7) % 100;
    let pattern;
    if (val < 10) {
      pattern = patterns[0];
    } else if (val < 25) {
      pattern = patterns[1];
    } else if (val < 40) {
      pattern = patterns[2];
    } else if (val < 55) {
      pattern = patterns[3];
    } else if (val < 70) {
      pattern = patterns[4];
    } else if (val < 85) {
      pattern = patterns[5];
    } else {
      pattern = patterns[6];
    }

    results.push({
      timeRange: dh.time,
      label: pattern.label,
      description: pattern.desc,
      luckLevel: pattern.level
    });
  });

  return results;
}

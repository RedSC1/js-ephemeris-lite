import { LUNAR_FESTIVALS, SOLAR_FESTIVALS } from './festival-data.js';

const MODES = new Set(['major', 'common', 'all']);
const LEVEL_PRIORITY = new Map(['statutory', 'traditional', 'popular', 'historical', 'ethnic', 'commemorative'].map((name, index) => [name, index]));
const DISPLAY_PRIORITY = { primary: 0, secondary: 1, detail: 2 };

// sxwnl keeps calendar density separate from a festival's semantic category:
// A is a primary holiday, B is a notable calendar label, and C stays in the
// day's details. These sets preserve that original display policy after names
// are derived from the original Shou Xing table and normalized below.
const PRIMARY_DISPLAY_NAMES = new Set([
  '元旦', '劳动节', '国庆节',
  '春节', '元宵节', '端午节', '中秋节', '除夕', '清明',
]);
const SECONDARY_DISPLAY_NAMES = new Set([
  '世界湿地日', '情人节', '妇女节', '植树节', '消费者权益日', '世界水日', '世界气象日',
  '愚人节', '世界卫生日', '世界地球日', '青年节', '国际护士节', '国际家庭日', '世界无烟日',
  '儿童节', '国际禁毒日', '香港回归纪念日', '中共诞辰', '抗日战争纪念日', '世界人口日',
  '建军节', '抗日战争胜利纪念', '教师节', '九一八事变纪念日', '孔子诞辰',
  '辛亥革命纪念日', '世界艾滋病日', '西安事变纪念日', '南京大屠杀纪念日', '平安夜', '圣诞节',
  '世界麻风日', '全国助残日', '国际和平日', '世界海事日', '国际减轻自然灾害日', '感恩节',
  '大年初二', '上元节', '龙抬头', '春龙节', '北帝诞', '妈祖诞辰', '天后诞', '牛王诞',
  '关帝诞', '姑姑节', '天贶节', '七夕节', '乞巧节', '女儿节', '中元节', '鬼节',
  '重阳节', '祭祖节(十月朝)', '下元节', '腊八节', '北方小年', '南方小年',
]);

function calendarDisplay(name) {
  if (PRIMARY_DISPLAY_NAMES.has(name)) return 'primary';
  if (SECONDARY_DISPLAY_NAMES.has(name)) return 'secondary';
  return 'detail';
}

// The sxwnl table intentionally preserves source-era labels. Normalize only
// names whose modern formal title is unambiguous; the original remains an alias.
const FORMAL_NAMES = new Map([
  ['消费者权益日', '国际消费者权益日'],
  ['中共诞辰', '中国共产党成立纪念日'],
  ['抗日战争纪念日', '七七事变纪念日'],
  ['建军节', '中国人民解放军建军纪念日'],
  ['抗日战争胜利纪念', '中国人民抗日战争暨世界反法西斯战争胜利纪念日'],
  ['毛泽东逝世纪念', '毛泽东逝世纪念日'],
  ['澳门回归纪念', '澳门回归纪念日'],
  ['南京大屠杀纪念日', '南京大屠杀死难者国家公祭日'],
  ['毛泽东诞辰纪念', '毛泽东诞辰纪念日'],
  ['清明', '清明节'],
]);

// Synonymous entries on the same source date become aliases of one event.
const ALIAS_OF = new Map([
  ['上元节', '元宵节'],
  ['春龙节', '龙抬头'],
  ['天后诞', '妈祖诞辰'],
  ['乞巧节', '七夕节'],
  ['女儿节', '七夕节'],
  ['鬼节', '中元节'],
]);

const SHORT_NAMES = new Map([
  ['元宵节', '元宵节'],
  ['龙抬头', '龙抬头'],
  ['妈祖诞辰', '妈祖诞'],
  ['七夕节', '七夕节'],
  ['中元节', '中元节'],
  ['中国共产党成立纪念日', '建党日'],
  ['香港回归纪念日', '香港回归'],
  ['七七事变纪念日', '七七事变'],
  ['中国人民解放军建军纪念日', '建军节'],
  ['中国人民抗日战争暨世界反法西斯战争胜利纪念日', '抗战胜利'],
  ['九一八事变纪念日', '九一八'],
  ['辛亥革命纪念日', '辛亥纪念'],
  ['西安事变纪念日', '西安事变'],
  ['南京大屠杀死难者国家公祭日', '国家公祭'],
  ['澳门回归纪念日', '澳门回归'],
  ['全国中小学生安全教育日', '安全教育'],
  ['世界防治结核病日', '防治结核'],
  ['消除种族歧视国际日', '反歧视日'],
  ['防治荒漠化和干旱日', '防治荒漠'],
  ['国际臭氧层保护日', '保护臭氧'],
  ['世界清洁地球日', '清洁地球'],
  ['全国消防安全宣传日', '消防宣传'],
  ['国际减轻自然灾害日', '减灾日'],
  ['国际声援巴勒斯坦人民日', '声援巴勒斯坦'],
  ['中国男子节(爸爸节)', '爸爸节'],
  ['祭祖节(十月朝)', '十月朝'],
  ['国际和平与民主自由斗争日', '和平民主日'],
]);

const EXTRA_ALIASES = new Map([
  ['世界图书和版权日', ['世界读书日', '世界图书与版权日']],
  ['国际消费者权益日', ['消费者权益日']],
]);

// Commemorative entries are deliberately layered: common keeps observances
// with broad present-day relevance in China; all preserves the complete source.
const NOTABLE_COMMEMORATIVE = new Set([
  '世界湿地日', '全国爱耳日', '世界森林日', '消除种族歧视国际日', '世界儿歌日',
  '世界防治结核病日', '全国中小学生安全教育日', '世界卫生日', '世界地球日',
  '世界图书和版权日', '世界红十字日', '世界电信日', '国际博物馆日', '全国学生营养日',
  '世界无烟日', '世界环境日', '全国爱眼日', '防治荒漠化和干旱日', '国际禁毒日',
  '世界人口日', '国际扫盲日', '世界清洁地球日', '国际臭氧层保护日', '国际爱牙日',
  '世界旅游日', '世界动物日', '全国高血压日', '世界视觉日', '世界邮政日',
  '世界精神卫生日', '世界标准日', '国际盲人节', '世界粮食日', '世界消除贫困日',
  '联合国日', '中国记者日', '全国消防安全宣传日', '世界糖尿病日', '世界电视日',
  '世界艾滋病日', '世界残疾人日', '国际志愿人员日', '世界人权日',
]);

const MAJOR_HISTORICAL = new Set([
  '中国共产党成立纪念日', '香港回归纪念日', '七七事变纪念日',
  '中国人民解放军建军纪念日', '中国人民抗日战争暨世界反法西斯战争胜利纪念日',
  '九一八事变纪念日', '辛亥革命纪念日', '西安事变纪念日',
  '南京大屠杀死难者国家公祭日', '澳门回归纪念日',
]);

const WEEK_RULES = [
  [1, 'last', 7, '世界麻风日', 'commemorative'],
  [5, 2, 7, '母亲节', 'popular'],
  [5, 3, 7, '全国助残日', 'popular'],
  [6, 3, 7, '父亲节', 'popular'],
  [7, 3, 7, '被奴役国家周', 'commemorative'],
  [9, 3, 2, '国际和平日', 'commemorative'],
  [9, 4, 7, '国际聋人节', 'commemorative'],
  [9, 4, 7, '世界儿童日', 'commemorative'],
  [9, 'last', 7, '世界海事日', 'commemorative'],
  [10, 1, 1, '国际住房日', 'commemorative'],
  [10, 2, 3, '国际减轻自然灾害日', 'commemorative'],
  [11, 4, 4, '感恩节', 'popular'],
];

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const key = (month, day) => String(month).padStart(2, '0') + String(day).padStart(2, '0');
const daysInMonth = (year, month) => month === 2
  ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
  : [0,31,28,31,30,31,30,31,31,30,31,30,31][month];

function shortName(name, aliases) {
  if (SHORT_NAMES.has(name)) return SHORT_NAMES.get(name);
  const candidate = [name, ...aliases].sort((a, b) => a.length - b.length)[0];
  if (candidate.length <= 6) return candidate;
  const stripped = candidate.replace(/^(世界|国际|全国|中国)/, '').replace(/纪念日$/, '纪念');
  return stripped.length <= 6 ? stripped : stripped.slice(0, 5);
}

function normalize(raw) {
  const formal = FORMAL_NAMES.get(raw.name) ?? ALIAS_OF.get(raw.name) ?? raw.name;
  const aliases = [...(formal === raw.name ? [] : [raw.name]), ...(EXTRA_ALIASES.get(formal) ?? [])];
  return { ...raw, name: formal, aliases: [...new Set(aliases)] };
}

function isVisible(item, mode) {
  if (mode === 'all') return true;
  if (mode === 'major') return ['statutory', 'traditional', 'popular'].includes(item.level)
    || (item.level === 'historical' && MAJOR_HISTORICAL.has(item.name));
  return item.level !== 'commemorative' || NOTABLE_COMMEMORATIVE.has(item.name);
}

function latestTerm(terms, name, dayNumber) {
  return terms.filter(term => term.name === name && term.dayNumber <= dayNumber).at(-1);
}

function termInYear(terms, name, year) {
  return terms.find(term => term.name === name && term.assignedDate?.year === year);
}

function nthStemDay(baseDay, nth, stem, currentDay, currentDayIndex) {
  const baseStem = mod(currentDayIndex - (currentDay - baseDay), 10);
  return baseDay + mod(stem - baseStem, 10) + (nth - 1) * 10;
}

function dynamicFestivals(solar, context) {
  const { dayNumber, dayIndex, terms = [] } = context ?? {};
  if (!Number.isInteger(dayNumber) || !Number.isInteger(dayIndex)) return [];
  const result = [];
  const winterSolstice = latestTerm(terms, '冬至', dayNumber);
  if (winterSolstice) {
    const diff = dayNumber - winterSolstice.dayNumber;
    if (diff >= 0 && diff < 81) {
      const names = ['一九','二九','三九','四九','五九','六九','七九','八九','九九'];
      const period = names[Math.floor(diff / 9)], day = diff % 9 + 1;
      result.push({ name: day === 1 ? period : `${period}第${day}天`, source: 'custom',
        calendarDisplay: day === 1 ? 'secondary' : 'detail',
        level: day === 1 ? 'traditional' : 'commemorative', isStatutoryFestival: false, startYear: 0, endYear: 9999 });
    }
  }
  const summerSolstice = termInYear(terms, '夏至', solar.year);
  const autumnStarts = termInYear(terms, '立秋', solar.year);
  if (summerSolstice && autumnStarts) {
    const first = nthStemDay(summerSolstice.dayNumber, 3, 6, dayNumber, dayIndex);
    const middle = nthStemDay(summerSolstice.dayNumber, 4, 6, dayNumber, dayIndex);
    const last = nthStemDay(autumnStarts.dayNumber, 1, 6, dayNumber, dayIndex);
    const period = dayNumber >= first && dayNumber < middle ? ['初伏', first]
      : dayNumber >= middle && dayNumber < last ? ['中伏', middle]
      : dayNumber >= last && dayNumber < last + 10 ? ['末伏', last] : null;
    if (period) {
      const day = dayNumber - period[1] + 1;
      result.push({ name: day === 1 ? period[0] : `${period[0]}第${day}天`, source: 'custom',
        calendarDisplay: day === 1 ? 'secondary' : 'detail',
        level: day === 1 ? 'traditional' : 'commemorative', isStatutoryFestival: false, startYear: 0, endYear: 9999 });
    }
  }
  const grainInEar = termInYear(terms, '芒种', solar.year);
  const slightHeat = termInYear(terms, '小暑', solar.year);
  if (grainInEar && dayNumber > grainInEar.dayNumber && dayNumber < grainInEar.dayNumber + 11 && dayIndex % 10 === 2)
    result.push({ name: '入梅', source: 'custom', calendarDisplay: 'secondary', level: 'traditional', isStatutoryFestival: false, startYear: 0, endYear: 9999 });
  if (slightHeat && dayNumber > slightHeat.dayNumber && dayNumber < slightHeat.dayNumber + 13 && dayIndex % 12 === 7)
    result.push({ name: '出梅', source: 'custom', calendarDisplay: 'secondary', level: 'traditional', isStatutoryFestival: false, startYear: 0, endYear: 9999 });
  return result;
}

/** Returns fresh, normalized festival records from the Shou Xing table. */
export function getFestivalDetails(solar, lunar, term, weekday, mode = 'common', context) {
  if (!MODES.has(mode)) throw new RangeError('invalid festivalMode');
  const raw = [];
  raw.push(...SOLAR_FESTIVALS[key(solar.month, solar.day)] ?? []);
  if (!lunar.isLeap) raw.push(...LUNAR_FESTIVALS[key(lunar.month, lunar.day)] ?? []);
  if (!lunar.isLeap && lunar.month === 12 && lunar.day === lunar.monthDays)
    raw.push({ name: '除夕', source: 'lunar', level: 'statutory', isStatutoryFestival: true, startYear: 0, endYear: 9999 });
  const nth = Math.floor((solar.day - 1) / 7) + 1;
  const last = solar.day + 7 > daysInMonth(solar.year, solar.month);
  for (const [month, occurrence, dow, name, level] of WEEK_RULES) {
    if (month === solar.month && dow === weekday && (occurrence === nth || occurrence === 'last' && last))
      raw.push({ name, source: 'weekBased', level, isStatutoryFestival: false, startYear: 0, endYear: 9999 });
  }
  if (term?.name === '清明') raw.push({ name: '清明', source: 'termBased', level: 'statutory', isStatutoryFestival: true, startYear: 0, endYear: 9999 });
  raw.push(...dynamicFestivals(solar, context));

  const items = new Map();
  for (const source of raw) {
    if (solar.year < source.startYear || solar.year > source.endYear) continue;
    const item = normalize({ ...source, calendarDisplay: source.calendarDisplay ?? calendarDisplay(source.name) });
    const existing = items.get(item.name);
    if (existing) {
      existing.aliases = [...new Set([...existing.aliases, ...item.aliases])];
      if (DISPLAY_PRIORITY[item.calendarDisplay] < DISPLAY_PRIORITY[existing.calendarDisplay])
        existing.calendarDisplay = item.calendarDisplay;
    }
    else items.set(item.name, item);
  }
  return [...items.values()]
    .map(item => ({ name: item.name, shortName: shortName(item.name, item.aliases), level: item.level,
      calendarDisplay: item.calendarDisplay,
      source: item.source, isStatutoryFestival: item.isStatutoryFestival, aliases: [...item.aliases] }))
    .filter(item => isVisible(item, mode))
    .sort((a, b) => (LEVEL_PRIORITY.get(a.level) ?? 99) - (LEVEL_PRIORITY.get(b.level) ?? 99));
}

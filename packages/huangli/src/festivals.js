import { DATA } from './data.js';

// Keep the imported Dart tables intact. Display names and classification live
// here; categories describe content, not legal time off or historical validity.
// Civic names: https://app.www.gov.cn/govdata/gov/202411/12/521605/article.html
const RENAMES = new Map([
  ['元旦节', '元旦'],
  ['国际劳动节', '劳动节'],
  ['国际劳动妇女节', '妇女节'],
  ['中国青年节', '青年节'],
  ['国际儿童节', '儿童节'],
  ['中国人民解放军建军节', '中国人民解放军建军纪念日'],
  ['中国教师节', '教师节'],
  ['中国植树节', '植树节'],
  ['国际愚人节', '愚人节'],
  ['京汉铁路罢工纪念', '二七纪念日'],
  ['中国人民抗日战争纪念日', '七七抗战纪念日'],
  ['“九·一八”事变纪念日', '九一八纪念日'],
  // https://www.fmprc.gov.cn/web/ziliao_674904/historytoday_674971/200309/t20030903_9284634.shtml
  ['中国抗日战争胜利纪念日', '中国人民抗日战争胜利纪念日'],
  // https://www.nanjing.gov.cn/zdgk/202512/t20251208_5708072.html
  ['南京大屠杀纪念日', '南京大屠杀死难者国家公祭日'],
]);

// Explicit splits avoid treating punctuation in an unknown source name as a
// separator. A combined source label is provenance, not an alias of each event.
const SPLITS = new Map([
  ['春龙节-福德土地正神诞', [['龙抬头', 'traditional', ['春龙节']], ['福德土地正神诞', 'religious', []]]],
  ['三月三-玄天上帝诞', [['三月三', 'traditional', []], ['玄天上帝诞', 'religious', []]]],
  ['七夕-魁星诞', [['七夕节', 'traditional', ['七夕']], ['魁星诞', 'religious', []]]],
  ['长真谭真人诞-大势至菩萨诞', [['长真谭真人诞', 'religious', []], ['大势至菩萨诞', 'religious', []]]],
  ['重阳节-酆都大帝诞', [['重阳节', 'traditional', []], ['酆都大帝诞', 'religious', []]]],
  ['腊八节-释迦如来成佛之辰', [['腊八节', 'traditional', []], ['释迦如来成佛之辰', 'religious', []]]],
]);

const CATEGORY_NAMES = {
  traditional: ['春节', '端午节', '中秋节', '清明节', '元宵节', '中元节', '寒衣节', '下元节', '小年', '除夕'],
  civic: ['元旦', '劳动节', '国庆节', '妇女节', '青年节', '儿童节', '中国人民解放军建军纪念日',
    '教师节', '植树节', '中国公安110宣传日', '中国青年志愿者服务日', '全国爱耳日',
    '全国科技人才活动日', '全国爱眼日', '中国人口日', '全国爱牙日'],
  popular: ['情人节', '愚人节', '母亲节', '父亲节', '感恩节', '平安夜', '圣诞节'],
  historical: ['周恩来逝世纪念日', '列宁逝世纪念日', '二七纪念日', '邓小平逝世纪念日',
    '周恩来诞辰纪念日', '孙中山逝世纪念日', '马克思逝世纪念日', '列宁诞辰纪念日',
    '马克思诞辰纪念日', '中国共产党诞生日', '香港回归纪念日', '七七抗战纪念日',
    '恩格斯逝世纪念日', '邓小平诞辰纪念日', '中国人民抗日战争胜利纪念日', '毛泽东逝世纪念日',
    '九一八纪念日', '辛亥革命纪念日', '中国少年先锋队诞辰日', '抗美援朝纪念日',
    '孙中山诞辰纪念日', '恩格斯诞辰纪念日', '西安事变纪念日', '南京大屠杀死难者国家公祭日', '毛泽东诞辰纪念日'],
  local: ['上海解放日'],
};
const CATEGORIES = new Map(Object.entries(CATEGORY_NAMES).flatMap(([category, names]) => names.map(name => [name, category])));
const ALIASES = new Map([
  ['中国人民解放军建军纪念日', ['建军节']],
  ['世界图书和版权日', ['世界读书日', '世界图书与版权日']],
]);

// An explicit selection, not a category filter: an obscure observance should
// not enter the default calendar merely because it shares a broad category.
const COMMON_FESTIVALS = new Set([
  '元旦', '春节', '清明节', '劳动节', '端午节', '中秋节', '国庆节',
  '除夕', '元宵节', '龙抬头', '三月三', '七夕节', '中元节', '重阳节', '寒衣节', '下元节', '腊八节', '小年',
  '妇女节', '青年节', '儿童节', '中国人民解放军建军纪念日', '植树节', '教师节',
  '情人节', '愚人节', '母亲节', '父亲节', '感恩节', '平安夜', '圣诞节',
  '中国共产党诞生日', '香港回归纪念日', '七七抗战纪念日', '中国人民抗日战争胜利纪念日',
  '九一八纪念日', '南京大屠杀死难者国家公祭日',
  '国际消费者权益日', '世界图书和版权日', '世界环境日',
]);

/** Internal calendar adapter. Returns fresh JSON data for each display day. */
export function getFestivalDetails(solar, lunar, term, weekday, mode = 'common') {
  const f = DATA.festivals;
  const items = new Map();
  function add(text, fallbackCategory) {
    if (!text) return;
    for (const sourceName of text.split(',')) {
      // This is a Yi/Ji taboo, not a festival. The independent rule engine
      // remains responsible for its dates, including the inherited variant.
      if (sourceName === '杨公忌') continue;
      const name = RENAMES.get(sourceName) ?? sourceName;
      const entries = SPLITS.get(sourceName) ?? [[name, CATEGORIES.get(name) ?? fallbackCategory,
        [...(name === sourceName ? [] : [sourceName]), ...(ALIASES.get(name) ?? [])]]];
      for (const [canonical, category, aliases] of entries) {
        const item = items.get(canonical) ?? { name: canonical, category, aliases: [], sourceNames: [] };
        item.aliases = [...new Set([...item.aliases, ...aliases])];
        item.sourceNames = [...new Set([...item.sourceNames, sourceName])];
        items.set(canonical, item);
      }
    }
  }
  add(f.solar[solar.month]?.[solar.day], 'civic');
  // UNESCO assigns World Book and Copyright Day to April 23. The imported
  // May 23 duplicate is not a second event; retain its name as an April alias.
  // https://www.unesco.org/zh/days/world-book-and-copyright
  const otherSolar = f.otherSolar[solar.month - 1]?.[solar.day]?.split(',')
    .filter(name => !(solar.month === 5 && solar.day === 23 && name === '世界读书日')).join(',');
  add(otherSolar, 'international');
  if (!lunar.isLeap) {
    add(f.lunar[lunar.month]?.[lunar.day], 'traditional');
    add(f.otherLunar[lunar.month - 1]?.[lunar.month === 12 && lunar.day === lunar.monthDays ? 30 : lunar.day], 'religious');
  }
  if (term) add(f.term[term.name], 'traditional');
  for (const [nth, dow, name] of f.week[solar.month] ?? []) {
    if (nth === Math.floor((solar.day - 1) / 7) + 1 && dow === weekday) add(name, 'popular');
  }
  return [...items.values()].filter(item => mode === 'all' || COMMON_FESTIVALS.has(item.name));
}

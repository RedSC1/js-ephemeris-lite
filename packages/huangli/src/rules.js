import { DATA } from './data.js';
import { BitSet } from './bitset.js';
import { G, mod, integer, deepFreeze } from './rule-tables.js';
import { calculateYiJi } from './yi-ji.js';
import { HUANGLI_LOCALE, localizeHuangliText, localizeHuangliTexts, validateHuangliLocale } from './locale.js';

export const ALMANAC_GODS = deepFreeze(DATA.gods.map(([key, label], index) => ({ key, label, index, auspicious: DATA.angelMask.includes(index) })));
export const ALMANAC_ACTIVITIES = deepFreeze(DATA.activities.map(([key, label], index) => ({ key, label, index })));
export const ACTIVITY_MASKS = DATA.activityMasks;
export const ALMANAC_RULE_INFO = Object.freeze({
  source: 'cnlunar + huangli-lite adaptations', gods: 171, activities: 98,
  convention: 'Source rule behavior retained; not an independently verified historical standard.',
  monthIndex: '0=子, 11=亥; individual legacy H-rule offsets are retained pending a separate source audit.',
});

const TRADITIONAL_GODS = deepFreeze(ALMANAC_GODS.map(item => ({ ...item, label: localizeHuangliText(item.label, HUANGLI_LOCALE.TRADITIONAL) })));
const TRADITIONAL_ACTIVITIES = deepFreeze(ALMANAC_ACTIVITIES.map(item => ({ ...item, label: localizeHuangliText(item.label, HUANGLI_LOCALE.TRADITIONAL) })));

export function getAlmanacGodCatalog(locale = HUANGLI_LOCALE.SIMPLIFIED) {
  return validateHuangliLocale(locale) === HUANGLI_LOCALE.TRADITIONAL ? TRADITIONAL_GODS : ALMANAC_GODS;
}

export function getAlmanacActivityCatalog(locale = HUANGLI_LOCALE.SIMPLIFIED) {
  return validateHuangliLocale(locale) === HUANGLI_LOCALE.TRADITIONAL ? TRADITIONAL_ACTIVITIES : ALMANAC_ACTIVITIES;
}

function inputs(input) {
  const { monthBranch, dayIndex, yearIndex, lunarMonth, lunarDay } = input;
  integer(monthBranch, 0, 11, 'monthBranch'); integer(dayIndex, 0, 59, 'dayIndex');
  // Early historical calendars can label the intercalation as month 13.
  // Keep that label: source rules with explicit 1..12 tables do not match it.
  integer(yearIndex, 0, 59, 'yearIndex'); integer(lunarMonth, 1, 13, 'lunarMonth'); integer(lunarDay, 1, 30, 'lunarDay');
  for (const flag of ['isSiJue', 'isSiLi', 'isTuWangYongShi', 'isPhaseOfMoon', 'isYeargodDuty']) {
    if (input[flag] !== undefined && typeof input[flag] !== 'boolean') throw new TypeError(`${flag} must be boolean`);
  }
  const seasonIndex = input.seasonIndex ?? Math.floor(mod(monthBranch + 10, 12) / 3);
  const monthSeasonTypeIndex = input.monthSeasonTypeIndex ?? mod(monthBranch - 3, 3);
  integer(seasonIndex, 0, 3, 'seasonIndex'); integer(monthSeasonTypeIndex, 0, 2, 'monthSeasonTypeIndex');
  if (typeof input.mansion !== 'string' || !DATA.mansions.some(m => m.name === input.mansion || m.fullName === input.mansion)) throw new RangeError('unknown mansion');
  return { ...input, seasonIndex, monthSeasonTypeIndex };
}

function godBits(i) {
  const { monthBranch: m, dayIndex: d, yearIndex: y, lunarMonth: lm, lunarDay: ld, seasonIndex: s, monthSeasonTypeIndex: ms, mansion } = i;
  const stem=d%10, branch=d%12, ys=y%10, yb=y%12;
  const bits=BitSet.fromChunks(171, DATA.aGrid[m][branch]);
  const hit=(name, yes)=>{ if(yes) bits.add(G[name]); };
  for(const [id,t] of Object.entries(DATA.b)) if(stem===t[m]) bits.add(+id);
  for(const [id,t] of Object.entries(DATA.c)) if(t[m]<10 ? stem===t[m] : branch===t[m]-10) bits.add(+id);
  for(const [id,t] of Object.entries(DATA.d)) if(d===t[m]) bits.add(+id);
  hit('di_nang',DATA.diNang[m].includes(d));
  for(const [group,value] of [[DATA.eStem,stem],[DATA.eBranch,branch],[DATA.ePillar,d]]) {
    for(const [id,t] of Object.entries(group)) if(t[s].includes(value)) bits.add(+id);
  }
  for(const [id,t] of Object.entries(DATA.f)) if(t.includes(d)) bits.add(+id);
  hit('san_he',mod(branch-m,4)===0);
  hit('tian_en',d%15<5 && Math.floor(d/15)!==2);
  hit('sui_po',branch===(yb+6)%12);
  hit('chi_you',branch===[10,0,2,4,6,8][m%6]);
  hit('sui_de',stem===[0,6,2,8,4,0,6,2,8,4][ys]);
  hit('sui_de_he',stem===[5,1,7,3,9,5,1,7,3,9][ys]);
  hit('tian_de',ms===0 ? [[5,4],[],[],[8,7],[],[],[11,10],[],[],[2,1],[],[]][m].includes(branch)
    : stem===[-1,6,3,-1,8,7,-1,0,9,-1,2,1][m]);
  hit('tian_de_he',stem===[-1,1,8,-1,3,2,-1,5,4,-1,7,6][m]);
  hit('feng_huang_ri',mansion.startsWith(['危','昴','胃','毕'][s]));
  hit('qi_lin_ri',mansion.startsWith(['井','尾','牛','壁'][s]));
  hit('wu_he',branch===2 || branch===3);
  hit('bu_jiang',DATA.bujiang[m].includes(d));
  hit('tian_xi',branch===(m+8)%12);
  const mx=[14,16,0,20,10,12,14,16,0,20,10,12][m];
  hit('ming_xing',mx<10?stem===mx:branch===mx-10);
  hit('bing_ji',Array.from({length:4},(_,n)=>mod(2-m+n,12)).includes(branch));
  hit('fu_bing',stem===[2,0,8,6][yb%4]);
  hit('da_huo',stem===[3,1,9,7][yb%4]);
  hit('yue_ji',[5,14,23].includes(ld));
  hit('yang_gong_ji',DATA.yangGongJi.some(([month,day])=>month===lm && day===ld));
  hit('san_niang_sha',[3,7,13,18,22,27].includes(ld));
  hit('si_jue',i.isSiJue); hit('si_li',i.isSiLi); hit('tu_wang_yong_shi',i.isTuWangYongShi);
  // These H-rule offsets follow the Dart implementation verbatim, including
  // its inconsistent month comments. Do not silently reinterpret them here.
  hit('sui_bao',(m===3 && [54,42].includes(d)) || (m===9 && [48,24].includes(d)));
  hit('zhu_zhen',(m===5 && [54,42].includes(d)) || (m===11 && [48,24].includes(d)));
  hit('yin_yang_jiao_po',(m===3 && d===59) || (m===9 && d===53));
  hit('chong_ri',branch===5 || branch===11);
  const fu='甲乙戊丙丁巳庚辛戊壬癸巳'[m];
  hit('fu_ri',fu==='甲乙丙丁戊己庚辛壬癸'[stem] || fu==='子丑寅卯辰巳午未申酉戌亥'[branch]);
  return bits;
}

function virtualBits(m,d,officer,gods) {
  let bits=1<<officer;
  if(gods.has(G.yue_de) && ((m===6 && d===42) || (m===0 && d===48))) bits |= 1<<12;
  if(({2:11,5:2,8:5,11:8})[m]===d%12) bits |= 1<<13;
  if(m===d%12) bits |= 1<<14;
  return bits;
}

/** Pure rule evaluation, independent of any ephemeris or timezone engine. */
export function evaluateAlmanacRules(input, options = {}) {
  const { locale = HUANGLI_LOCALE.SIMPLIFIED } = options;
  for (const key of Object.keys(options)) if (key !== 'locale') throw new RangeError(`unknown almanac output option: ${key}`);
  validateHuangliLocale(locale);
  const i=inputs(input), gods=godBits(i), officer=mod(i.dayIndex%12-i.monthBranch,12);
  const nextSolarTermIndex=integer(i.nextSolarTermIndex,0,23,'nextSolarTermIndex');
  const yi=calculateYiJi({
    monthBranch:i.monthBranch, dayGanZhiIndex:i.dayIndex, lunarMonth:i.lunarMonth, lunarDay:i.lunarDay,
    nextSolarTermIndex, dayOfficerIndex:officer, activeRealGods:gods,
    activeVirtualGodsMask:virtualBits(i.monthBranch,i.dayIndex,officer,gods),
    isPhaseOfMoon:i.isPhaseOfMoon ?? false, isYeargodDuty:i.isYeargodDuty ?? true,
  });
  const mask=i.activityMask;
  if(mask!==undefined && !Array.isArray(mask)) throw new TypeError('activityMask must be an array of activity indices');
  if(mask) for(const id of mask) integer(id,0,97,'activityMask index');
  const sorted=bits=>[...bits].filter(id=>!mask || mask.includes(id)).sort((a,b)=>DATA.sortPriority[a]-DATA.sortPriority[b] || a-b);
  const suitableIds=sorted(yi.goodThings), tabooIds=sorted(yi.badThings), godIds=[...gods];
  return {
    godIds, auspiciousGods:localizeHuangliTexts(godIds.filter(id=>ALMANAC_GODS[id].auspicious).map(id=>DATA.gods[id][1]), locale),
    inauspiciousGods:localizeHuangliTexts(godIds.filter(id=>!ALMANAC_GODS[id].auspicious).map(id=>DATA.gods[id][1]), locale),
    suitableIds, tabooIds, suitableActivities:localizeHuangliTexts(suitableIds.map(id=>DATA.activities[id][1]), locale),
    tabooActivities:localizeHuangliTexts(tabooIds.map(id=>DATA.activities[id][1]), locale),
    officerIndex:officer, officer:localizeHuangliText('建除满平定执破危成收开闭'[officer], locale),
    thingLevel:yi.thingLevel, conflictLevel:yi.maxLevel,
  };
}

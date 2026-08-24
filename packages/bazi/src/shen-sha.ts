import {
  ganzhiBranch,
  ganzhiIndex,
  ganzhiStem,
  getNayinElement,
  type FourPillars,
  type Ganzhi,
} from 'js-ephemeris-lite';
import { GENDER, type Gender } from './constants.js';

export const SHEN_SHA = Object.freeze({
  TIAN_YI_GUI_REN: 0, YI_MA: 1, XIAN_CHI_TAO_HUA: 2, HONG_LUAN: 3,
  TIAN_XI: 4, YANG_REN: 5, FEI_REN: 6, FU_XING_GUI_REN: 7,
  ZAI_SHA: 8, JIE_SHA: 9, WANG_SHEN: 10, KONG_WANG: 11,
  TIAN_CHU_GUI_REN_XUN: 12, TIAN_CHU_GUI_REN: 13, DE_XIU_GUI_REN: 14,
  TIAN_YI_MEDICINE: 15, XUE_REN: 16, YUE_DE_HE: 17, GOU_SHA: 18,
  JIAO_SHA: 19, YUAN_CHEN: 20, GU_CHEN: 21, GUA_SU: 22,
  HONG_YAN_SHA: 23, JIN_YU: 24, JIN_SHEN: 25, TIAN_SHE_DAY: 26,
  LIU_XIA: 27, SANG_MEN: 28, DIAO_KE: 29, PI_MA: 30, TONG_ZI: 31,
  TIAN_DE_HE: 32, SAN_QI_TIAN: 33, SAN_QI_DI: 34, SAN_QI_REN: 35,
  JIANG_XING: 36, HUA_GAI: 37, KUI_GANG: 38, SHI_LING_DAY: 39,
  BA_ZHUAN_DAY: 40, LIU_XIU_DAY: 41, JIU_CHOU_DAY: 42, SI_FEI_DAY: 43,
  SHI_E_DA_BAI: 44, TIAN_LUO_DI_WANG: 45, YIN_CHA_YANG_CUO: 46,
  GU_LUAN_SHA: 47, GONG_LU: 48, GONG_GUI: 49, DI_ZHUAN: 50,
  TIAN_ZHUAN: 51, TAI_JI_GUI_REN: 52, WEN_CHANG_GUI_REN: 53,
  GUO_YIN_GUI_REN: 54, TIAN_DE_GUI_REN: 55, YUE_DE_GUI_REN: 56,
  LU_SHEN: 57, RI_GAN_XUE_TANG: 58, RI_GAN_CI_GUAN: 59,
  ZHENG_XUE_TANG: 60, ZHENG_CI_GUAN: 61, GUAN_GUI_XUE_TANG: 62,
  GUAN_GUI_CI_GUAN: 63, GUAN_XING_XUE_TANG: 64, XUE_TANG_HUI_GUI: 65,
} as const);
export type ShenShaId = typeof SHEN_SHA[keyof typeof SHEN_SHA];
export type ShenShaBitset = bigint;

export const SHEN_SHA_NAMES = Object.freeze([
  '天乙贵人', '驿马', '咸池（桃花）', '红鸾', '天喜', '羊刃', '飞刃', '福星贵人',
  '灾煞', '劫煞', '亡神', '空亡', '天厨贵人（本旬）', '天厨贵人', '德秀贵人', '天医',
  '血刃', '月德合', '勾煞', '绞煞', '元辰', '孤辰', '寡宿', '红艳煞', '金舆', '金神',
  '天赦日', '流霞', '丧门', '吊客', '披麻', '童子', '天德合', '三奇贵人（天）',
  '三奇贵人（地）', '三奇贵人（人）', '将星', '华盖', '魁罡', '十灵日', '八专日', '六秀日',
  '九丑日', '四废日', '十恶大败', '天罗地网', '阴差阳错', '孤鸾煞', '拱禄', '拱贵',
  '地转', '天转', '太极贵人', '文昌贵人', '国印贵人', '天德贵人', '月德贵人', '禄神',
  '日干学堂', '日干词馆', '正学堂', '正词馆', '官贵学堂', '官贵词馆', '官星学堂', '学堂会贵',
] as const);

export const SHEN_SHA_TARGET = Object.freeze({
  YEAR: 0, MONTH: 1, DAY: 2, HOUR: 3, MING_GONG: 4, SHEN_GONG: 5,
  TAI_YUAN: 6, TAI_XI: 7, DA_YUN: 8, FLOW_YEAR: 9, FLOW_MONTH: 10,
  FLOW_DAY: 11, FLOW_HOUR: 12,
} as const);
export type ShenShaTarget = typeof SHEN_SHA_TARGET[keyof typeof SHEN_SHA_TARGET];

type Lookup = readonly (readonly number[])[];
const TY: Lookup = [[1, 7], [0, 8], [9, 11], [9, 11], [1, 7], [0, 8], [1, 7], [2, 6], [3, 5], [3, 5]];
const YI_MA: Lookup = [[2], [11], [8], [5], [2], [11], [8], [5], [2], [11], [8], [5]];
const XIAN_CHI: Lookup = [[9], [6], [3], [0], [9], [6], [3], [0], [9], [6], [3], [0]];
const HONG_LUAN: Lookup = [[3], [2], [1], [0], [11], [10], [9], [8], [7], [6], [5], [4]];
const TIAN_XI: Lookup = [[9], [8], [7], [6], [5], [4], [3], [2], [1], [0], [11], [10]];
const YANG_REN: Lookup = [[3], [2], [6], [5], [6], [5], [9], [8], [0], [11]];
const FEI_REN: Lookup = [[9], [8], [0], [11], [0], [11], [3], [2], [6], [5]];
const FU_XING: Lookup = [[2, 0], [3, 1], [2, 0], [11], [8], [7], [6], [5], [4], [3, 1]];
const ZAI_SHA: Lookup = [[6], [3], [0], [9], [6], [3], [0], [9], [6], [3], [0], [9]];
const JIE_SHA: Lookup = [[5], [2], [11], [8], [5], [2], [11], [8], [5], [2], [11], [8]];
const WANG_SHEN: Lookup = [[11], [8], [5], [2], [11], [8], [5], [2], [11], [8], [5], [2]];
const TIAN_CHU: Lookup = [[5], [6], [5], [6], [8], [9], [11], [0], [2], [3]];
const DE_XIU: Lookup = [[0, 2, 4, 5, 7, 8, 9], [1, 6, 7], [2, 3, 4, 9], [0, 1, 3, 8], [0, 2, 4, 5, 7, 8, 9], [1, 6, 7], [2, 3, 4, 9], [0, 1, 3, 8], [0, 2, 4, 5, 7, 8, 9], [1, 6, 7], [2, 3, 4, 9], [0, 1, 3, 8]];
const TIAN_YI_MEDICINE: Lookup = [[11], [0], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10]];
const XUE_REN: Lookup = [[6], [0], [1], [7], [2], [8], [3], [9], [4], [10], [5], [11]];
const YUE_DE_HE: Lookup = [[3], [1], [7], [5], [3], [1], [7], [5], [3], [1], [7], [5]];
const GU_CHEN: Lookup = [[2], [2], [5], [5], [5], [8], [8], [8], [11], [11], [11], [2]];
const GUA_SU: Lookup = [[10], [10], [1], [1], [1], [4], [4], [4], [7], [7], [7], [10]];
const HONG_YAN: Lookup = [[6], [6], [2], [7], [4], [4], [10], [9], [0], [8]];
const JIN_YU: Lookup = [[4], [5], [7], [8], [7], [8], [10], [11], [1], [2]];
const LIU_XIA: Lookup = [[9], [10], [7], [8], [5], [6], [4], [3], [11], [2]];
const SANG_MEN: Lookup = [[2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [0], [1]];
const DIAO_KE: Lookup = [[10], [11], [0], [1], [2], [3], [4], [5], [6], [7], [8], [9]];
const PI_MA: Lookup = [[9], [10], [11], [0], [1], [2], [3], [4], [5], [6], [7], [8]];
const JIANG_XING: Lookup = [[0], [9], [6], [3], [0], [9], [6], [3], [0], [9], [6], [3]];
const HUA_GAI: Lookup = [[4], [1], [10], [7], [4], [1], [10], [7], [4], [1], [10], [7]];
const TAI_JI: Lookup = [[0, 6], [0, 6], [9, 3], [9, 3], [4, 10, 1, 7], [4, 10, 1, 7], [2, 11], [2, 11], [5, 8], [5, 8]];
const WEN_CHANG: Lookup = [[5], [6], [8], [9], [8], [9], [11], [0], [2], [3]];
const GUO_YIN: Lookup = [[10], [11], [1], [2], [1], [2], [4], [5], [7], [8]];
const YUE_DE_GUI_REN: Lookup = [[8], [6], [2], [0], [8], [6], [2], [0], [8], [6], [2], [0]];
const LU_SHEN: Lookup = [[2], [3], [5], [6], [5], [6], [8], [9], [11], [0]];
const RI_GAN_XUE_TANG: Lookup = [[11], [6], [2], [9], [2], [9], [5], [0], [8], [3]];
const RI_GAN_CI_GUAN: Lookup = LU_SHEN;

const TIAN_SHE = [14, 30, 44, 0] as const;
const KUI_GANG = [16, 28, 34, 46] as const;
const SHI_LING = [40, 11, 52, 33, 54, 46, 26, 47, 38, 19] as const;
const BA_ZHUAN = [50, 51, 43, 34, 55, 56, 57, 49] as const;
const LIU_XIU = [42, 43, 24, 54, 25, 55] as const;
const JIU_CHOU = [33, 24, 54, 15, 45, 27, 57, 48, 18] as const;
const SI_FEI = [[56, 57], [48, 59], [50, 51], [42, 53]] as const;
const SHI_E_DA_BAI = [40, 41, 32, 23, 34, 25, 16, 17, 8, 59] as const;
const YIN_CHA_YANG_CUO = [12, 13, 14, 27, 28, 29, 42, 43, 44, 57, 58, 59] as const;
const GU_LUAN = [41, 53, 47, 44, 50, 54, 48, 42] as const;
const DI_ZHUAN = [27, 54, 9, 12] as const;
const TIAN_ZHUAN = [51, 42, 57, 48] as const;
const NAYIN_ZHANG_SHENG = [8, 11, 5, 8, 2] as const;
const NAYIN_LIN_GUAN = [11, 2, 8, 11, 5] as const;
const NAYIN_DI_WANG = [0, 3, 9, 0, 6] as const;
const STEM_ELEMENT = [1, 1, 4, 4, 3, 3, 2, 2, 0, 0] as const;
const OFFICIAL_ELEMENT = [3, 2, 4, 1, 0] as const;
const OFFICIAL_STEM = [7, 6, 9, 8, 1, 0, 3, 2, 5, 4] as const;

function contains(table: Lookup, source: number, target: number): boolean {
  return table[source]!.includes(target);
}

function hasIndex(values: readonly number[], index: number): boolean {
  return values.includes(index);
}

function bit(id: ShenShaId): bigint { return 1n << BigInt(id); }

export function hasShenSha(bitset: ShenShaBitset, id: ShenShaId): boolean {
  return (bitset & bit(id)) !== 0n;
}

export function shenShaIds(bitset: ShenShaBitset): readonly ShenShaId[] {
  const ids: ShenShaId[] = [];
  for (let id = 0; id < 66; id += 1) if ((bitset & (1n << BigInt(id))) !== 0n) ids.push(id as ShenShaId);
  return Object.freeze(ids);
}

export function shenShaNames(bitset: ShenShaBitset): readonly string[] {
  return Object.freeze(shenShaIds(bitset).map((id) => SHEN_SHA_NAMES[id]!));
}

/** Native-compatible low/high uint64 words. */
export function shenShaWords(bitset: ShenShaBitset): readonly [bigint, bigint] {
  const mask64 = (1n << 64n) - 1n;
  return Object.freeze([bitset & mask64, (bitset >> 64n) & mask64]);
}

function sameXun(first: Ganzhi, second: Ganzhi): boolean {
  return Math.floor(ganzhiIndex(first) / 10) === Math.floor(ganzhiIndex(second) / 10);
}

function kongWangContains(base: Ganzhi, target: Ganzhi): boolean {
  const first = (10 - Math.floor(ganzhiIndex(base) / 10) * 2 + 12) % 12;
  const branch = ganzhiBranch(target);
  return branch === first || branch === (first + 1) % 12;
}

function isTianDeHe(monthBranch: number, target: Ganzhi): boolean {
  const stems = [-1, 1, 8, -1, 3, 2, -1, 5, 4, -1, 7, 6];
  const branches = [8, -1, -1, 5, -1, -1, 2, -1, -1, 11, -1, -1];
  return ganzhiStem(target) === stems[monthBranch] || ganzhiBranch(target) === branches[monthBranch];
}

function isTianDeGuiRen(monthBranch: number, target: Ganzhi): boolean {
  const stems = [-1, 6, 3, -1, 8, 7, -1, 0, 9, -1, 2, 1];
  const branches = [5, -1, -1, 8, -1, -1, 11, -1, -1, 2, -1, -1];
  return ganzhiStem(target) === stems[monthBranch] || ganzhiBranch(target) === branches[monthBranch];
}

function unorderedPair(a: number, b: number, left: number, right: number): boolean {
  return (a === left && b === right) || (a === right && b === left);
}

export interface ShenShaChart { readonly pillars: Readonly<FourPillars> }
export interface CollectShenShaOptions { gender?: Gender }

export function collectTargetShenSha(
  chart: ShenShaChart,
  target: Ganzhi,
  targetKind: ShenShaTarget,
  options: CollectShenShaOptions = {},
): ShenShaBitset {
  if (!Number.isInteger(targetKind) || targetKind < 0 || targetKind > 12) throw new RangeError('unknown Shen-Sha target kind');
  const gender = options.gender;
  if (gender !== undefined && gender !== GENDER.FEMALE && gender !== GENDER.MALE) throw new RangeError('unknown gender');
  const { year, month, day, hour } = chart.pillars;
  const targetBranch = ganzhiBranch(target);
  const targetStem = ganzhiStem(target);
  const yearStem = ganzhiStem(year);
  const dayStem = ganzhiStem(day);
  const yearBranch = ganzhiBranch(year);
  const dayBranch = ganzhiBranch(day);
  const monthBranch = ganzhiBranch(month);
  const season = Math.floor(((monthBranch + 10) % 12) / 3);
  let result = 0n;
  const set = (id: ShenShaId): void => { result |= bit(id); };

  if (contains(TY, yearStem, targetBranch) || contains(TY, dayStem, targetBranch)) set(0);
  if (contains(YI_MA, yearBranch, targetBranch) || contains(YI_MA, dayBranch, targetBranch)) set(1);
  if (contains(XIAN_CHI, yearBranch, targetBranch) || contains(XIAN_CHI, dayBranch, targetBranch)) set(2);
  if (contains(HONG_LUAN, yearBranch, targetBranch)) set(3);
  if (contains(TIAN_XI, yearBranch, targetBranch)) set(4);
  if (contains(YANG_REN, dayStem, targetBranch)) set(5);
  if (contains(FEI_REN, dayStem, targetBranch)) set(6);
  if (contains(FU_XING, yearStem, targetBranch) || contains(FU_XING, dayStem, targetBranch)) set(7);
  if (contains(ZAI_SHA, yearBranch, targetBranch) || contains(ZAI_SHA, dayBranch, targetBranch)) set(8);
  if (contains(JIE_SHA, yearBranch, targetBranch) || contains(JIE_SHA, dayBranch, targetBranch)) set(9);
  if (contains(WANG_SHEN, yearBranch, targetBranch) || contains(WANG_SHEN, dayBranch, targetBranch)) set(10);
  if (kongWangContains(year, target) || kongWangContains(day, target)) set(11);
  if ((sameXun(year, target) && targetStem === (yearStem + 2) % 10)
    || (sameXun(day, target) && targetStem === (dayStem + 2) % 10)) set(12);
  if (contains(TIAN_CHU, yearStem, targetBranch) || contains(TIAN_CHU, dayStem, targetBranch)) set(13);
  if (contains(DE_XIU, monthBranch, targetStem)) set(14);
  if (contains(TIAN_YI_MEDICINE, monthBranch, targetBranch)) set(15);
  if (contains(XUE_REN, monthBranch, targetBranch)) set(16);
  if (contains(YUE_DE_HE, monthBranch, targetStem)) set(17);

  if (gender !== undefined) {
    const forward = (gender === GENDER.MALE) === ((yearStem & 1) === 0);
    const plus3 = (yearBranch + 3) % 12;
    const plus9 = (yearBranch + 9) % 12;
    if ((forward && targetBranch === plus3) || (!forward && targetBranch === plus9)) set(18);
    if ((forward && targetBranch === plus9) || (!forward && targetBranch === plus3)) set(19);
    if (targetBranch === (yearBranch + (forward ? 7 : 5)) % 12) set(20);
    const hourStem = ganzhiStem(hour);
    const hourBranch = ganzhiBranch(hour);
    const yearNayin = getNayinElement(year);
    if (targetKind === SHEN_SHA_TARGET.HOUR && (dayStem === 0 || dayStem === 5)
      && ((targetStem === 9 && targetBranch === 9) || (targetStem === 5 && targetBranch === 5)
        || (targetStem === 1 && targetBranch === 1))) set(25);
    if ((targetKind === SHEN_SHA_TARGET.DAY || targetKind === SHEN_SHA_TARGET.HOUR)
      && (((season === 0 || season === 2) && (targetBranch === 2 || targetBranch === 0))
        || ((season === 1 || season === 3) && (targetBranch === 3 || targetBranch === 7 || targetBranch === 4))
        || ((yearNayin === 2 || yearNayin === 1) && (targetBranch === 6 || targetBranch === 3))
        || ((yearNayin === 0 || yearNayin === 4) && (targetBranch === 9 || targetBranch === 10))
        || (yearNayin === 3 && (targetBranch === 4 || targetBranch === 5)))) set(31);
    if (targetKind === SHEN_SHA_TARGET.DAY) {
      const stems = [yearStem, ganzhiStem(month), dayStem, hourStem];
      if ([0, 4, 6].every((stem) => stems.includes(stem))) set(33);
      if ([1, 2, 3].every((stem) => stems.includes(stem))) set(34);
      if ([8, 9, 7].every((stem) => stems.includes(stem))) set(35);
    }
    if (yearNayin !== 1 && yearNayin !== 2) {
      const counterpart = targetBranch === 10 ? 11 : targetBranch === 11 ? 10
        : targetBranch === 4 ? 5 : targetBranch === 5 ? 4 : -1;
      const hasCounterpart = [yearBranch, monthBranch, dayBranch, hourBranch].includes(counterpart);
      if (((targetBranch === 10 || targetBranch === 11) && yearNayin === 4
          && gender === GENDER.MALE && hasCounterpart)
        || ((targetBranch === 4 || targetBranch === 5) && (yearNayin === 0 || yearNayin === 3)
          && gender === GENDER.FEMALE && hasCounterpart)) set(45);
    }
    if (targetKind === SHEN_SHA_TARGET.DAY && dayStem === hourStem && dayBranch !== hourBranch) {
      if ((dayStem === 9 && unorderedPair(dayBranch, hourBranch, 11, 1))
        || (dayStem === 3 && unorderedPair(dayBranch, hourBranch, 5, 7))
        || (dayStem === 5 && unorderedPair(dayBranch, hourBranch, 7, 5))
        || (dayStem === 4 && unorderedPair(dayBranch, hourBranch, 4, 6))) set(48);
      if ((dayStem === 0 && (unorderedPair(dayBranch, hourBranch, 8, 10)
          || unorderedPair(dayBranch, hourBranch, 2, 0)))
        || (dayStem === 1 && unorderedPair(dayBranch, hourBranch, 7, 9))
        || (dayStem === 4 && unorderedPair(dayBranch, hourBranch, 8, 6))
        || (dayStem === 7 && unorderedPair(dayBranch, hourBranch, 1, 3))) set(49);
    }
  }

  if (contains(GU_CHEN, yearBranch, targetBranch)) set(21);
  if (contains(GUA_SU, yearBranch, targetBranch)) set(22);
  if (contains(HONG_YAN, dayStem, targetBranch)) set(23);
  if (contains(JIN_YU, dayStem, targetBranch)) set(24);
  if (contains(LIU_XIA, dayStem, targetBranch)) set(27);
  if (contains(SANG_MEN, yearBranch, targetBranch)) set(28);
  if (contains(DIAO_KE, yearBranch, targetBranch)) set(29);
  if (contains(PI_MA, yearBranch, targetBranch)) set(30);
  if (contains(JIANG_XING, yearBranch, targetBranch) || contains(JIANG_XING, dayBranch, targetBranch)) set(36);
  if (contains(HUA_GAI, yearBranch, targetBranch) || contains(HUA_GAI, dayBranch, targetBranch)) set(37);
  if (contains(TAI_JI, yearStem, targetBranch) || contains(TAI_JI, dayStem, targetBranch)) set(52);
  if (contains(WEN_CHANG, yearStem, targetBranch) || contains(WEN_CHANG, dayStem, targetBranch)) set(53);
  if (contains(GUO_YIN, yearStem, targetBranch) || contains(GUO_YIN, dayStem, targetBranch)) set(54);
  if (contains(YUE_DE_GUI_REN, monthBranch, targetStem)) set(56);
  if (isTianDeHe(monthBranch, target)) set(32);
  if (isTianDeGuiRen(monthBranch, target)) set(55);
  if (contains(LU_SHEN, dayStem, targetBranch)) set(57);
  if (contains(RI_GAN_XUE_TANG, dayStem, targetBranch)) set(58);
  if (contains(RI_GAN_CI_GUAN, dayStem, targetBranch)) set(59);
  const yearNayin = getNayinElement(year);
  const targetNayin = getNayinElement(target);
  if (yearNayin === targetNayin && targetBranch === NAYIN_ZHANG_SHENG[yearNayin]) set(60);
  if (yearNayin === targetNayin && targetBranch === NAYIN_LIN_GUAN[yearNayin]) set(61);
  const officialElement = OFFICIAL_ELEMENT[STEM_ELEMENT[dayStem]!]!;
  if (targetBranch === NAYIN_ZHANG_SHENG[officialElement]) set(62);
  if (targetBranch === NAYIN_LIN_GUAN[officialElement]) set(63);
  if (targetBranch === NAYIN_ZHANG_SHENG[STEM_ELEMENT[dayStem]!] && targetStem === OFFICIAL_STEM[dayStem]) set(64);
  if (targetBranch === NAYIN_DI_WANG[yearNayin]
    && (contains(TY, yearStem, targetBranch) || contains(TY, dayStem, targetBranch))) set(65);
  const targetIndex = ganzhiIndex(target);
  if (targetIndex === DI_ZHUAN[season]) set(50);
  if (targetIndex === TIAN_ZHUAN[season]) set(51);
  if (targetKind === SHEN_SHA_TARGET.DAY) {
    if (targetIndex === TIAN_SHE[season]) set(26);
    if (hasIndex(KUI_GANG, targetIndex)) set(38);
    if (hasIndex(SHI_LING, targetIndex)) set(39);
    if (hasIndex(BA_ZHUAN, targetIndex)) set(40);
    if (hasIndex(LIU_XIU, targetIndex)) set(41);
    if (hasIndex(JIU_CHOU, targetIndex)) set(42);
    if (hasIndex(SI_FEI[season]!, targetIndex)) set(43);
    if (hasIndex(SHI_E_DA_BAI, targetIndex)) set(44);
    if (hasIndex(YIN_CHA_YANG_CUO, targetIndex)) set(46);
    if (hasIndex(GU_LUAN, targetIndex)) set(47);
  }
  return result;
}

export interface NatalShenShaBitsets {
  readonly year: ShenShaBitset;
  readonly month: ShenShaBitset;
  readonly day: ShenShaBitset;
  readonly hour: ShenShaBitset;
}

export function collectNatalShenSha(
  chart: ShenShaChart,
  options: CollectShenShaOptions = {},
): NatalShenShaBitsets {
  return Object.freeze({
    year: collectTargetShenSha(chart, chart.pillars.year, SHEN_SHA_TARGET.YEAR, options),
    month: collectTargetShenSha(chart, chart.pillars.month, SHEN_SHA_TARGET.MONTH, options),
    day: collectTargetShenSha(chart, chart.pillars.day, SHEN_SHA_TARGET.DAY, options),
    hour: collectTargetShenSha(chart, chart.pillars.hour, SHEN_SHA_TARGET.HOUR, options),
  });
}

export const SHEN_SHA_INFO = Object.freeze({ stableIdCount: 66, representation: 'bigint bitset' });

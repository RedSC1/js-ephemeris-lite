import type { CivilDateTime, FourPillars } from 'js-ephemeris-lite';

export const ZIWEI_GENDER = Object.freeze({ MALE: 0, FEMALE: 1 } as const);
export type ZiweiGender = typeof ZIWEI_GENDER[keyof typeof ZIWEI_GENDER];

export const FLOW_LEVEL = Object.freeze({
  DECADE: 0,
  YEAR: 1,
  MONTH: 2,
  DAY: 3,
  HOUR: 4,
} as const);
export type FlowLevel = typeof FLOW_LEVEL[keyof typeof FLOW_LEVEL];

export const RAT_HOUR_SEGMENT = Object.freeze({
  NONE: 0,
  UNIFIED: 1,
  EARLY: 2,
  LATE: 3,
} as const);
export type RatHourSegment = typeof RAT_HOUR_SEGMENT[keyof typeof RAT_HOUR_SEGMENT];

export const CHILDHOOD_STRATEGY = Object.freeze({ SKIP: 0, SEQUENTIAL: 1 } as const);
export type ChildhoodStrategy = typeof CHILDHOOD_STRATEGY[keyof typeof CHILDHOOD_STRATEGY];

export const BUREAU = Object.freeze({
  WATER_2: 0,
  WOOD_3: 1,
  METAL_4: 2,
  EARTH_5: 3,
  FIRE_6: 4,
} as const);
export type Bureau = typeof BUREAU[keyof typeof BUREAU];

export const PALACE = Object.freeze({
  LIFE: 0,
  SIBLINGS: 1,
  SPOUSE: 2,
  CHILDREN: 3,
  WEALTH: 4,
  HEALTH: 5,
  TRAVEL: 6,
  FRIENDS: 7,
  CAREER: 8,
  PROPERTY: 9,
  FORTUNE: 10,
  PARENTS: 11,
} as const);
export type PalaceId = typeof PALACE[keyof typeof PALACE];

export const PALACE_NAMES = Object.freeze([
  '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄',
  '迁移', '交友', '官禄', '田宅', '福德', '父母',
] as const);

export const PILLAR_BOUNDARY = Object.freeze({ SOLAR_TERM: 0, LUNAR: 1 } as const);
export type PillarBoundary = typeof PILLAR_BOUNDARY[keyof typeof PILLAR_BOUNDARY];

export const ZIWEI_CHART_MODE = Object.freeze({
  TIAN_PAN: 0,
  DI_PAN: 1,
  REN_PAN: 2,
} as const);
export type ZiweiChartMode = typeof ZIWEI_CHART_MODE[keyof typeof ZIWEI_CHART_MODE];

export const LEAP_MONTH_STRATEGY = Object.freeze({
  AS_PREVIOUS: 0,
  AS_NEXT: 1,
  SPLIT_AFTER_FIFTEENTH: 2,
} as const);
export type LeapMonthStrategy = typeof LEAP_MONTH_STRATEGY[keyof typeof LEAP_MONTH_STRATEGY];

export const FLOW_MONTH_PALACE_STRATEGY = Object.freeze({
  /** Dart/C++ convention: every physical lunar month advances the palace. */
  PHYSICAL_SEQUENCE: 0,
  /** Treat the whole selected segment as its effective previous/next month. */
  EFFECTIVE_MONTH: 1,
} as const);
export type FlowMonthPalaceStrategy = typeof FLOW_MONTH_PALACE_STRATEGY[keyof typeof FLOW_MONTH_PALACE_STRATEGY];

export const BRIGHTNESS = Object.freeze({
  NONE: -1,
  XIAN: 0,
  BU: 1,
  PING: 2,
  LI: 3,
  DE: 4,
  WANG: 5,
  MIAO: 6,
} as const);
export type Brightness = typeof BRIGHTNESS[keyof typeof BRIGHTNESS];
export const BRIGHTNESS_NAMES = Object.freeze(['陷', '不', '平', '利', '得', '旺', '庙'] as const);

export function brightnessName(value: Brightness): string | null {
  return value === BRIGHTNESS.NONE ? null : BRIGHTNESS_NAMES[value];
}

export const STAR_TRANSFORM_MARK = Object.freeze({
  BIRTH_YEAR_LU: 0,
  BIRTH_YEAR_QUAN: 1,
  BIRTH_YEAR_KE: 2,
  BIRTH_YEAR_JI: 3,
  CENTRIFUGAL_LU: 4,
  CENTRIFUGAL_QUAN: 5,
  CENTRIFUGAL_KE: 6,
  CENTRIFUGAL_JI: 7,
  CENTRIPETAL_LU: 8,
  CENTRIPETAL_QUAN: 9,
  CENTRIPETAL_KE: 10,
  CENTRIPETAL_JI: 11,
} as const);
export type StarTransformMark = typeof STAR_TRANSFORM_MARK[keyof typeof STAR_TRANSFORM_MARK];

export interface ZiweiLunarDateFacts {
  readonly year: number;
  readonly historicalYear: number;
  readonly month: number;
  readonly day: number;
  readonly isLeap: boolean;
  readonly monthName: number;
}

export interface ZiweiCalendarFacts {
  readonly jdUT1: number;
  readonly virtualTime: Readonly<CivilDateTime>;
  readonly gender: ZiweiGender;
  readonly lunarDate: ZiweiLunarDateFacts;
  readonly solarTermPillars: Readonly<FourPillars>;
  readonly lunarPillars: Readonly<FourPillars>;
  readonly effectiveLunarYear: number;
  readonly effectiveLunarMonth: number;
  readonly solarDayFromPreviousJie: number;
}

export interface TransformSet {
  readonly lu: number;
  readonly quan: number;
  readonly ke: number;
  readonly ji: number;
}

/** A flow coordinate is intentionally not a sexagenary Ganzhi pair. */
export interface FlowCoordinate {
  readonly stem: number;
  readonly branch: number;
}

export interface LimitCoordinate {
  readonly level: FlowLevel;
  readonly coordinate: Readonly<FlowCoordinate>;
  readonly natalPalaceId: PalaceId;
}

export function bureauNumber(bureau: Bureau): number {
  return [2, 3, 4, 5, 6][bureau] ?? 0;
}

export function advanceBranch(branch: number, offset: number): number {
  return ((branch + offset) % 12 + 12) % 12;
}

export function isForward(yearStem: number, gender: ZiweiGender): boolean {
  return (yearStem & 1) === gender;
}

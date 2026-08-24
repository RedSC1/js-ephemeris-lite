import type { CalendarMode, CalendarOptions } from './chinese-calendar.js';
import type { CivilDate, CivilDateTime, Ut1Input, ZonedTime } from './time.js';

export type Ganzhi = number;

export const HEAVENLY_STEMS: readonly ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const EARTHLY_BRANCHES: readonly ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export const WUXING: Readonly<{
  WATER: 0;
  WOOD: 1;
  METAL: 2;
  EARTH: 3;
  FIRE: 4;
}>;

export const RAT_HOUR_MODE: Readonly<{
  NEXT_DAY: 'next-day';
  CURRENT_DAY: 'current-day';
  CURRENT_DAY_TOMORROW_STEM: 'current-day-tomorrow-stem';
}>;
export type RatHourMode = typeof RAT_HOUR_MODE[keyof typeof RAT_HOUR_MODE];

export const PILLAR_HISTORICAL_MODE: Readonly<{
  FOLLOW_CALENDAR: 'follow-calendar';
  OFF: 'off';
  ON: 'on';
}>;
export type PillarHistoricalMode = typeof PILLAR_HISTORICAL_MODE[keyof typeof PILLAR_HISTORICAL_MODE];

export interface FourPillars {
  readonly year: Ganzhi;
  readonly month: Ganzhi;
  readonly day: Ganzhi;
  readonly hour: Ganzhi;
}

export interface FourPillarNames {
  readonly year: string;
  readonly month: string;
  readonly day: string;
  readonly hour: string;
}

export interface FourPillarsOptions extends CalendarOptions {
  ratHourMode?: RatHourMode;
  pillarHistoricalMode?: PillarHistoricalMode;
}

export function makeGanzhi(stem: number, branch: number): Ganzhi;
export function ganzhiStem(value: Ganzhi): number;
export function ganzhiBranch(value: Ganzhi): number;
export function ganzhiIndex(value: Ganzhi): number;
export function ganzhiName(value: Ganzhi): string;
export function advanceGanzhi(value: Ganzhi, delta: number): Ganzhi;
export function getMonthGanzhi(yearStem: number, monthIndex: number): Ganzhi;
export function getHourGanzhi(dayStem: number, hourIndex: number): Ganzhi;
export function getNayinId(value: Ganzhi): number;
export function getNayinElement(value: Ganzhi): number;
export function calculateDayPillar(civilDate: CivilDate): Ganzhi;
export function calculateFourPillars(
  instant: Ut1Input,
  virtualTime: CivilDateTime,
  options?: FourPillarsOptions,
): FourPillars;
export function fourPillarsForZonedTime(
  zonedTime: ZonedTime,
  options?: FourPillarsOptions,
): FourPillars;
export function describeFourPillars(pillars: FourPillars): FourPillarNames;

export const GANZHI_INFO: Readonly<{
  encoding: string;
  defaultRatHourMode: RatHourMode;
  historicalTermBoundary: string;
  calendarModes: readonly CalendarMode[];
}>;

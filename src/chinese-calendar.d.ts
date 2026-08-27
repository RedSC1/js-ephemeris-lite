import type { CivilDate, JulianTime, Ut1Input } from './time.js';

export const CALENDAR_MODE: Readonly<{
  HISTORICAL: 'historical';
  CHINA_ASTRONOMICAL: 'china-astronomical';
  LOCAL_ASTRONOMICAL: 'local-astronomical';
}>;

export type CalendarMode = typeof CALENDAR_MODE[keyof typeof CALENDAR_MODE];

export const CALENDAR_DAY_BOUNDARY_MODE: Readonly<{
  FIXED_UTC_OFFSET: 'fixed-utc-offset';
  MEAN_SOLAR_MERIDIAN: 'mean-solar-meridian';
}>;

export type CalendarDayBoundaryMode =
  typeof CALENDAR_DAY_BOUNDARY_MODE[keyof typeof CALENDAR_DAY_BOUNDARY_MODE];

export const MONTH_NAME: Readonly<{
  NORMAL: 0;
  THIRTEEN: 1;
  LATER_NINE: 2;
  ALT_TWELVE: 3;
  ALT_ONE: 4;
  LATER_SAME_NAME: 5;
}>;

export type LunarMonthName = typeof MONTH_NAME[keyof typeof MONTH_NAME];

export interface CalendarOptions {
  mode?: CalendarMode;
  /** Civil-day boundary used outside the fixed China-standard calendar structure. */
  dayBoundaryMode?: CalendarDayBoundaryMode;
  /** Clock offset used by fixed-utc-offset boundaries and civil-time conversion. */
  utcOffsetMinutes?: number;
  /** Required only for mean-solar-meridian boundaries. */
  meridianDeg?: number;
}

export interface SolarTermEvent {
  indexFromWinterSolstice: number;
  targetLongitude: number;
  time: JulianTime;
  jdTT: number;
  jdUT1: number;
  deltaTSeconds: number;
  civilDayNumber: number;
}

export interface NewMoonEvent {
  time: JulianTime;
  jdTT: number;
  jdUT1: number;
  deltaTSeconds: number;
  civilDayNumber: number;
}

export interface LunarMonth {
  lunarYear: number;
  /** Historical calendar/ganzhi year; can differ from the source label at reforms. */
  historicalYear: number;
  month: number;
  isLeap: boolean;
  dayCount: number;
  monthName: LunarMonthName;
  monthBuildingBranch: number;
  firstCivilDayNumber: number;
  astronomicalNewMoonJdUT1: number;
}

export interface ChineseCalendarYear {
  solarTerms: SolarTermEvent[];
  newMoons: NewMoonEvent[];
  months: LunarMonth[];
  leapMonthIndex: number;
  firstWinterSolsticeDayNumber: number;
  secondWinterSolsticeDayNumber: number;
  mode: CalendarMode;
  dayBoundaryMode: CalendarDayBoundaryMode;
}

export interface LunarDate {
  year: number;
  month: number;
  day: number;
  isLeap?: boolean;
  monthName?: LunarMonthName;
}

export interface ResolvedLunarDate {
  year: number;
  historicalYear: number;
  month: number;
  day: number;
  isLeap: boolean;
  monthDays: number;
  monthName: LunarMonthName;
}

export interface FindSolarTermOptions extends CalendarOptions {
  direction?: 'previous' | 'next';
  filter?: 'any' | 'jie' | 'qi';
}

export function civilDayNumber(jdUT1: Ut1Input, dayOffset?: number): number;
export function historicalEventCivilDay(
  kind: 'solarTerm' | 'newMoon',
  estimateJdUT1: number,
): number | null;
export function calculateChineseCalendarYear(
  jdUT1: Ut1Input,
  options?: CalendarOptions,
): ChineseCalendarYear;
export function findSolarTerm(jdUT1: Ut1Input, options?: FindSolarTermOptions): SolarTermEvent;
export function getSpecificSolarTerm(
  civilYear: number,
  termIndexFromVernalEquinox: number,
  options?: CalendarOptions,
): SolarTermEvent;
export function solarToLunar(solarDate: CivilDate, options?: CalendarOptions): ResolvedLunarDate;
export function instantToLunar(jdUT1: Ut1Input, options?: CalendarOptions): ResolvedLunarDate;
export function lunarToSolar(lunarDate: LunarDate, options?: CalendarOptions): CivilDate;
export function getLunarMonthDays(
  lunarYear: number,
  monthNumber: number,
  isLeap?: boolean,
  options?: CalendarOptions,
): number;
export function getPreviousSolarTerm(jdUT1: Ut1Input, options?: CalendarOptions): SolarTermEvent;
export function getNextSolarTerm(jdUT1: Ut1Input, options?: CalendarOptions): SolarTermEvent;
export function getPreviousJie(jdUT1: Ut1Input, options?: CalendarOptions): SolarTermEvent;
export function getNextJie(jdUT1: Ut1Input, options?: CalendarOptions): SolarTermEvent;
export function getPreviousQi(jdUT1: Ut1Input, options?: CalendarOptions): SolarTermEvent;
export function getNextQi(jdUT1: Ut1Input, options?: CalendarOptions): SolarTermEvent;

export const HISTORICAL_PROFILE_INFO: Readonly<{
  sha256: string;
  profileEndJd: number;
  newMoonEvents: number;
  solarTermEvents: number;
  packedBitBytes: number;
}>;

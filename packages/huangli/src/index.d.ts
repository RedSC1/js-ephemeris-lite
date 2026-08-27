import type { CalendarMode, CalendarInput, CivilDate, CivilDateTime, ResolvedLunarDate, FourPillars, RatHourMode } from 'js-ephemeris-lite';
import type { AlmanacRuleInput, AlmanacRulesResult } from './rules.js';
export * from './rules.js';
export interface HuangliOptions {
  /** Fixed clock offset, in minutes, default +480. */
  utcOffsetMinutes?: number;
  /** Default next-day: 23:00 advances the effective day, not the display date. */
  ratHourMode?: RatHourMode;
  /** false: change on the assigned term day; true: on the astronomical instant.
   * Historical calendar mode always uses assigned days. */
  exactJieQiTime?: boolean;
  /** Default china-astronomical. Historical uses China-assigned civil dates. */
  mode?: CalendarMode;
  /** Nearest Jiazi anchor (default), or the assigned solstice day itself. */
  flyingStarMethod?: 'consecutive' | 'discontinuous';
  /** Year/month stars only; default solar. Day/hour stars still use solstices. */
  flyingStarBoundary?: 'solar' | 'lunar';
  /** Source rule option; defaults to true. */
  isYeargodDuty?: boolean;
}
export interface HuangliDayOptions {
  /** Local clock, default 12:00:00; fractional seconds are accepted. */
  hour?: number; minute?: number; second?: number;
  /** Explicit caller-provided rule flag. No unverified automatic date rule is invented. */
  isTuWangYongShi?: boolean;
  activityMask?: readonly number[];
}
export interface DutyGod { index: number; name: string; isHuangDao: boolean; }
export interface HuangliDay extends AlmanacRulesResult {
  solarDate: CivilDateTime & { offsetMinutes: number };
  lunarDate: ResolvedLunarDate; jdUT1: number; weekday: number;
  /** Effective day after the selected late-Zi rule; display dates stay unchanged. */
  ruleDate: CivilDate;
  ruleLunarDate: ResolvedLunarDate;
  /** Exact inputs passed to the pure evaluator, including a copied display mask. */
  ruleInput: AlmanacRuleInput;
  pillars: FourPillars; pillarNames: Record<'year'|'month'|'day'|'hour', string>;
  solarTerm: null | {name: string; jdTT: number; jdUT1: number; localTime: CivilDateTime & {offsetMinutes: number}; assignedDate: CivilDate};
  moonPhases: Array<{name: string; jdTT: number; jdUT1: number}>;
  mansion: {name: string; fullName: string; direction: string; isGood: boolean};
  festivals: string[]; flags: {isSiJue: boolean; isSiLi: boolean; isTuWangYongShi: boolean};
  dutyGod: DutyGod; pengZu: string; taiShen: string; godDirections: Record<string,string>;
  chongSha: {branch: string; animal: string; direction: string};
  hours: Array<DutyGod & {branch: number; branchName: string}>;
  flyingStars: {year: number[]; month: number[]; day: number[]; hour: number[]; forward: boolean};
  cycle: string; period: number; settings: Readonly<Required<HuangliOptions>>;
}
export const PALACE_DIRECTIONS: readonly string[];
export function createFlyingStarBoard(centerNumber: number, forward?: boolean): number[];
export function getThreeCyclesNinePeriods(year: number): {cycle: string; period: number};
export class HuangliCalendar {
  constructor(options?: HuangliOptions);
  readonly options: Readonly<Required<HuangliOptions>>;
  getDay(year: number, month: number, day: number, options?: HuangliDayOptions): HuangliDay;
  getMonth(year: number, month: number, options?: HuangliDayOptions): HuangliDay[];
  getYear(year: number, options?: HuangliDayOptions): HuangliDay[];
}
export function getHuangliDay(date: CalendarInput & HuangliDayOptions, options?: HuangliOptions): HuangliDay;

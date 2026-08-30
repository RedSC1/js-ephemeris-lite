import type { JulianTime, CalendarMode, CalendarInput, CivilDate, CivilDateTime, ResolvedLunarDate, FourPillars, RatHourMode, EventAccuracy } from 'js-ephemeris-lite';
import type { AlmanacRuleInput, AlmanacRulesResult } from './rules.js';
import type { HuangliLocale } from './locale.js';
export * from './locale.js';
export * from './rules.js';
export * from './feng-shui.js';
export interface HuangliOptions {
  /** Display-label locale; default zh-Hans. IDs and rule inputs never change. */
  locale?: HuangliLocale;
  /** Fixed clock offset, in minutes, default +480. */
  utcOffsetMinutes?: number;
  /** Default next-day: 23:00 advances the effective day, not the display date. */
  ratHourMode?: RatHourMode;
  /** false: change on the assigned term day; true: on the astronomical instant.
   * Historical calendar mode always uses assigned days. */
  exactJieQiTime?: boolean;
  /** Default china-astronomical. Historical uses China-assigned civil dates. */
  mode?: CalendarMode;
  /** Event solver owned by this calendar instance; default mid. */
  eventAccuracy?: EventAccuracy;
  /** Nearest Jiazi anchor (default), or the assigned solstice day itself. */
  flyingStarMethod?: 'consecutive' | 'discontinuous';
  /** Year/month stars only; default solar. Day/hour stars still use solstices. */
  flyingStarBoundary?: 'solar' | 'lunar';
  /** Source rule option; defaults to true. */
  isYeargodDuty?: boolean;
  /** Default: the 18 assigned days before each season start. */
  tuWangMethod?: 'four-seasons-18-days' | 'manual';
  /** major: principal holidays; common (default): broadly relevant Chinese and
   * international observances; all: the complete Shou Xing festival table. */
  festivalMode?: 'major' | 'common' | 'all';
}
export interface HuangliDayOptions {
  /** Local clock, default 12:00:00; fractional seconds are accepted. */
  hour?: number; minute?: number; second?: number;
  /** Override the automatic TuWang result for this query. */
  isTuWangYongShi?: boolean;
  activityMask?: readonly number[];
}
export interface DutyGod { index: number; name: string; isHuangDao: boolean; }
export type FestivalLevel = 'statutory' | 'traditional' | 'popular' | 'commemorative' | 'historical' | 'ethnic';
export type FestivalSource = 'solar' | 'lunar' | 'weekBased' | 'termBased' | 'custom';
export type FestivalCalendarDisplay = 'primary' | 'secondary' | 'detail';
export interface FestivalDetail {
  /** Formal normalized name. */
  name: string;
  /** Compact calendar-cell label. */
  shortName: string;
  level: FestivalLevel;
  /** Month-grid density inherited from sxwnl: primary/secondary are shown;
   * detail remains available in the selected day's full festival list. */
  calendarDisplay: FestivalCalendarDisplay;
  source: FestivalSource;
  isPublicHoliday: boolean;
  /** Alternative and source-table names. */
  aliases: string[];
}
export interface TuWangPeriod {
  seasonStart: string;
  startDate: CivilDate;
  endDateExclusive: CivilDate;
}
export interface TuWangStatus extends TuWangPeriod {
  active: boolean;
  source: 'calendar' | 'override' | 'manual';
}
export interface HuangliHour extends DutyGod {
  branch: number; branchName: string;
  dayPillar: number; pillar: number; pillarName: string;
  nayinId: number; nayin: string; nayinElement: string;
  startHour: number; endHour: number; timeRange: string;
}
export interface HuangliHourPeriod extends HuangliHour {
  segment: 'early-zi' | 'hour' | 'late-zi';
  startTime: CivilDateTime & { offsetMinutes: number };
  endTime: CivilDateTime & { offsetMinutes: number };
  startJdUT1: number; endJdUT1: number;
  /** Hour board sampled at startTime. */
  flyingStars: number[];
  forward: boolean;
}
export interface HuangliDay extends AlmanacRulesResult {
  solarDate: CivilDateTime & { offsetMinutes: number };
  lunarDate: ResolvedLunarDate; jdUT1: number; weekday: number;
  /** Effective day after the selected late-Zi rule; display dates stay unchanged. */
  ruleDate: CivilDate;
  ruleLunarDate: ResolvedLunarDate;
  /** Exact inputs passed to the pure evaluator, including a copied display mask. */
  ruleInput: AlmanacRuleInput;
  pillars: FourPillars; pillarNames: Record<'year'|'month'|'day'|'hour', string>;
  solarTerm: null | {name: string; time: JulianTime; localTime: CivilDateTime & {offsetMinutes: number}; assignedDate: CivilDate};
  moonPhases: Array<{name: string; time: JulianTime}>;
  mansion: {name: string; fullName: string; direction: string; isGood: boolean};
  /** Normalized names in the same order as festivalDetails. */
  festivals: string[];
  festivalDetails: FestivalDetail[];
  flags: {isSiJue: boolean; isSiLi: boolean; isTuWangYongShi: boolean};
  tuWangYongShi: TuWangStatus;
  dutyGod: DutyGod; pengZu: string; taiShen: string; godDirections: Record<string,string>;
  chongSha: {branch: string; animal: string; direction: string};
  hours: HuangliHour[];
  flyingStars: {year: number[]; month: number[]; day: number[]; hour: number[]; forward: boolean};
  cycle: string; period: number; settings: Readonly<Required<HuangliOptions>>;
}
export class HuangliCalendar {
  constructor(options?: HuangliOptions);
  readonly options: Readonly<Required<HuangliOptions>>;
  getDay(year: number, month: number, day: number, options?: HuangliDayOptions): HuangliDay;
  getMonth(year: number, month: number, options?: HuangliDayOptions): HuangliDay[];
  getYear(year: number, options?: HuangliDayOptions): HuangliDay[];
  getTuWangPeriods(year: number): TuWangPeriod[];
  /** 13 civil-day intervals, splitting Zi at midnight. */
  getHours(year: number, month: number, day: number): HuangliHourPeriod[];
}
export function getHuangliDay(date: CalendarInput & HuangliDayOptions, options?: HuangliOptions): HuangliDay;

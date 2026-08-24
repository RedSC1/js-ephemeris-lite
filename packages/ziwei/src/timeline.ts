import {
  MONTH_NAME,
  RAT_HOUR_MODE,
  calculateChineseCalendarYear,
  calculateDayPillar,
  calendarDateFromJulianDay,
  ganzhiBranch,
  ganzhiStem,
  getHourGanzhi,
  getNextJie,
  julianDay,
  type LunarMonth,
} from 'js-ephemeris-lite';
import type { ZiweiChart } from './chart.js';
import {
  getEffectiveBirthYear,
  getStartDecadeYear,
  makeChildhoodDecade,
  makeDecadeByIndex,
  makeDecadeForYear,
  makeFlowMonth,
  makeFlowMonthFromBuildingBranch,
  makeFlowYear,
} from './limits.js';
import { PILLAR_BOUNDARY } from './types.js';

export interface ChildhoodNode {
  readonly age: number;
  readonly year: number;
  readonly stem: number;
  readonly branch: number;
}

export interface DecadeNode {
  readonly index: number;
  readonly startAge: number;
  readonly endAge: number;
  readonly startYear: number;
  readonly endYear: number;
  readonly stem: number;
  readonly branch: number;
}

export interface YearNode {
  readonly year: number;
  readonly stem: number;
  readonly branch: number;
}

export interface MonthNode {
  readonly month: number;
  readonly sequence: number;
  readonly monthName: number;
  readonly displayLabel: string;
  readonly isLeap: boolean;
  readonly monthBuildingBranch: number;
  readonly stem: number;
  readonly branch: number;
  readonly solarStartJd: number;
  readonly solarEndJdExclusive: number;
  readonly firstCivilDayNumber: number;
  readonly dayCount: number;
}

export interface DayNode {
  readonly day: number;
  readonly stem: number;
  readonly branch: number;
  readonly solarDate: Readonly<{ year: number; month: number; day: number }>;
}

export interface HourNode {
  /** 0..11, or 12 for the separately displayed late-Zi slot. */
  readonly hourIndex: number;
  readonly branchIndex: number;
  readonly label: string;
  readonly stem: number;
  readonly branch: number;
  readonly isEarlyRat: boolean;
  readonly isLateRat: boolean;
}

export interface TimelineManifest {
  readonly childhoods: readonly ChildhoodNode[];
  readonly decades: readonly DecadeNode[];
  readonly currentDecadeYears?: readonly YearNode[];
  readonly currentYearMonths?: readonly MonthNode[];
  readonly currentMonthDays?: readonly DayNode[];
  readonly currentDayHours?: readonly HourNode[];
}

const MONTH_LABELS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

function dateOnly(jd: number): Readonly<{ year: number; month: number; day: number }> {
  const value = calendarDateFromJulianDay(jd);
  return Object.freeze({ year: value.year, month: value.month, day: value.day });
}

function monthLabel(month: number, monthName: number, isLeap: boolean): string {
  if (monthName === MONTH_NAME.THIRTEEN) return '十三月';
  if (monthName === MONTH_NAME.LATER_NINE) return '后九月';
  if (monthName === MONTH_NAME.ALT_TWELVE) return '拾贰月';
  if (monthName === MONTH_NAME.ALT_ONE) return '改正月';
  if (monthName === MONTH_NAME.LATER_SAME_NAME) return `后${MONTH_LABELS[month - 1] ?? month}月`;
  return `${isLeap ? '闰' : ''}${MONTH_LABELS[month - 1] ?? month}月`;
}

function collectLunarYearMonths(chart: ZiweiChart, targetYear: number): LunarMonth[] {
  const byFirstDay = new Map<number, LunarMonth>();
  for (const probeYear of [targetYear - 1, targetYear, targetYear + 1]) {
    const jd = julianDay({ year: probeYear, month: 6, day: 1, hour: 12 });
    const window = calculateChineseCalendarYear(jd, chart.options.toCalendarOptions());
    for (const month of window.months) {
      if (month.lunarYear !== targetYear) continue;
      byFirstDay.set(month.firstCivilDayNumber, month);
    }
  }
  return [...byFirstDay.values()].sort((a, b) => a.firstCivilDayNumber - b.firstCivilDayNumber);
}

function findLiChun(chart: ZiweiChart, targetYear: number): number {
  let cursor = julianDay({ year: targetYear - 1, month: 11, day: 1, hour: 12 });
  for (let guard = 0; guard < 40; guard += 1) {
    const next = getNextJie(cursor, chart.options.toCalendarOptions());
    if (next.indexFromWinterSolstice === 3) return next.jdUT1;
    cursor = next.jdUT1 + 2;
  }
  throw new Error(`Li Chun not found for ${targetYear}`);
}

export class ZiweiTimelineProvider {
  readonly chart: ZiweiChart;

  constructor(chart: ZiweiChart) {
    this.chart = chart;
  }

  getDecades(count = 12): readonly DecadeNode[] {
    const birthYear = getEffectiveBirthYear(this.chart);
    return Object.freeze(Array.from({ length: count }, (_, offset) => {
      const value = makeDecadeByIndex(this.chart, birthYear, offset + 1);
      return Object.freeze({
        index: value.index,
        startAge: value.startAge,
        endAge: value.endAge,
        startYear: value.startYear,
        endYear: value.endYear,
        stem: value.limit.coordinate.stem,
        branch: value.limit.coordinate.branch,
      });
    }));
  }

  getChildhood(): readonly ChildhoodNode[] {
    const birthYear = getEffectiveBirthYear(this.chart);
    const count = getStartDecadeYear(this.chart, birthYear) - birthYear;
    return Object.freeze(Array.from({ length: count }, (_, offset) => {
      const value = makeChildhoodDecade(this.chart, birthYear, birthYear + offset);
      return Object.freeze({
        age: offset + 1,
        year: birthYear + offset,
        stem: value.limit.coordinate.stem,
        branch: value.limit.coordinate.branch,
      });
    }));
  }

  getYears(decadeIndex: number): readonly YearNode[] {
    if (!Number.isInteger(decadeIndex) || decadeIndex < 1) throw new RangeError('decadeIndex must be >= 1');
    const birthYear = getEffectiveBirthYear(this.chart);
    const start = getStartDecadeYear(this.chart, birthYear) + (decadeIndex - 1) * 10;
    return Object.freeze(Array.from({ length: 10 }, (_, offset) => {
      const value = makeFlowYear(this.chart, start + offset);
      return Object.freeze({
        year: value.year,
        stem: value.limit.coordinate.stem,
        branch: value.limit.coordinate.branch,
      });
    }));
  }

  getMonths(targetYear: number): readonly MonthNode[] {
    if (this.chart.options.flowLimitBoundary === PILLAR_BOUNDARY.SOLAR_TERM) {
      return this.getSolarTermMonths(targetYear);
    }
    return Object.freeze(collectLunarYearMonths(this.chart, targetYear).map((month, index) => {
      const overflow = index + 1 > 13;
      const sequence = Math.min(index + 1, 13);
      const logicalMonth = overflow ? 12 : month.month === 13 ? 12 : month.month;
      const isLeap = overflow || month.isLeap;
      const flow = makeFlowMonthFromBuildingBranch(
        this.chart,
        targetYear,
        logicalMonth,
        sequence,
        isLeap,
        month.monthBuildingBranch,
      );
      return Object.freeze({
        month: logicalMonth,
        sequence,
        monthName: month.monthName,
        displayLabel: monthLabel(month.month, month.monthName, isLeap),
        isLeap,
        monthBuildingBranch: month.monthBuildingBranch,
        stem: flow.limit.coordinate.stem,
        branch: flow.limit.coordinate.branch,
        solarStartJd: month.firstCivilDayNumber - 0.5,
        solarEndJdExclusive: month.firstCivilDayNumber + month.dayCount - 0.5,
        firstCivilDayNumber: month.firstCivilDayNumber,
        dayCount: month.dayCount,
      });
    }));
  }

  private getSolarTermMonths(targetYear: number): readonly MonthNode[] {
    const starts = [findLiChun(this.chart, targetYear)];
    for (let index = 0; index < 12; index += 1) {
      starts.push(getNextJie(starts.at(-1)! + 2, this.chart.options.toCalendarOptions()).jdUT1);
    }
    return Object.freeze(Array.from({ length: 12 }, (_, offset) => {
      const month = offset + 1;
      const flow = makeFlowMonth(this.chart, targetYear, month);
      const startDay = Math.floor(starts[offset]! + this.chart.options.utcOffsetMinutes / 1440 + 0.5);
      const endDay = Math.floor(starts[offset + 1]! + this.chart.options.utcOffsetMinutes / 1440 + 0.5);
      return Object.freeze({
        month,
        sequence: month,
        monthName: MONTH_NAME.NORMAL,
        displayLabel: `${MONTH_LABELS[offset]}月`,
        isLeap: false,
        monthBuildingBranch: (month + 1) % 12,
        stem: flow.limit.coordinate.stem,
        branch: flow.limit.coordinate.branch,
        solarStartJd: starts[offset]!,
        solarEndJdExclusive: starts[offset + 1]!,
        firstCivilDayNumber: startDay,
        dayCount: endDay - startDay,
      });
    }));
  }

  getDays(targetYear: number, month: number, isLeap = false): readonly DayNode[] {
    const target = this.getMonths(targetYear).find((value) => value.month === month && value.isLeap === isLeap);
    if (target === undefined) return Object.freeze([]);
    return Object.freeze(Array.from({ length: target.dayCount }, (_, offset) => {
      const solarDate = dateOnly(target.firstCivilDayNumber - 0.5 + offset);
      const physical = calculateDayPillar(solarDate);
      return Object.freeze({
        day: offset + 1,
        stem: ganzhiStem(physical),
        branch: ganzhiBranch(physical),
        solarDate,
      });
    }));
  }

  getHours(dayPillar: number): readonly HourNode[] {
    const split = this.chart.options.ratHourMode !== RAT_HOUR_MODE.NEXT_DAY;
    const result: HourNode[] = [];
    if (split) {
      const value = getHourGanzhi(ganzhiStem(dayPillar), 0);
      result.push(Object.freeze({
        hourIndex: 0,
        branchIndex: 0,
        label: '早子',
        stem: ganzhiStem(value),
        branch: 0,
        isEarlyRat: true,
        isLateRat: false,
      }));
    }
    for (let branch = split ? 1 : 0; branch < 12; branch += 1) {
      const value = getHourGanzhi(ganzhiStem(dayPillar), branch);
      result.push(Object.freeze({
        hourIndex: branch,
        branchIndex: branch,
        label: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][branch]!,
        stem: ganzhiStem(value),
        branch,
        isEarlyRat: false,
        isLateRat: false,
      }));
    }
    if (split) {
      const dayStem = ganzhiStem(dayPillar);
      const lateStem = this.chart.options.ratHourMode === RAT_HOUR_MODE.CURRENT_DAY_TOMORROW_STEM
        ? (dayStem + 1) % 10
        : dayStem;
      const value = getHourGanzhi(lateStem, 0);
      result.push(Object.freeze({
        hourIndex: 12,
        branchIndex: 0,
        label: '晚子',
        stem: ganzhiStem(value),
        branch: 0,
        isEarlyRat: false,
        isLateRat: true,
      }));
    }
    return Object.freeze(result);
  }

  getManifest(input: {
    year?: number;
    decadeIndex?: number;
    month?: number;
    isLeap?: boolean;
    day?: number;
  } = {}): TimelineManifest {
    let decadeIndex = input.decadeIndex;
    if (decadeIndex === undefined && input.year !== undefined) {
      decadeIndex = makeDecadeForYear(
        this.chart,
        getEffectiveBirthYear(this.chart),
        input.year,
      ).index;
    }
    const years = decadeIndex === undefined
      ? undefined
      : decadeIndex === 0 && input.year !== undefined
        ? Object.freeze([(() => {
          const flow = makeFlowYear(this.chart, input.year!);
          return Object.freeze({ year: input.year!, stem: flow.limit.coordinate.stem, branch: flow.limit.coordinate.branch });
        })()])
        : this.getYears(decadeIndex);
    const months = input.year === undefined ? undefined : this.getMonths(input.year);
    const days = input.year === undefined || input.month === undefined
      ? undefined
      : this.getDays(input.year, input.month, input.isLeap ?? false);
    const targetDay = input.day === undefined ? undefined : days?.[input.day - 1];
    const hours = targetDay === undefined
      ? undefined
      : this.getHours(calculateDayPillar(targetDay.solarDate));
    return Object.freeze({
      childhoods: this.getChildhood(),
      decades: this.getDecades(),
      ...(years === undefined ? {} : { currentDecadeYears: years }),
      ...(months === undefined ? {} : { currentYearMonths: months }),
      ...(days === undefined ? {} : { currentMonthDays: days }),
      ...(hours === undefined ? {} : { currentDayHours: hours }),
    });
  }
}

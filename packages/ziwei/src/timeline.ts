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
import { LEAP_MONTH_STRATEGY, PILLAR_BOUNDARY, advanceBranch } from './types.js';

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
  /** Calendar-labelled source year; may differ from effectiveYear for a carried segment. */
  readonly lunarYear: number;
  readonly month: number;
  readonly sequence: number;
  readonly effectiveMonth: number;
  readonly effectiveYear: number;
  readonly dayStart: number;
  readonly dayEnd: number;
  readonly monthName: number;
  readonly displayLabel: string;
  readonly isLeap: boolean;
  readonly monthBuildingBranch: number;
  readonly stem: number;
  /** Flow-month Life Palace branch. */
  readonly branch: number;
  /** Month branch used only for the displayed month Ganzhi label. */
  readonly displayBranch: number;
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

function monthSegments(
  chart: ZiweiChart,
  effectiveBaseYear: number,
  logicalMonth: number,
  isLeap: boolean,
  dayCount: number,
  monthName: number,
): readonly Readonly<{ effectiveYear: number; effectiveMonth: number; dayStart: number; dayEnd: number }>[] {
  if (!isLeap) return Object.freeze([{
    effectiveYear: effectiveBaseYear, effectiveMonth: logicalMonth, dayStart: 1, dayEnd: dayCount,
  }]);
  const isLaterNine = monthName === MONTH_NAME.LATER_NINE;
  const nextMonth = isLaterNine ? 10 : logicalMonth % 12 + 1;
  const nextYear = logicalMonth === 12 || isLaterNine
    ? effectiveBaseYear + 1
    : effectiveBaseYear;
  if (chart.options.leapMonthStrategy === LEAP_MONTH_STRATEGY.AS_NEXT) {
    return Object.freeze([{
      effectiveYear: nextYear, effectiveMonth: nextMonth, dayStart: 1, dayEnd: dayCount,
    }]);
  }
  if (chart.options.leapMonthStrategy === LEAP_MONTH_STRATEGY.SPLIT_AFTER_FIFTEENTH && dayCount > 15) {
    return Object.freeze([
      Object.freeze({ effectiveYear: effectiveBaseYear, effectiveMonth: logicalMonth, dayStart: 1, dayEnd: 15 }),
      Object.freeze({ effectiveYear: nextYear, effectiveMonth: nextMonth, dayStart: 16, dayEnd: dayCount }),
    ]);
  }
  return Object.freeze([{
    effectiveYear: effectiveBaseYear, effectiveMonth: logicalMonth, dayStart: 1, dayEnd: dayCount,
  }]);
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
    // Calendar source labels can straddle a historical reform. Build a
    // chronological pool first, then number months inside historicalYear.
    // This avoids merging two historical years merely because they share the
    // same source lunarYear label at a reform boundary.
    const rawByFirstDay = new Map<number, LunarMonth>();
    for (const lunarYear of [targetYear - 2, targetYear - 1, targetYear]) {
      try {
        for (const month of collectLunarYearMonths(this.chart, lunarYear)) {
          if (!rawByFirstDay.has(month.firstCivilDayNumber)) {
            rawByFirstDay.set(month.firstCivilDayNumber, month);
          }
        }
      } catch (error) {
        if (lunarYear === targetYear) throw error;
        continue;
      }
    }
    const rawMonths = [...rawByFirstDay.values()]
      .sort((left, right) => left.firstCivilDayNumber - right.firstCivilDayNumber);
    const sequenceByFirstDay = new Map<number, number>();
    for (const historicalYear of new Set(rawMonths.map((month) => month.historicalYear))) {
      rawMonths
        .filter((month) => month.historicalYear === historicalYear)
        .forEach((month, index) => sequenceByFirstDay.set(month.firstCivilDayNumber, index + 1));
    }
    const nodes = rawMonths.flatMap((month) => {
      const sequence = sequenceByFirstDay.get(month.firstCivilDayNumber)!;
      const logicalMonth = month.month === 13 ? 12 : month.month;
      const isLeap = month.isLeap;
      return monthSegments(
        this.chart,
        month.historicalYear,
        logicalMonth,
        isLeap,
        month.dayCount,
        month.monthName,
      ).map((segment) => {
          const segmentDayCount = segment.dayEnd - segment.dayStart + 1;
          const segmentFirstDay = month.firstCivilDayNumber + segment.dayStart - 1;
          const flow = makeFlowMonthFromBuildingBranch(
            this.chart,
            month.lunarYear,
            logicalMonth,
            sequence,
            isLeap,
            month.monthBuildingBranch,
            segment.dayStart,
            segment.effectiveMonth,
            segment.effectiveYear,
            month.monthName,
          );
          return Object.freeze({
            lunarYear: month.lunarYear,
            month: logicalMonth,
            sequence,
            effectiveMonth: flow.effectiveMonth,
            effectiveYear: flow.effectiveYear,
            dayStart: segment.dayStart,
            dayEnd: segment.dayEnd,
            monthName: month.monthName,
            displayLabel: monthLabel(month.month, month.monthName, isLeap),
            isLeap,
            monthBuildingBranch: month.monthBuildingBranch,
            stem: flow.limit.coordinate.stem,
            branch: flow.limit.coordinate.branch,
            displayBranch: advanceBranch(2, flow.effectiveMonth - 1),
            solarStartJd: segmentFirstDay - 0.5,
            solarEndJdExclusive: segmentFirstDay + segmentDayCount - 0.5,
            firstCivilDayNumber: segmentFirstDay,
            dayCount: segmentDayCount,
          });
      });
    }).filter((node) => node.effectiveYear === targetYear)
      .sort((left, right) => left.firstCivilDayNumber - right.firstCivilDayNumber);
    return Object.freeze(nodes);
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
        lunarYear: targetYear,
        month,
        sequence: month,
        effectiveMonth: flow.effectiveMonth,
        effectiveYear: flow.effectiveYear,
        dayStart: 1,
        dayEnd: endDay - startDay,
        monthName: MONTH_NAME.NORMAL,
        displayLabel: `${MONTH_LABELS[offset]}月`,
        isLeap: false,
        monthBuildingBranch: (month + 1) % 12,
        stem: flow.limit.coordinate.stem,
        branch: flow.limit.coordinate.branch,
        displayBranch: advanceBranch(2, flow.effectiveMonth - 1),
        solarStartJd: starts[offset]!,
        solarEndJdExclusive: starts[offset + 1]!,
        firstCivilDayNumber: startDay,
        dayCount: endDay - startDay,
      });
    }));
  }

  getDays(
    targetYear: number,
    month: number,
    isLeap = false,
    effectiveMonth?: number,
    effectiveYear?: number,
  ): readonly DayNode[] {
    const target = this.getMonths(targetYear).find((value) => value.month === month
      && value.isLeap === isLeap
      && (effectiveMonth === undefined || value.effectiveMonth === effectiveMonth)
      && (effectiveYear === undefined || value.effectiveYear === effectiveYear));
    if (target === undefined) return Object.freeze([]);
    return Object.freeze(Array.from({ length: target.dayCount }, (_, offset) => {
      const solarDate = dateOnly(target.firstCivilDayNumber - 0.5 + offset);
      const physical = calculateDayPillar(solarDate);
      return Object.freeze({
        day: target.dayStart + offset,
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
    effectiveMonth?: number;
    effectiveYear?: number;
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
      : this.getDays(input.year, input.month, input.isLeap ?? false, input.effectiveMonth, input.effectiveYear);
    const targetDay = input.day === undefined ? undefined : days?.find((value) => value.day === input.day);
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

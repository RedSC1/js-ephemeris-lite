import {
  RAT_HOUR_MODE,
  calculateChineseCalendarYear,
  calculateFourPillars,
  calendarDateFromJulianDay,
  ganzhiBranch,
  ganzhiStem,
  julianDay,
  lunarToSolar,
  normalizeChartVirtualTime,
  type CivilDateTime,
  type LunarMonth,
  type LunarMonthName,
  type Ut1Input,
  type ZonedTime,
} from 'js-ephemeris-lite';
import { resolveZiweiLogicalLunarDate, resolveZiweiVirtualTime, solarDayFromPreviousJie } from './calendar.js';
import type { ZiweiChart } from './chart.js';
import { ZiweiDynamicChart, makeFlowLayer, makeSmallLimitLayer } from './flow.js';
import {
  getEffectiveBirthYear,
  makeDecadeForYear,
  makeFlowDay,
  makeFlowHourFromPillar,
  makeFlowMonth,
  makeFlowMonthFromBuildingBranch,
  makeFlowYear,
  makeSmallLimit,
  type DecadeLimit,
  type FlowDayLimit,
  type FlowHourLimit,
  type FlowMonthLimit,
  type FlowYearLimit,
  type SmallLimit,
} from './limits.js';
import {
  FLOW_LEVEL,
  PILLAR_BOUNDARY,
  RAT_HOUR_SEGMENT,
  type FlowLevel,
  type PillarBoundary,
  type RatHourSegment,
} from './types.js';

export interface ResolvedFlowMonthMetadata {
  /** Historical ganzhi year used by annual Ziwei limits. */
  readonly effectiveBaseYear: number;
  readonly logicalMonth: number;
  readonly sequence: number;
  readonly isLeap: boolean;
  readonly monthName: LunarMonthName;
  readonly monthBuildingBranch: number;
  readonly firstCivilDayNumber: number;
  readonly dayCount: number;
}

export interface ZiweiFlowTarget {
  readonly jdUT1: number;
  readonly virtualTime: Readonly<CivilDateTime>;
}

export interface ResolvedZiweiFlow {
  readonly effectiveBirthYear: number;
  readonly effectiveTargetYear: number;
  readonly targetMonth: number;
  readonly targetMonthSequence: number;
  readonly targetMonthBuildingBranch: number;
  readonly targetDay: number;
  readonly targetHourIndex: number;
  readonly targetRatHourSegment: RatHourSegment;
  readonly targetMonthIsLeap: boolean;
  readonly decade: DecadeLimit;
  readonly smallLimit: SmallLimit;
  readonly year: FlowYearLimit;
  readonly month: FlowMonthLimit;
  readonly day: FlowDayLimit;
  readonly hour: FlowHourLimit;
}

function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function sameMonth(month: LunarMonth, lunar: {
  year: number;
  month: number;
  isLeap: boolean;
  monthName: LunarMonthName;
}): boolean {
  return month.lunarYear === lunar.year
    && month.month === lunar.month
    && month.isLeap === lunar.isLeap
    && month.monthName === lunar.monthName;
}

function collectNearbyMonths(
  jdUT1: number,
  chart: ZiweiChart,
  targetLunar: Parameters<typeof sameMonth>[1],
): LunarMonth[] {
  const byFirstDay = new Map<number, LunarMonth>();
  for (const offset of [0, -220, 220]) {
    const window = calculateChineseCalendarYear(jdUT1 + offset, chart.options.toCalendarOptions());
    for (const month of window.months) {
      const prior = byFirstDay.get(month.firstCivilDayNumber);
      // Historical reform windows can describe the same physical first day
      // with different labelled identities. Prefer the identity obtained from
      // the target date instead of whichever overlapping year window happened
      // to be visited first.
      if (prior === undefined || (!sameMonth(prior, targetLunar) && sameMonth(month, targetLunar))) {
        byFirstDay.set(month.firstCivilDayNumber, month);
      }
    }
  }
  return [...byFirstDay.values()].sort((a, b) => a.firstCivilDayNumber - b.firstCivilDayNumber);
}

export function resolveLunarFlowMonthMetadata(
  chart: ZiweiChart,
  targetJdUT1: number,
  lunar: { readonly year: number; readonly month: number; readonly isLeap: boolean; readonly monthName: LunarMonthName },
): ResolvedFlowMonthMetadata {
  const firstSolar = lunarToSolar({
    year: lunar.year,
    month: lunar.month,
    day: 1,
    isLeap: lunar.isLeap,
    monthName: lunar.monthName,
  }, chart.options.toCalendarOptions());
  const firstDay = Math.floor(julianDay(firstSolar) + 0.5);
  const months = collectNearbyMonths(targetJdUT1, chart, lunar);
  const targetIndex = months.findIndex((month) => month.firstCivilDayNumber === firstDay && sameMonth(month, lunar));
  if (targetIndex < 0) throw new Error('target lunar month is absent from nearby calendar windows');
  const target = months[targetIndex]!;
  const historicalMonths = months
    .filter((month) => month.historicalYear === target.historicalYear)
    .sort((left, right) => left.firstCivilDayNumber - right.firstCivilDayNumber);
  const sequence = historicalMonths.findIndex((month) => month.firstCivilDayNumber === target.firstCivilDayNumber) + 1;
  if (sequence < 1) throw new Error('target lunar month is absent from its historical year');
  return Object.freeze({
    effectiveBaseYear: target.historicalYear,
    logicalMonth: lunar.month === 13 ? 12 : lunar.month,
    sequence,
    isLeap: lunar.isLeap,
    monthName: lunar.monthName,
    monthBuildingBranch: target.monthBuildingBranch,
    firstCivilDayNumber: target.firstCivilDayNumber,
    dayCount: target.dayCount,
  });
}

function effectiveSolarYear(civilYear: number, pillarYear: number): number {
  const branch = ganzhiBranch(pillarYear);
  if (mod(civilYear + 8, 12) === branch) return civilYear;
  if (mod(civilYear + 7, 12) === branch) return civilYear - 1;
  throw new Error('solar-term year pillar is inconsistent with target clock');
}

function ratHourSegment(virtualTime: CivilDateTime, mode: string, hourBranch: number): RatHourSegment {
  if (hourBranch !== 0) return RAT_HOUR_SEGMENT.NONE;
  if (mode === RAT_HOUR_MODE.NEXT_DAY) return RAT_HOUR_SEGMENT.UNIFIED;
  return virtualTime.hour >= 23 ? RAT_HOUR_SEGMENT.LATE : RAT_HOUR_SEGMENT.EARLY;
}

export function resolveZiweiFlowFromInstant(
  chart: ZiweiChart,
  targetInstant: Ut1Input,
  targetVirtualTime: CivilDateTime,
  boundary: PillarBoundary = chart.options.flowLimitBoundary,
): ResolvedZiweiFlow {
  const jdUT1 = typeof targetInstant === 'number' ? targetInstant : targetInstant.jdUT1;
  if (jdUT1 < chart.facts.jdUT1) throw new RangeError('target instant precedes birth instant');
  const normalizedTargetVirtualTime = normalizeChartVirtualTime(targetVirtualTime);
  const targetPillars = calculateFourPillars(jdUT1, normalizedTargetVirtualTime, {
    ...chart.options.toCalendarOptions(),
    pillarHistoricalMode: chart.options.pillarHistoricalMode,
    ratHourMode: chart.options.ratHourMode,
  });
  const effectiveBirthYear = getEffectiveBirthYear(chart, boundary);
  let effectiveTargetYear: number;
  let targetMonth: number;
  let targetMonthSequence: number;
  let targetMonthBuildingBranch: number;
  let targetMonthIsLeap: boolean;
  let targetMonthName: number;
  let targetMonthEffectiveBaseYear: number;
  let targetDay: number;

  if (boundary === PILLAR_BOUNDARY.LUNAR) {
    const lunar = resolveZiweiLogicalLunarDate(normalizedTargetVirtualTime, chart.options);
    const metadata = resolveLunarFlowMonthMetadata(chart, jdUT1, lunar);
    effectiveTargetYear = lunar.year;
    targetMonth = metadata.logicalMonth;
    targetMonthSequence = metadata.sequence;
    targetMonthBuildingBranch = metadata.monthBuildingBranch;
    targetMonthIsLeap = metadata.isLeap;
    targetMonthName = metadata.monthName;
    targetMonthEffectiveBaseYear = metadata.effectiveBaseYear;
    targetDay = lunar.day;
  } else {
    effectiveTargetYear = effectiveSolarYear(normalizedTargetVirtualTime.year, targetPillars.year);
    targetMonthBuildingBranch = ganzhiBranch(targetPillars.month);
    targetMonth = mod(targetMonthBuildingBranch - 2, 12) + 1;
    targetMonthSequence = targetMonth;
    targetMonthIsLeap = false;
    targetMonthName = 0;
    targetMonthEffectiveBaseYear = effectiveTargetYear;
    targetDay = solarDayFromPreviousJie(jdUT1, normalizedTargetVirtualTime, chart.options);
  }
  const targetHourIndex = ganzhiBranch(targetPillars.hour);
  const targetRatHourSegment = ratHourSegment(
    normalizedTargetVirtualTime,
    chart.options.ratHourMode,
    targetHourIndex,
  );
  const month = boundary === PILLAR_BOUNDARY.LUNAR
    ? makeFlowMonthFromBuildingBranch(
      chart,
      effectiveTargetYear,
      targetMonth,
      targetMonthSequence,
      targetMonthIsLeap,
      targetMonthBuildingBranch,
      targetDay,
      undefined,
      undefined,
      targetMonthName,
      targetMonthEffectiveBaseYear,
    )
    : makeFlowMonth(
      chart,
      effectiveTargetYear,
      targetMonth,
      targetMonthSequence,
      false,
    );
  const effectiveFlowYear = month.effectiveYear;
  const virtualAge = effectiveFlowYear - effectiveBirthYear + 1;
  if (virtualAge < 1) throw new RangeError('target precedes the effective birth year');
  const decade = makeDecadeForYear(chart, effectiveBirthYear, effectiveFlowYear);
  const smallLimit = makeSmallLimit(
    chart,
    ganzhiBranch(chart.facts.solarTermPillars.year),
    virtualAge,
  );
  const year = makeFlowYear(chart, effectiveFlowYear);
  const day = makeFlowDay(chart, month, targetDay, ganzhiStem(targetPillars.day));
  const hour = makeFlowHourFromPillar(chart, day, targetPillars.hour, targetRatHourSegment);
  return Object.freeze({
    effectiveBirthYear,
    effectiveTargetYear: effectiveFlowYear,
    targetMonth,
    targetMonthSequence,
    targetMonthBuildingBranch,
    targetDay,
    targetHourIndex,
    targetRatHourSegment,
    targetMonthIsLeap,
    decade,
    smallLimit,
    year,
    month,
    day,
    hour,
  });
}

export function resolveZiweiFlow(
  chart: ZiweiChart,
  target: ZonedTime,
  boundary: PillarBoundary = chart.options.flowLimitBoundary,
): ResolvedZiweiFlow {
  return resolveZiweiFlowFromInstant(
    chart,
    target.toJulianTime(),
    resolveZiweiVirtualTime(target, chart.options),
    boundary,
  );
}

export function dynamicChartFromResolvedFlow(
  chart: ZiweiChart,
  flow: ResolvedZiweiFlow,
  deepestLevel: FlowLevel = FLOW_LEVEL.HOUR,
): ZiweiDynamicChart {
  const coordinates = [
    flow.decade.limit.coordinate,
    flow.year.limit.coordinate,
    flow.month.limit.coordinate,
    flow.day.limit.coordinate,
    flow.hour.limit.coordinate,
  ];
  let dynamic = new ZiweiDynamicChart(chart).withSmallLimit(
    makeSmallLimitLayer(chart, flow.smallLimit.coordinate),
  );
  for (let level = FLOW_LEVEL.DECADE; level <= deepestLevel; level += 1) {
    dynamic = dynamic.push(makeFlowLayer(chart, level as FlowLevel, coordinates[level]!));
  }
  return dynamic;
}

export function dynamicChartForTime(
  chart: ZiweiChart,
  target: ZonedTime,
  deepestLevel: FlowLevel = FLOW_LEVEL.HOUR,
): { readonly chart: ZiweiDynamicChart; readonly flow: ResolvedZiweiFlow } {
  const flow = resolveZiweiFlow(chart, target);
  return Object.freeze({ chart: dynamicChartFromResolvedFlow(chart, flow, deepestLevel), flow });
}

function frozenClock(value: CivilDateTime): Readonly<CivilDateTime> {
  return Object.freeze({ ...value });
}

/** Step one logical hour while preserving the position inside the chart clock. */
export function stepZiweiFlowHourTarget(
  current: ZiweiFlowTarget,
  ratHourMode: string,
  direction: -1 | 1,
): ZiweiFlowTarget & { readonly ratHourSegment: RatHourSegment } {
  if (direction !== -1 && direction !== 1) throw new RangeError('direction must be -1 or 1');
  const currentVirtualTime = normalizeChartVirtualTime(current.virtualTime);
  const split = ratHourMode !== RAT_HOUR_MODE.NEXT_DAY;
  const oneHourStep = split && (direction > 0
    ? currentVirtualTime.hour >= 22 || currentVirtualTime.hour < 1
    : currentVirtualTime.hour >= 23 || currentVirtualTime.hour < 2);
  const stepHours = direction * (oneHourStep ? 1 : 2);
  const unwrappedHour = currentVirtualTime.hour + stepHours;
  const dayShift = Math.floor(unwrappedHour / 24);
  const targetHour = mod(unwrappedHour, 24);
  const sourceNoon = julianDay({
    year: currentVirtualTime.year,
    month: currentVirtualTime.month,
    day: currentVirtualTime.day,
    hour: 12,
  });
  const targetDay = calendarDateFromJulianDay(sourceNoon + dayShift);
  const targetVirtual: CivilDateTime = {
    year: targetDay.year,
    month: targetDay.month,
    day: targetDay.day,
    hour: targetHour,
    minute: currentVirtualTime.minute,
    second: currentVirtualTime.second,
  };
  const targetHourBranch = Math.floor((targetHour + 1) / 2) % 12;
  const segment = ratHourSegment(targetVirtual, ratHourMode, targetHourBranch);
  return Object.freeze({
    jdUT1: current.jdUT1 + stepHours / 24,
    virtualTime: frozenClock(targetVirtual),
    ratHourSegment: segment,
  });
}

export function stepZiweiFlowDayTarget(
  current: ZiweiFlowTarget,
  direction: -1 | 1,
): ZiweiFlowTarget {
  if (direction !== -1 && direction !== 1) throw new RangeError('direction must be -1 or 1');
  const currentVirtualTime = normalizeChartVirtualTime(current.virtualTime);
  const sourceNoon = julianDay({
    year: currentVirtualTime.year,
    month: currentVirtualTime.month,
    day: currentVirtualTime.day,
    hour: 12,
  });
  const date = calendarDateFromJulianDay(sourceNoon + direction);
  return Object.freeze({
    jdUT1: current.jdUT1 + direction,
    virtualTime: frozenClock({
      year: date.year,
      month: date.month,
      day: date.day,
      hour: currentVirtualTime.hour,
      minute: currentVirtualTime.minute,
      second: currentVirtualTime.second,
    }),
  });
}

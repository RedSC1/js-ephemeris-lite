import {
  RAT_HOUR_MODE,
  asUt1JulianDay,
  calculateFourPillars,
  calendarDateFromJulianDay,
  ganzhiBranch,
  ganzhiStem,
  getPreviousJie, getNextJie, getPillarTermBoundary, getPreviousPillarJie,
  julianDay,
  makeGanzhi,
  meanSolarTime,
  normalizeChartTime,
  solarToLunar,
  trueSolarTime,
  type CivilDateTime,
  type FourPillars,
  type ResolvedLunarDate,
  type Ut1Input,
  ZonedTime,
  localApparentToMeanSolarTime,
} from 'js-ephemeris-lite';
import { computeZiweiAnchors, resolveEffectiveLunarMonth, type ResolvedZiweiAnchors } from './anchors.js';
import {
  ZIWEI_CLOCK_MODE,
  ZiweiOptions,
  resolveZiweiOptions,
  type ZiweiOptionsInput,
} from './options.js';
import type { ZiweiCalendarFacts, ZiweiLunarDateFacts } from './types.js';

export interface ResolvedZiweiBirth extends ResolvedZiweiAnchors {
  readonly facts: ZiweiCalendarFacts;
  readonly options: ZiweiOptions;
  /** Original birth clock, before the chart-clock convention is applied. */
  readonly clockTime?: Readonly<ReturnType<ZonedTime['toJSON']>>;
}

function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function freezeCivilTime(value: CivilDateTime): Readonly<CivilDateTime> {
  return Object.freeze({
    year: value.year,
    month: value.month,
    day: value.day,
    hour: value.hour,
    minute: value.minute,
    second: value.second,
  });
}

export function resolveZiweiChartTime(zonedTime: ZonedTime, options: ZiweiOptions): CivilDateTime {
  if (options.clockMode === ZIWEI_CLOCK_MODE.MEAN_SOLAR) {
    return meanSolarTime(zonedTime, options.longitudeDeg!);
  }
  if (options.clockMode === ZIWEI_CLOCK_MODE.TRUE_SOLAR) {
    return trueSolarTime(zonedTime, options.longitudeDeg!);
  }
  return zonedTime.offsetMinutes === options.utcOffsetMinutes ? zonedTime
    : ZonedTime.fromJulianTime(zonedTime.toJulianTime().jdUT1, options.utcOffsetMinutes);
}

/** @deprecated Use resolveZiweiChartTime. */
export const resolveZiweiVirtualTime = resolveZiweiChartTime;

function logicalDateForLunar(chartTime: CivilDateTime, options: ZiweiOptions): CivilDateTime {
  let logicalJd = julianDay(chartTime);
  if (options.ratHourMode === RAT_HOUR_MODE.NEXT_DAY && chartTime.hour >= 23) {
    logicalJd += 1 / 24;
  }
  return calendarDateFromJulianDay(logicalJd);
}

export function resolveZiweiLogicalLunarDate(
  chartTime: CivilDateTime,
  options: ZiweiOptions,
): ResolvedLunarDate {
  const logicalDate = logicalDateForLunar(chartTime, options);
  return solarToLunar(
    { year: logicalDate.year, month: logicalDate.month, day: logicalDate.day },
    options.toCalendarOptions(),
  );
}

function makeLunarPillars(
  effectiveYear: number,
  effectiveMonth: number,
  solar: FourPillars,
): Readonly<FourPillars> {
  const yearStem = mod(effectiveYear + 6, 10);
  const yearBranch = mod(effectiveYear + 8, 12);
  const monthStem = (yearStem % 5 * 2 + 2 + effectiveMonth - 1) % 10;
  const monthBranch = (effectiveMonth + 1) % 12;
  return Object.freeze({
    year: makeGanzhi(yearStem, yearBranch),
    month: makeGanzhi(monthStem, monthBranch),
    day: solar.day,
    hour: solar.hour,
  });
}

// Match the year/month pillar boundary policy, independently of the display clock.
export function pillarJieBoundary(term: ReturnType<typeof getPreviousJie>, options: ZiweiOptions): number {
  return getPillarTermBoundary(term, {...options.toCalendarOptions(), pillarHistoricalMode: options.pillarHistoricalMode});
}

function previousPillarJie(jd: number, options: ZiweiOptions): ReturnType<typeof getPreviousJie> {
  return getPreviousPillarJie(jd, {...options.toCalendarOptions(), pillarHistoricalMode: options.pillarHistoricalMode});
}

export function nextPillarJieBoundary(jd: number, options: ZiweiOptions): number {
  let term = previousPillarJie(jd, options);
  for (let i = 0; i < 4; i++) {
    term = getNextJie(term.time.jdUT1 + 1, options.toCalendarOptions());
    const boundary = pillarJieBoundary(term, options);
    if (boundary > jd + 1e-9) return boundary;
  }
  throw new Error('next pillar Jie boundary not found');
}

export function solarDayFromPreviousJie(
  jdUT1: number,
  chartTime: CivilDateTime,
  options: ZiweiOptions,
): number {
  const virtualJd = julianDay(chartTime);
  const previousJie = previousPillarJie(jdUT1, options);

  let currentLogical = virtualJd;
  if (options.ratHourMode === RAT_HOUR_MODE.NEXT_DAY && chartTime.hour >= 23) {
    currentLogical += 1 / 24;
  }
  const jieVirtual = julianDay(resolveZiweiChartTime(ZonedTime.fromJulianTime(pillarJieBoundary(previousJie, options), options.utcOffsetMinutes), options));
  const jieClock = calendarDateFromJulianDay(jieVirtual);
  let jieLogical = jieVirtual;
  if (options.ratHourMode === RAT_HOUR_MODE.NEXT_DAY && jieClock.hour >= 23) {
    jieLogical += 1 / 24;
  }
  const day = Math.floor(currentLogical + 0.5) - Math.floor(jieLogical + 0.5) + 1;
  if (!Number.isInteger(day) || day < 1 || day > 33) {
    throw new Error(`invalid solar day from previous Jie: ${day}`);
  }
  return day;
}

export function resolveZiweiBirthFromInstant(
  instant: Ut1Input,
  chartTime: CivilDateTime,
  rawOptions: ZiweiOptions | ZiweiOptionsInput,
): ResolvedZiweiBirth {
  const options = resolveZiweiOptions(rawOptions);
  const jdUT1 = asUt1JulianDay(instant);
  const normalizedChartTime = normalizeChartTime(chartTime);
  const calendarOptions = options.toCalendarOptions();
  const resolvedLunar = resolveZiweiLogicalLunarDate(normalizedChartTime, options);
  const lunarDate: ZiweiLunarDateFacts = Object.freeze({
    year: resolvedLunar.year,
    historicalYear: resolvedLunar.historicalYear,
    month: resolvedLunar.month,
    day: resolvedLunar.day,
    isLeap: resolvedLunar.isLeap,
    monthName: resolvedLunar.monthName,
  });
  const effective = resolveEffectiveLunarMonth(
    { ...lunarDate, year: resolvedLunar.historicalYear },
    options.leapMonthStrategy,
  );
  const solarTermPillars = calculateFourPillars(jdUT1, normalizedChartTime, {
    ...calendarOptions,
    pillarHistoricalMode: options.pillarHistoricalMode,
    ratHourMode: options.ratHourMode,
  });
  // Validate the packed values before deriving the lunar-boundary pillars.
  for (const value of Object.values(solarTermPillars)) {
    ganzhiStem(value);
    ganzhiBranch(value);
  }
  const frozenChartTime = freezeCivilTime(normalizedChartTime);
  const facts: ZiweiCalendarFacts = Object.freeze({
    jdUT1,
    chartTime: frozenChartTime,
    virtualTime: frozenChartTime,
    gender: options.gender,
    lunarDate,
    solarTermPillars,
    lunarPillars: makeLunarPillars(effective.year, effective.month, solarTermPillars),
    effectiveLunarYear: effective.year,
    effectiveLunarMonth: effective.month,
    solarDayFromPreviousJie: solarDayFromPreviousJie(jdUT1, normalizedChartTime, options),
  });
  const resolved = computeZiweiAnchors(facts, options);
  return Object.freeze({ facts, ...resolved, options });
}

export function resolveZiweiBirth(
  zonedTime: ZonedTime,
  options: ZiweiOptions | ZiweiOptionsInput,
): ResolvedZiweiBirth {
  const resolved = resolveZiweiOptions(options);
  const birth = resolveZiweiBirthFromInstant(
    zonedTime.toJulianTime(),
    resolveZiweiChartTime(zonedTime, resolved),
    resolved,
  );
  return Object.freeze({ ...birth, clockTime: Object.freeze(zonedTime.toJSON()) });
}

/** Convert chart clock fields back to the physical UT1 instant. */
export function chartTimeToUt1(v: CivilDateTime, options: ZiweiOptions): number {
  const jd = julianDay(v);
  if (options.clockMode === ZIWEI_CLOCK_MODE.TRUE_SOLAR) return localApparentToMeanSolarTime(jd, options.longitudeDeg!) - options.longitudeDeg! / 360;
  return jd - (options.clockMode === ZIWEI_CLOCK_MODE.MEAN_SOLAR ? options.longitudeDeg! / 360 : options.utcOffsetMinutes / 1440);
}

/** @deprecated Use chartTimeToUt1. */
export const virtualTimeToUt1 = chartTimeToUt1;

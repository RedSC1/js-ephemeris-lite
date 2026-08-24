import {
  RAT_HOUR_MODE,
  asUt1JulianDay,
  calculateFourPillars,
  calendarDateFromJulianDay,
  ganzhiBranch,
  ganzhiStem,
  getPreviousJie,
  julianDay,
  makeGanzhi,
  meanSolarTime,
  solarToLunar,
  trueSolarTime,
  type CivilDateTime,
  type FourPillars,
  type Ut1Input,
  type ZonedTime,
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

function resolveVirtualTime(zonedTime: ZonedTime, options: ZiweiOptions): CivilDateTime {
  if (options.clockMode === ZIWEI_CLOCK_MODE.MEAN_SOLAR) {
    return meanSolarTime(zonedTime, options.longitudeDeg!);
  }
  if (options.clockMode === ZIWEI_CLOCK_MODE.TRUE_SOLAR) {
    return trueSolarTime(zonedTime, options.longitudeDeg!);
  }
  return zonedTime;
}

function logicalDateForLunar(virtualTime: CivilDateTime, options: ZiweiOptions): CivilDateTime {
  let logicalJd = julianDay(virtualTime);
  if (options.ratHourMode === RAT_HOUR_MODE.NEXT_DAY && virtualTime.hour >= 23) {
    logicalJd += 1 / 24;
  }
  return calendarDateFromJulianDay(logicalJd);
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

function solarDayFromPreviousJie(
  jdUT1: number,
  virtualTime: CivilDateTime,
  options: ZiweiOptions,
): number {
  const virtualJd = julianDay(virtualTime);
  const previousJie = getPreviousJie(jdUT1, options.toCalendarOptions());
  const clockOffset = virtualJd - jdUT1;
  let currentLogical = virtualJd;
  if (options.ratHourMode === RAT_HOUR_MODE.NEXT_DAY && virtualTime.hour >= 23) {
    currentLogical += 1 / 24;
  }
  const jieVirtual = previousJie.jdUT1 + clockOffset;
  const jieClock = calendarDateFromJulianDay(jieVirtual);
  let jieLogical = jieVirtual;
  if (options.ratHourMode === RAT_HOUR_MODE.NEXT_DAY && jieClock.hour >= 23) {
    jieLogical += 1 / 24;
  }
  const day = Math.floor(currentLogical + 0.5) - Math.floor(jieLogical + 0.5) + 1;
  if (!Number.isInteger(day) || day < 1 || day > 32) {
    throw new Error(`invalid solar day from previous Jie: ${day}`);
  }
  return day;
}

export function resolveZiweiBirthFromInstant(
  instant: Ut1Input,
  virtualTime: CivilDateTime,
  rawOptions: ZiweiOptions | ZiweiOptionsInput,
): ResolvedZiweiBirth {
  const options = resolveZiweiOptions(rawOptions);
  const jdUT1 = asUt1JulianDay(instant);
  const calendarOptions = options.toCalendarOptions();
  const logicalDate = logicalDateForLunar(virtualTime, options);
  const resolvedLunar = solarToLunar({
    year: logicalDate.year,
    month: logicalDate.month,
    day: logicalDate.day,
  }, calendarOptions);
  const lunarDate: ZiweiLunarDateFacts = Object.freeze({
    year: resolvedLunar.year,
    month: resolvedLunar.month,
    day: resolvedLunar.day,
    isLeap: resolvedLunar.isLeap,
    monthName: resolvedLunar.monthName,
  });
  const effective = resolveEffectiveLunarMonth(lunarDate, options.leapMonthStrategy);
  const solarTermPillars = calculateFourPillars(jdUT1, virtualTime, {
    ...calendarOptions,
    pillarHistoricalMode: options.pillarHistoricalMode,
    ratHourMode: options.ratHourMode,
  });
  // Validate the packed values before deriving the lunar-boundary pillars.
  for (const value of Object.values(solarTermPillars)) {
    ganzhiStem(value);
    ganzhiBranch(value);
  }
  const facts: ZiweiCalendarFacts = Object.freeze({
    jdUT1,
    virtualTime: freezeCivilTime(virtualTime),
    gender: options.gender,
    lunarDate,
    solarTermPillars,
    lunarPillars: makeLunarPillars(effective.year, effective.month, solarTermPillars),
    effectiveLunarYear: effective.year,
    effectiveLunarMonth: effective.month,
    solarDayFromPreviousJie: solarDayFromPreviousJie(jdUT1, virtualTime, options),
  });
  const resolved = computeZiweiAnchors(facts, options);
  return Object.freeze({ facts, ...resolved, options });
}

export function resolveZiweiBirth(
  zonedTime: ZonedTime,
  options: ZiweiOptions | ZiweiOptionsInput,
): ResolvedZiweiBirth {
  const resolved = resolveZiweiOptions(options);
  return resolveZiweiBirthFromInstant(
    zonedTime.toJulianTime(),
    resolveVirtualTime(zonedTime, resolved),
    resolved,
  );
}

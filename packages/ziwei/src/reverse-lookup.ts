import {
  calculateChineseCalendarYear,
  ganzhiBranch,
  julianDay,
  localApparentToMeanSolarTime,
  lunarToSolar,
  ZonedTime,
  type CivilDateTime,
  type LunarMonth,
} from 'js-ephemeris-lite';
import { resolveEffectiveLunarMonth } from './anchors.js';
import { resolveZiweiBirthFromInstant, resolveZiweiVirtualTime } from './calendar.js';
import { ZiweiChart } from './chart.js';
import { stepZiweiFlowHourTarget, type ZiweiFlowTarget } from './flow-calendar.js';
import { findStarId } from './stars.js';
import { RAT_HOUR_SEGMENT, type RatHourSegment } from './types.js';
import { ZIWEI_CLOCK_MODE, ZiweiOptions, type ZiweiOptionsInput } from './options.js';

export interface ZiweiTier1ReverseQuery {
  readonly lucunBranch?: number;
  readonly hongluanBranch?: number;
  readonly zuofuBranch?: number;
  readonly youbiBranch?: number;
  readonly wenchangBranch?: number;
  readonly wenquBranch?: number;
  readonly santaiBranch?: number;
  readonly bazuoBranch?: number;
  readonly ziweiBranch?: number;
}

export interface ZiweiReverseLookupRequest {
  readonly start: ZonedTime;
  readonly end: ZonedTime;
  readonly options: ZiweiOptions | ZiweiOptionsInput;
  readonly query: ZiweiTier1ReverseQuery;
  /** Optional safety ceiling; defaults to every logical hour in the finite range. */
  readonly maxCandidatesToExamine?: number;
}

export interface ZiweiReverseCandidate {
  readonly jdUT1: number;
  readonly virtualTime: ZiweiFlowTarget['virtualTime'];
  readonly lunarDate: ZiweiChart['facts']['lunarDate'];
  readonly hourBranch: number;
  readonly ratHourSegment: RatHourSegment;
  readonly chart: ZiweiChart;
}

const QUERY_STARS: readonly [keyof ZiweiTier1ReverseQuery, string][] = [
  ['lucunBranch', 'lucun'],
  ['hongluanBranch', 'hongluan'],
  ['zuofuBranch', 'zuofu'],
  ['youbiBranch', 'youbi'],
  ['wenchangBranch', 'wenchang'],
  ['wenquBranch', 'wenqu'],
  ['santaiBranch', 'santai'],
  ['bazuoBranch', 'bazuo'],
  ['ziweiBranch', 'ziwei'],
];

function validateQuery(query: ZiweiTier1ReverseQuery): void {
  let count = 0;
  for (const [field] of QUERY_STARS) {
    const value = query[field];
    if (value === undefined) continue;
    count += 1;
    if (!Number.isInteger(value) || value < 0 || value >= 12) {
      throw new RangeError(`${field} must be 0..11`);
    }
  }
  if (count === 0) throw new RangeError('at least one reverse-lookup constraint is required');
}

function matches(chart: ZiweiChart, query: ZiweiTier1ReverseQuery): boolean {
  for (const [field, starKey] of QUERY_STARS) {
    const expected = query[field];
    if (expected === undefined) continue;
    const id = findStarId(starKey);
    if (id === undefined || chart.starPositions[id] !== expected) return false;
  }
  return true;
}

function segmentForTarget(target: ZiweiFlowTarget, options: ZiweiOptions, hourBranch: number): RatHourSegment {
  if (hourBranch !== 0) return RAT_HOUR_SEGMENT.NONE;
  if (options.ratHourMode === 'next-day') return RAT_HOUR_SEGMENT.UNIFIED;
  return target.virtualTime.hour >= 23 ? RAT_HOUR_SEGMENT.LATE : RAT_HOUR_SEGMENT.EARLY;
}

function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function directInverseAvailable(query: ZiweiTier1ReverseQuery, options: ZiweiOptions): boolean {
  const complete = query.lucunBranch !== undefined
    && query.hongluanBranch !== undefined
    && (query.zuofuBranch !== undefined || query.youbiBranch !== undefined)
    && (query.wenchangBranch !== undefined || query.wenquBranch !== undefined)
    && (query.santaiBranch !== undefined || query.bazuoBranch !== undefined);
  if (!complete || options.rules.placementDefault !== 'option1') return false;
  return ['lucun', 'hongluan', 'zuofu', 'youbi', 'wenchang', 'wenqu', 'santai', 'bazuo']
    .every((key) => options.rules.placement[key] === undefined
      || options.rules.placement[key] === 'option1');
}

function intersectCandidates(values: readonly (number | undefined)[]): readonly number[] {
  const defined = values.filter((value): value is number => value !== undefined);
  if (defined.length === 0) return Object.freeze([]);
  return defined.every((value) => value === defined[0])
    ? Object.freeze([defined[0]!])
    : Object.freeze([]);
}

function inverseYearStems(lucunBranch: number): readonly number[] {
  const forward = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
  return Object.freeze(forward.flatMap((branch, stem) => branch === lucunBranch ? [stem] : []));
}

function inverseMonths(query: ZiweiTier1ReverseQuery): readonly number[] {
  return intersectCandidates([
    query.zuofuBranch === undefined ? undefined : mod(query.zuofuBranch - 4, 12) + 1,
    query.youbiBranch === undefined ? undefined : mod(10 - query.youbiBranch, 12) + 1,
  ]);
}

function inverseHours(query: ZiweiTier1ReverseQuery): readonly number[] {
  return intersectCandidates([
    query.wenchangBranch === undefined ? undefined : mod(10 - query.wenchangBranch, 12),
    query.wenquBranch === undefined ? undefined : mod(query.wenquBranch - 4, 12),
  ]);
}

function matchesInverseDay(query: ZiweiTier1ReverseQuery, effectiveMonth: number, day: number): boolean {
  const monthIndex = effectiveMonth - 1;
  const dayIndex = day - 1;
  return (query.santaiBranch === undefined
      || mod(4 + monthIndex + dayIndex, 12) === query.santaiBranch)
    && (query.bazuoBranch === undefined
      || mod(10 - monthIndex - dayIndex, 12) === query.bazuoBranch);
}

function collectLunarMonths(effectiveYear: number, options: ZiweiOptions): readonly LunarMonth[] {
  const months = new Map<number, LunarMonth>();
  for (const probeYear of [effectiveYear - 1, effectiveYear, effectiveYear + 1]) {
    for (const probe of [
      { year: probeYear, month: 7, day: 1, hour: 12 },
      { year: probeYear + 1, month: 1, day: 15, hour: 12 },
    ]) {
      const calendar = calculateChineseCalendarYear(julianDay(probe), options.toCalendarOptions());
      for (const month of calendar.months) months.set(month.firstCivilDayNumber, month);
    }
  }
  return Object.freeze([...months.values()].sort(
    (left, right) => left.firstCivilDayNumber - right.firstCivilDayNumber,
  ));
}

function targetFromVirtualTime(virtualTime: CivilDateTime, options: ZiweiOptions): ZiweiFlowTarget {
  const virtualJd = julianDay(virtualTime);
  let jdUT1: number;
  if (options.clockMode === ZIWEI_CLOCK_MODE.CIVIL) {
    jdUT1 = new ZonedTime({ ...virtualTime, offsetMinutes: options.utcOffsetMinutes })
      .toJulianTime().jdUT1;
  } else if (options.clockMode === ZIWEI_CLOCK_MODE.MEAN_SOLAR) {
    jdUT1 = virtualJd - options.longitudeDeg! / 360;
  } else {
    jdUT1 = localApparentToMeanSolarTime(virtualJd, options.longitudeDeg!)
      - options.longitudeDeg! / 360;
  }
  const physical = ZonedTime.fromJulianTime(jdUT1, options.utcOffsetMinutes);
  return Object.freeze({
    jdUT1,
    virtualTime: Object.freeze(resolveZiweiVirtualTime(physical, options)),
  });
}

function reverseLookupDirect(
  request: ZiweiReverseLookupRequest,
  options: ZiweiOptions,
  startJd: number,
  endJd: number,
): readonly ZiweiReverseCandidate[] {
  const stems = inverseYearStems(request.query.lucunBranch!);
  const yearBranch = mod(3 - request.query.hongluanBranch!, 12);
  const months = inverseMonths(request.query);
  const hours = inverseHours(request.query);
  if (stems.length === 0 || months.length === 0 || hours.length === 0) return Object.freeze([]);

  const startYear = request.start.year - 2;
  const endYear = request.end.year + 2;
  const ceiling = request.maxCandidatesToExamine ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(ceiling) || ceiling < 1) {
    throw new RangeError('maxCandidatesToExamine must be >= 1');
  }
  const results: ZiweiReverseCandidate[] = [];
  const seen = new Set<string>();
  let examined = 0;

  for (let effectiveYear = startYear; effectiveYear <= endYear; effectiveYear += 1) {
    if (!stems.includes(mod(effectiveYear + 6, 10))
      || mod(effectiveYear + 8, 12) !== yearBranch) continue;
    for (const lunarMonth of collectLunarMonths(effectiveYear, options)) {
      for (let day = 1; day <= lunarMonth.dayCount; day += 1) {
        const effective = resolveEffectiveLunarMonth({
          year: lunarMonth.historicalYear,
          historicalYear: lunarMonth.historicalYear,
          month: lunarMonth.month,
          day,
          isLeap: lunarMonth.isLeap,
          monthName: lunarMonth.monthName,
        }, options.leapMonthStrategy);
        if (effective.year !== effectiveYear || !months.includes(effective.month)
          || !matchesInverseDay(request.query, effective.month, day)) continue;
        const solarDate = lunarToSolar({
          year: lunarMonth.lunarYear,
          month: lunarMonth.month,
          day,
          isLeap: lunarMonth.isLeap,
          monthName: lunarMonth.monthName,
        }, options.toCalendarOptions());
        for (const hourBranch of hours) {
          const virtualHours = hourBranch === 0 && options.ratHourMode !== 'next-day'
            ? [0, 23]
            : [hourBranch * 2];
          for (const hour of virtualHours) {
            if (examined >= ceiling) throw new RangeError('reverse lookup candidate ceiling exceeded');
            examined += 1;
            const target = targetFromVirtualTime({ ...solarDate, hour, minute: 0, second: 0 }, options);
            if (target.jdUT1 < startJd - 1e-12 || target.jdUT1 > endJd + 1e-12) continue;
            const birth = resolveZiweiBirthFromInstant(target.jdUT1, target.virtualTime, options);
            const chart = ZiweiChart.fromResolvedBirth(birth);
            if (!matches(chart, request.query)) continue;
            const physicalHourBranch = ganzhiBranch(chart.facts.solarTermPillars.hour);
            const key = `${target.jdUT1.toFixed(10)}:${physicalHourBranch}`;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push(Object.freeze({
              jdUT1: target.jdUT1,
              virtualTime: target.virtualTime,
              lunarDate: chart.facts.lunarDate,
              hourBranch: physicalHourBranch,
              ratHourSegment: segmentForTarget(target, options, physicalHourBranch),
              chart,
            }));
          }
        }
      }
    }
  }
  results.sort((left, right) => left.jdUT1 - right.jdUT1);
  return Object.freeze(results);
}

/** Enumerate finite logical-hour slots and verify every match through the normal forward chart engine. */
export function reverseLookupZiweiTier1(request: ZiweiReverseLookupRequest): readonly ZiweiReverseCandidate[] {
  validateQuery(request.query);
  const options = request.options instanceof ZiweiOptions ? request.options : new ZiweiOptions(request.options);
  const startJd = request.start.toJulianTime().jdUT1;
  const endJd = request.end.toJulianTime().jdUT1;
  if (endJd < startJd) throw new RangeError('reverse lookup end precedes start');
  if (directInverseAvailable(request.query, options)) {
    return reverseLookupDirect(request, options, startJd, endJd);
  }
  let target: ZiweiFlowTarget = Object.freeze({
    jdUT1: startJd,
    virtualTime: Object.freeze(resolveZiweiVirtualTime(request.start, options)),
  });
  const approximateSlots = Math.ceil((endJd - startJd) * 13) + 2;
  const ceiling = request.maxCandidatesToExamine ?? approximateSlots;
  if (!Number.isSafeInteger(ceiling) || ceiling < 1) throw new RangeError('maxCandidatesToExamine must be >= 1');
  const results: ZiweiReverseCandidate[] = [];
  let examined = 0;
  while (target.jdUT1 <= endJd + 1e-12) {
    if (examined >= ceiling) throw new RangeError('reverse lookup candidate ceiling exceeded');
    examined += 1;
    const birth = resolveZiweiBirthFromInstant(target.jdUT1, target.virtualTime, options);
    const chart = ZiweiChart.fromResolvedBirth(birth);
    if (matches(chart, request.query)) {
      const hourBranch = ganzhiBranch(chart.facts.solarTermPillars.hour);
      results.push(Object.freeze({
        jdUT1: target.jdUT1,
        virtualTime: target.virtualTime,
        lunarDate: chart.facts.lunarDate,
        hourBranch,
        ratHourSegment: segmentForTarget(target, options, hourBranch),
        chart,
      }));
    }
    const next = stepZiweiFlowHourTarget(target, options.ratHourMode, 1);
    if (next.jdUT1 <= target.jdUT1) throw new Error('logical-hour stepping did not advance');
    target = next;
  }
  return Object.freeze(results);
}

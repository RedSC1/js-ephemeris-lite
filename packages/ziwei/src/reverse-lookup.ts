import { ganzhiBranch, type ZonedTime } from 'js-ephemeris-lite';
import { resolveZiweiBirthFromInstant, resolveZiweiVirtualTime } from './calendar.js';
import { ZiweiChart } from './chart.js';
import { stepZiweiFlowHourTarget, type ZiweiFlowTarget } from './flow-calendar.js';
import { findStarId } from './stars.js';
import { RAT_HOUR_SEGMENT, type RatHourSegment } from './types.js';
import { ZiweiOptions, type ZiweiOptionsInput } from './options.js';

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

/** Enumerate finite logical-hour slots and verify every match through the normal forward chart engine. */
export function reverseLookupZiweiTier1(request: ZiweiReverseLookupRequest): readonly ZiweiReverseCandidate[] {
  validateQuery(request.query);
  const options = request.options instanceof ZiweiOptions ? request.options : new ZiweiOptions(request.options);
  const startJd = request.start.toJulianTime().jdUT1;
  const endJd = request.end.toJulianTime().jdUT1;
  if (endJd < startJd) throw new RangeError('reverse lookup end precedes start');
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

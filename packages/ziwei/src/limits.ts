import { ganzhiBranch, ganzhiStem } from 'js-ephemeris-lite';
import type { ZiweiChart } from './chart.js';
import {
  CHILDHOOD_STRATEGY,
  FLOW_LEVEL,
  PALACE,
  PILLAR_BOUNDARY,
  RAT_HOUR_SEGMENT,
  ZIWEI_GENDER,
  advanceBranch,
  bureauNumber,
  isForward,
  type ChildhoodStrategy,
  type FlowCoordinate,
  type LimitCoordinate,
  type PalaceId,
  type RatHourSegment,
} from './types.js';

export interface DecadeLimit {
  readonly limit: LimitCoordinate;
  readonly index: number;
  readonly startAge: number;
  readonly endAge: number;
  readonly startYear: number;
  readonly endYear: number;
  readonly isChildhood: boolean;
}

export interface SmallLimit {
  readonly coordinate: Readonly<FlowCoordinate>;
  readonly natalPalaceId: PalaceId;
  readonly virtualAge: number;
}

export interface FlowYearLimit {
  readonly limit: LimitCoordinate;
  readonly year: number;
}

export interface FlowMonthLimit {
  readonly limit: LimitCoordinate;
  readonly year: number;
  /** Written/logical lunar month, not its chronological slot. */
  readonly month: number;
  /** Chronological slot within the labelled year; a leap month consumes one. */
  readonly sequence: number;
  readonly isLeap: boolean;
  readonly monthBuildingBranch: number;
  readonly doujun: number;
}

export interface FlowDayLimit {
  readonly limit: LimitCoordinate;
  readonly day: number;
}

export interface FlowHourLimit {
  readonly limit: LimitCoordinate;
  readonly hourIndex: number;
  readonly ratHourSegment: RatHourSegment;
}

function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function integer(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
  return value;
}

function yearStem(year: number): number {
  return mod(integer(year, 'year') + 6, 10);
}

function yearBranch(year: number): number {
  return mod(integer(year, 'year') + 8, 12);
}

function palaceCoordinate(chart: ZiweiChart, branch: number): Readonly<FlowCoordinate> {
  return Object.freeze({ stem: chart.palaceStems[branch]!, branch });
}

function limitCoordinate(
  chart: ZiweiChart,
  level: LimitCoordinate['level'],
  coordinate: Readonly<FlowCoordinate>,
): LimitCoordinate {
  return Object.freeze({
    level,
    coordinate,
    natalPalaceId: chart.palaces[coordinate.branch]!.palaceId,
  });
}

export function getEffectiveBirthYear(
  chart: ZiweiChart,
  boundary = chart.options.flowLimitBoundary,
): number {
  if (boundary === PILLAR_BOUNDARY.LUNAR) return chart.facts.lunarDate.year;
  const civilYear = chart.facts.virtualTime.year;
  const pillarStem = ganzhiStem(chart.facts.solarTermPillars.year);
  if (yearStem(civilYear) === pillarStem) return civilYear;
  if (yearStem(civilYear - 1) === pillarStem) return civilYear - 1;
  throw new Error('solar-term year pillar is inconsistent with the birth clock');
}

export function getStartDecadeYear(chart: ZiweiChart, effectiveBirthYear = getEffectiveBirthYear(chart)): number {
  return effectiveBirthYear + bureauNumber(chart.anchors.bureau) - 1;
}

export function makeDecadeByIndex(
  chart: ZiweiChart,
  effectiveBirthYear: number,
  index: number,
): DecadeLimit {
  integer(effectiveBirthYear, 'effectiveBirthYear');
  if (!Number.isSafeInteger(index) || index < 1) throw new RangeError('decade index must be >= 1');
  const startAge = bureauNumber(chart.anchors.bureau);
  const offset = index - 1;
  const forward = isForward(yearStem(effectiveBirthYear), chart.facts.gender);
  const natalLife = chart.anchors.palacePositions[PALACE.LIFE]!;
  const branch = advanceBranch(natalLife, forward ? offset : -offset);
  const startYear = effectiveBirthYear + startAge - 1 + offset * 10;
  return Object.freeze({
    limit: limitCoordinate(chart, FLOW_LEVEL.DECADE, palaceCoordinate(chart, branch)),
    index,
    startAge: startAge + offset * 10,
    endAge: startAge + offset * 10 + 9,
    startYear,
    endYear: startYear + 9,
    isChildhood: false,
  });
}

export function makeChildhoodDecade(
  chart: ZiweiChart,
  effectiveBirthYear: number,
  targetYear: number,
  strategy: ChildhoodStrategy = chart.options.childhoodStrategy,
): DecadeLimit {
  const virtualAge = integer(targetYear, 'targetYear') - integer(effectiveBirthYear, 'effectiveBirthYear') + 1;
  const startAge = bureauNumber(chart.anchors.bureau);
  if (virtualAge < 1 || virtualAge >= startAge) throw new RangeError('target year is outside childhood');
  const natalLife = chart.anchors.palacePositions[PALACE.LIFE]!;
  let step: number;
  if (strategy === CHILDHOOD_STRATEGY.SKIP) {
    step = -[0, 4, 5, 2, 10, 8][virtualAge - 1]!;
  } else if (strategy === CHILDHOOD_STRATEGY.SEQUENTIAL) {
    step = (virtualAge - 1) * (isForward(yearStem(effectiveBirthYear), chart.facts.gender) ? 1 : -1);
  } else {
    throw new RangeError('unknown childhood strategy');
  }
  const branch = advanceBranch(natalLife, step);
  return Object.freeze({
    limit: limitCoordinate(chart, FLOW_LEVEL.DECADE, palaceCoordinate(chart, branch)),
    index: 0,
    startAge: virtualAge,
    endAge: virtualAge,
    startYear: targetYear,
    endYear: targetYear,
    isChildhood: true,
  });
}

export function makeDecadeForYear(
  chart: ZiweiChart,
  effectiveBirthYear: number,
  targetYear: number,
  strategy: ChildhoodStrategy = chart.options.childhoodStrategy,
): DecadeLimit {
  if (targetYear < effectiveBirthYear) throw new RangeError('target year precedes birth year');
  const startYear = getStartDecadeYear(chart, effectiveBirthYear);
  return targetYear < startYear
    ? makeChildhoodDecade(chart, effectiveBirthYear, targetYear, strategy)
    : makeDecadeByIndex(chart, effectiveBirthYear, Math.floor((targetYear - startYear) / 10) + 1);
}

export function makeSmallLimit(
  chart: ZiweiChart,
  birthSolarYearBranch: number,
  virtualAge: number,
): SmallLimit {
  if (!Number.isInteger(birthSolarYearBranch) || birthSolarYearBranch < 0 || birthSolarYearBranch >= 12) {
    throw new RangeError('birthSolarYearBranch must be 0..11');
  }
  if (!Number.isSafeInteger(virtualAge) || virtualAge < 1) throw new RangeError('virtualAge must be >= 1');
  const start = [10, 7, 4, 1][birthSolarYearBranch % 4]!;
  const direction = chart.facts.gender === ZIWEI_GENDER.MALE ? 1 : -1;
  const branch = advanceBranch(start, (virtualAge - 1) * direction);
  return Object.freeze({
    coordinate: palaceCoordinate(chart, branch),
    natalPalaceId: chart.palaces[branch]!.palaceId,
    virtualAge,
  });
}

export function makeFlowYear(chart: ZiweiChart, year: number): FlowYearLimit {
  const coordinate = Object.freeze({ stem: yearStem(year), branch: yearBranch(year) });
  return Object.freeze({ year, limit: limitCoordinate(chart, FLOW_LEVEL.YEAR, coordinate) });
}

function makeFlowMonthWithOffset(
  chart: ZiweiChart,
  year: number,
  logicalMonth: number,
  sequence: number,
  isLeap: boolean,
  monthStemOffset: number,
  monthBuildingBranch: number,
): FlowMonthLimit {
  if (!Number.isSafeInteger(logicalMonth) || logicalMonth < 1 || logicalMonth > 12) {
    throw new RangeError('logicalMonth must be 1..12');
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 13) {
    throw new RangeError('month sequence must be 1..13');
  }
  const birthMonth = chart.facts.effectiveLunarMonth;
  const birthHour = ganzhiBranch(chart.facts.solarTermPillars.hour);
  const doujun = advanceBranch(yearBranch(year), -(birthMonth - 1) + birthHour);
  const branch = advanceBranch(doujun, sequence - 1);
  const startTiger = yearStem(year) % 5 * 2 + 2;
  const coordinate = Object.freeze({ stem: mod(startTiger + monthStemOffset, 10), branch });
  return Object.freeze({
    year,
    month: logicalMonth,
    sequence,
    isLeap,
    monthBuildingBranch,
    doujun,
    limit: limitCoordinate(chart, FLOW_LEVEL.MONTH, coordinate),
  });
}

/** Calendar-backed form: use the winter-solstice-anchored physical month building. */
export function makeFlowMonthFromBuildingBranch(
  chart: ZiweiChart,
  lunarYear: number,
  logicalMonth: number,
  sequence: number,
  isLeap: boolean,
  monthBuildingBranch: number,
): FlowMonthLimit {
  if (!Number.isInteger(monthBuildingBranch) || monthBuildingBranch < 0 || monthBuildingBranch >= 12) {
    throw new RangeError('monthBuildingBranch must be 0..11');
  }
  const offset = mod(monthBuildingBranch - 2, 12);
  return makeFlowMonthWithOffset(
    chart,
    lunarYear,
    logicalMonth,
    sequence,
    isLeap,
    offset,
    monthBuildingBranch,
  );
}

/** Legacy/Dart-compatible form. Prefer makeFlowMonthFromBuildingBranch. */
export function makeFlowMonth(
  chart: ZiweiChart,
  year: number,
  logicalMonth: number,
  sequence = logicalMonth,
  isLeap = false,
): FlowMonthLimit {
  return makeFlowMonthWithOffset(
    chart,
    year,
    logicalMonth,
    sequence,
    isLeap,
    sequence - 1,
    advanceBranch(2, sequence - 1),
  );
}

export function makeFlowDay(
  chart: ZiweiChart,
  month: FlowMonthLimit,
  day: number,
  physicalDayStem: number,
): FlowDayLimit {
  if (!Number.isSafeInteger(day) || day < 1 || day > 32) throw new RangeError('flow day must be 1..32');
  if (!Number.isInteger(physicalDayStem) || physicalDayStem < 0 || physicalDayStem >= 10) {
    throw new RangeError('physicalDayStem must be 0..9');
  }
  const coordinate = Object.freeze({
    stem: physicalDayStem,
    branch: advanceBranch(month.limit.coordinate.branch, day - 1),
  });
  return Object.freeze({ day, limit: limitCoordinate(chart, FLOW_LEVEL.DAY, coordinate) });
}

export function makeFlowHourFromPillar(
  chart: ZiweiChart,
  day: FlowDayLimit,
  physicalHour: number,
  ratHourSegment: RatHourSegment,
): FlowHourLimit {
  const hourIndex = ganzhiBranch(physicalHour);
  const isRat = hourIndex === 0;
  if (isRat ? ratHourSegment === RAT_HOUR_SEGMENT.NONE : ratHourSegment !== RAT_HOUR_SEGMENT.NONE) {
    throw new RangeError('ratHourSegment does not match the physical hour branch');
  }
  const coordinate = Object.freeze({
    stem: ganzhiStem(physicalHour),
    branch: advanceBranch(day.limit.coordinate.branch, hourIndex),
  });
  return Object.freeze({
    hourIndex,
    ratHourSegment,
    limit: limitCoordinate(chart, FLOW_LEVEL.HOUR, coordinate),
  });
}

export function makeFlowHour(chart: ZiweiChart, day: FlowDayLimit, hourIndex: number): FlowHourLimit {
  if (!Number.isInteger(hourIndex) || hourIndex < 0 || hourIndex >= 12) {
    throw new RangeError('hourIndex must be 0..11');
  }
  const coordinate = Object.freeze({
    stem: (day.limit.coordinate.stem % 5 * 2 + hourIndex) % 10,
    branch: advanceBranch(day.limit.coordinate.branch, hourIndex),
  });
  return Object.freeze({
    hourIndex,
    ratHourSegment: hourIndex === 0 ? RAT_HOUR_SEGMENT.UNIFIED : RAT_HOUR_SEGMENT.NONE,
    limit: limitCoordinate(chart, FLOW_LEVEL.HOUR, coordinate),
  });
}

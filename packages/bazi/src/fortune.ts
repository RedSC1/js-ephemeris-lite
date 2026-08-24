import {
  advanceGanzhi,
  asUt1JulianDay,
  calculateDayPillar,
  calendarDateFromJulianDay,
  ganzhiStem,
  getNextJie,
  getPreviousJie,
  getHourGanzhi,
  getMonthGanzhi,
  julianDay,
  makeGanzhi,
  type CalendarOptions,
  type CivilDate,
  type CivilDateTime,
  type Ganzhi,
  type SolarTermEvent,
  type Ut1Input,
} from 'js-ephemeris-lite';
import {
  DAYUN_BOUNDARY_MODEL,
  GENDER,
  QIYUN_TIME_MODEL,
  RENYUAN_SILING_ORIGIN,
  RENYUAN_SILING_TABLE,
  type DaYunBoundaryModel,
  type Gender,
  type QiYunTimeModel,
  type RenyuanSilingOrigin,
  type RenyuanSilingTable,
} from './constants.js';
import type { BaziChart } from './chart.js';

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function calculateFlowYear(civilYear: number): Ganzhi {
  if (!Number.isInteger(civilYear)) throw new TypeError('civilYear must be an integer');
  const index = positiveMod(civilYear - 4, 60);
  return makeGanzhi(index % 10, index % 12);
}

export function calculateFlowMonth(yearPillar: Ganzhi, monthBranch: number): Ganzhi {
  if (!Number.isInteger(monthBranch) || monthBranch < 0 || monthBranch >= 12) {
    throw new RangeError('monthBranch must be 0..11');
  }
  const monthIndex = (monthBranch + 10) % 12;
  return getMonthGanzhi(ganzhiStem(yearPillar), monthIndex);
}

export function calculateFlowDay(civilDate: CivilDate): Ganzhi {
  return calculateDayPillar(civilDate);
}

export function calculateFlowHour(dayPillar: Ganzhi, hourIndex: number): Ganzhi {
  return getHourGanzhi(ganzhiStem(dayPillar), hourIndex);
}

export function calculateLuckDirection(yearPillar: Ganzhi, gender: Gender): -1 | 1 {
  if (gender !== GENDER.FEMALE && gender !== GENDER.MALE) throw new RangeError('unknown gender');
  return ((ganzhiStem(yearPillar) & 1) === 0) === (gender === GENDER.MALE) ? 1 : -1;
}

export function calculateXiaoYun(chart: BaziChart, direction: -1 | 1, age: number): Ganzhi {
  if (direction !== -1 && direction !== 1) throw new RangeError('direction must be -1 or 1');
  if (!Number.isInteger(age) || age < 1) throw new RangeError('age must be a positive integer');
  return advanceGanzhi(chart.pillars.hour, direction * age);
}

export interface XiaoYunEntry {
  readonly age: number;
  readonly pillar: Ganzhi;
}

export function generateXiaoYun(
  chart: BaziChart,
  direction: -1 | 1,
  count: number,
  startAge = 1,
): readonly XiaoYunEntry[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a non-negative integer');
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const age = startAge + index;
    return Object.freeze({ age, pillar: calculateXiaoYun(chart, direction, age) });
  }));
}

export interface DaYunPillar {
  readonly index: number;
  readonly pillar: Ganzhi;
  readonly startVirtualAge: number;
  readonly endVirtualAge: number;
}

/** Pure rule layer. Astronomical Qi-Yun time is intentionally a separate operation. */
export function generateDaYunPillars(
  chart: BaziChart,
  direction: -1 | 1,
  count = 8,
  firstStartVirtualAge = 1,
): readonly DaYunPillar[] {
  if (direction !== -1 && direction !== 1) throw new RangeError('direction must be -1 or 1');
  if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a non-negative integer');
  if (!Number.isInteger(firstStartVirtualAge)) throw new TypeError('firstStartVirtualAge must be an integer');
  return Object.freeze(Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const startVirtualAge = firstStartVirtualAge + offset * 10;
    return Object.freeze({
      index,
      pillar: advanceGanzhi(chart.pillars.month, direction * index),
      startVirtualAge,
      endVirtualAge: startVirtualAge + 9,
    });
  }));
}

const DAYS_PER_JULIAN_YEAR = 365.25;
const DAYS_PER_TROPICAL_YEAR = 365.2422;
const SECONDS_PER_DAY = 86400;
const ROOT_EQUALITY_DAYS = 1e-10;

export interface TraditionalLuckOffset {
  readonly years: number;
  readonly months: number;
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

export interface QiYunResult {
  readonly direction: -1 | 1;
  readonly timeModel: QiYunTimeModel;
  readonly referenceJie: SolarTermEvent;
  readonly jieIntervalDays: number;
  readonly startAgeYears: number;
  readonly traditionalOffset: TraditionalLuckOffset;
  readonly startJdUT1: number;
  readonly startCivilTime: Readonly<CivilDateTime>;
}

export interface QiYunOptions extends CalendarOptions {
  timeModel?: QiYunTimeModel;
}

function validateCivilTime(value: CivilDateTime): void {
  if (!Number.isInteger(value.year) || !Number.isInteger(value.month)
    || !Number.isInteger(value.day) || !Number.isInteger(value.hour)
    || !Number.isInteger(value.minute) || !Number.isFinite(value.second)
    || value.month < 1 || value.month > 12 || value.day < 1 || value.day > 31
    || value.hour < 0 || value.hour > 23 || value.minute < 0 || value.minute > 59
    || value.second < 0 || value.second >= 60) {
    throw new RangeError('birthCivilTime is not a valid civil clock');
  }
  const noon = julianDay({ ...value, hour: 12, minute: 0, second: 0 });
  const date = calendarDateFromJulianDay(noon);
  if (date.year !== value.year || date.month !== value.month || date.day !== value.day) {
    throw new RangeError('birthCivilTime is not a valid civil clock');
  }
}

function decomposeTraditionalOffset(intervalDays: number): {
  offset: TraditionalLuckOffset;
  remainingMonthDays: number;
} {
  const scaledDays = intervalDays * 120;
  const years = Math.floor(scaledDays / 360);
  const afterYears = scaledDays - years * 360;
  const months = Math.floor(afterYears / 30);
  const afterMonths = afterYears - months * 30;
  const days = Math.floor(afterMonths);
  let secondsOfDay = (afterMonths - days) * SECONDS_PER_DAY;
  const hours = Math.floor(secondsOfDay / 3600);
  secondsOfDay -= hours * 3600;
  const minutes = Math.floor(secondsOfDay / 60);
  const seconds = secondsOfDay - minutes * 60;
  return {
    offset: Object.freeze({ years, months, days, hours, minutes, seconds }),
    remainingMonthDays: afterMonths,
  };
}

function addCalendarComponents(
  origin: CivilDateTime,
  years: number,
  months: number,
  remainingDays: number,
): { civilTime: Readonly<CivilDateTime>; elapsedDays: number } {
  const monthIndex = origin.month - 1 + months;
  const targetYear = origin.year + years + Math.floor(monthIndex / 12);
  const targetMonth = positiveMod(monthIndex, 12) + 1;
  const originNominalJd = julianDay(origin);
  const baseNominalJd = julianDay({
    year: targetYear,
    month: targetMonth,
    day: 1,
    hour: origin.hour,
    minute: origin.minute,
    second: origin.second,
  });
  const resultNominalJd = baseNominalJd + origin.day - 1 + remainingDays;
  return {
    civilTime: Object.freeze(calendarDateFromJulianDay(resultNominalJd)),
    elapsedDays: resultNominalJd - originNominalJd,
  };
}

/**
 * Calculate the Jie interval and Qi-Yun start. `instant` is physical time;
 * `birthCivilTime` is the already-resolved civil/mean-solar/true-solar clock.
 */
export function calculateQiYun(
  instant: Ut1Input,
  birthCivilTime: CivilDateTime,
  chart: BaziChart,
  gender: Gender,
  rawOptions: QiYunOptions = {},
): QiYunResult {
  validateCivilTime(birthCivilTime);
  const timeModel = rawOptions.timeModel ?? QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR;
  if (![QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR, QIYUN_TIME_MODEL.JULIAN_YEAR,
    QIYUN_TIME_MODEL.TROPICAL_YEAR].includes(timeModel)) {
    throw new RangeError('unknown Qi-Yun time model');
  }
  const { timeModel: _timeModel, ...calendarOptions } = rawOptions;
  const jdUT1 = asUt1JulianDay(instant);
  const direction = calculateLuckDirection(chart.pillars.year, gender);
  let referenceJie = getPreviousJie(jdUT1, calendarOptions);
  let intervalDays = jdUT1 - referenceJie.jdUT1;
  if (Math.abs(intervalDays) <= ROOT_EQUALITY_DAYS) {
    intervalDays = 0;
  } else if (direction > 0) {
    referenceJie = getNextJie(jdUT1, calendarOptions);
    intervalDays = referenceJie.jdUT1 - jdUT1;
  }
  if (!Number.isFinite(intervalDays) || intervalDays < -ROOT_EQUALITY_DAYS) {
    throw new Error('solar-term search returned an invalid Qi-Yun interval');
  }
  intervalDays = Math.max(0, intervalDays);
  const { offset: traditionalOffset, remainingMonthDays } = decomposeTraditionalOffset(intervalDays);
  let startJdUT1: number;
  let startCivilTime: Readonly<CivilDateTime>;
  if (timeModel === QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR) {
    const added = addCalendarComponents(
      birthCivilTime,
      traditionalOffset.years,
      traditionalOffset.months,
      remainingMonthDays,
    );
    startJdUT1 = jdUT1 + added.elapsedDays;
    startCivilTime = added.civilTime;
  } else {
    const yearDays = timeModel === QIYUN_TIME_MODEL.JULIAN_YEAR
      ? DAYS_PER_JULIAN_YEAR : DAYS_PER_TROPICAL_YEAR;
    const elapsedDays = intervalDays * yearDays / 3;
    startJdUT1 = jdUT1 + elapsedDays;
    startCivilTime = Object.freeze(calendarDateFromJulianDay(julianDay(birthCivilTime) + elapsedDays));
  }
  return Object.freeze({
    direction,
    timeModel,
    referenceJie: Object.freeze({ ...referenceJie }),
    jieIntervalDays: intervalDays,
    startAgeYears: intervalDays / 3,
    traditionalOffset,
    startJdUT1,
    startCivilTime,
  });
}

export interface DaYunEntry extends DaYunPillar {
  readonly startJdUT1: number;
  readonly endJdUT1: number;
  readonly startCivilTime: Readonly<CivilDateTime>;
  readonly endCivilTime: Readonly<CivilDateTime>;
}

export interface DaYunOptions {
  count?: number;
  boundaryModel?: DaYunBoundaryModel;
}

export function generateDaYun(
  birthCivilTime: CivilDateTime,
  chart: BaziChart,
  qiYun: QiYunResult,
  options: DaYunOptions = {},
): readonly DaYunEntry[] {
  validateCivilTime(birthCivilTime);
  const count = options.count ?? 8;
  const boundaryModel = options.boundaryModel ?? DAYUN_BOUNDARY_MODEL.CIVIL_YEARS;
  if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a non-negative integer');
  if (![DAYUN_BOUNDARY_MODEL.CIVIL_YEARS, DAYUN_BOUNDARY_MODEL.JULIAN_YEARS,
    DAYUN_BOUNDARY_MODEL.TROPICAL_YEARS].includes(boundaryModel)) {
    throw new RangeError('unknown Da-Yun boundary model');
  }
  const continuousYearDays = boundaryModel === DAYUN_BOUNDARY_MODEL.JULIAN_YEARS
    ? DAYS_PER_JULIAN_YEAR : DAYS_PER_TROPICAL_YEAR;
  return Object.freeze(Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const startYears = offset * 10;
    const endYears = index * 10;
    let startJdUT1: number;
    let endJdUT1: number;
    let startCivilTime: Readonly<CivilDateTime>;
    let endCivilTime: Readonly<CivilDateTime>;
    if (boundaryModel === DAYUN_BOUNDARY_MODEL.CIVIL_YEARS) {
      const start = addCalendarComponents(qiYun.startCivilTime, startYears, 0, 0);
      const end = addCalendarComponents(qiYun.startCivilTime, endYears, 0, 0);
      startJdUT1 = qiYun.startJdUT1 + start.elapsedDays;
      endJdUT1 = qiYun.startJdUT1 + end.elapsedDays;
      startCivilTime = start.civilTime;
      endCivilTime = end.civilTime;
    } else {
      const startDays = startYears * continuousYearDays;
      const endDays = endYears * continuousYearDays;
      startJdUT1 = qiYun.startJdUT1 + startDays;
      endJdUT1 = qiYun.startJdUT1 + endDays;
      const originCivilJd = julianDay(qiYun.startCivilTime);
      startCivilTime = Object.freeze(calendarDateFromJulianDay(originCivilJd + startDays));
      endCivilTime = Object.freeze(calendarDateFromJulianDay(originCivilJd + endDays));
    }
    const startVirtualAge = startCivilTime.year - birthCivilTime.year + 1;
    return Object.freeze({
      index,
      pillar: advanceGanzhi(chart.pillars.month, qiYun.direction * index),
      startVirtualAge,
      endVirtualAge: startVirtualAge + 9,
      startJdUT1,
      endJdUT1,
      startCivilTime,
      endCivilTime,
    });
  }));
}

const SILING_STEM = [
  [[8, 9], [9, 6, 5], [4, 2, 0], [0, 1], [1, 8, 4], [4, 6, 2],
    [2, 3], [3, 0, 5], [4, 8, 6], [6, 7], [7, 2, 4], [4, 0, 8]],
  [[8, 9], [9, 7, 5], [4, 2, 0], [0, 1], [1, 9, 4], [4, 6, 2],
    [2, 5, 3], [3, 1, 5], [4, 8, 6], [6, 7], [7, 3, 4], [4, 0, 8]],
] as const;
const SILING_DURATION = [
  [[7, 23], [7, 5, 18], [5, 5, 20], [7, 23], [7, 5, 18], [7, 5, 18],
    [7, 23], [7, 5, 18], [5, 5, 20], [7, 23], [7, 5, 18], [5, 5, 20]],
  [[10, 20], [9, 3, 18], [7, 7, 16], [10, 20], [9, 3, 18], [5, 9, 16],
    [10, 9, 11], [9, 3, 18], [10, 3, 17], [10, 20], [9, 3, 18], [7, 5, 18]],
] as const;

export interface RenyuanSilingSegment {
  readonly index: number;
  readonly stem: number;
  readonly origin: RenyuanSilingOrigin;
  readonly startDay: number;
  readonly endDay: number;
}

function silingOrigin(table: RenyuanSilingTable, branch: number, index: number): RenyuanSilingOrigin {
  if (table === RENYUAN_SILING_TABLE.SAN_MING_TONG_HUI && branch === 2 && index === 0) {
    return RENYUAN_SILING_ORIGIN.GEN_EARTH;
  }
  if (table === RENYUAN_SILING_TABLE.SAN_MING_TONG_HUI && branch === 8 && index === 0) {
    return RENYUAN_SILING_ORIGIN.KUN_EARTH;
  }
  return RENYUAN_SILING_ORIGIN.STEM;
}

export function getRenyuanSilingSegments(
  monthBranch: number,
  table: RenyuanSilingTable = RENYUAN_SILING_TABLE.SAN_MING_TONG_HUI,
): readonly RenyuanSilingSegment[] {
  if (!Number.isInteger(monthBranch) || monthBranch < 0 || monthBranch >= 12) {
    throw new RangeError('monthBranch must be 0..11');
  }
  if (table !== RENYUAN_SILING_TABLE.SAN_MING_TONG_HUI && table !== RENYUAN_SILING_TABLE.COMMON) {
    throw new RangeError('unknown Renyuan-Siling table');
  }
  let startDay = 0;
  return Object.freeze(SILING_STEM[table][monthBranch]!.map((stem, index) => {
    const endDay = startDay + SILING_DURATION[table][monthBranch]![index]!;
    const segment = Object.freeze({
      index,
      stem,
      origin: silingOrigin(table, monthBranch, index),
      startDay,
      endDay,
    });
    startDay = endDay;
    return segment;
  }));
}

export function selectRenyuanSiling(
  monthBranch: number,
  daysSinceJie: number,
  table: RenyuanSilingTable = RENYUAN_SILING_TABLE.SAN_MING_TONG_HUI,
): RenyuanSilingSegment {
  if (!Number.isFinite(daysSinceJie) || daysSinceJie < 0) {
    throw new RangeError('daysSinceJie must be finite and non-negative');
  }
  const segments = getRenyuanSilingSegments(monthBranch, table);
  return segments.find((segment) => daysSinceJie < segment.endDay) ?? segments[segments.length - 1]!;
}

import {
  CALENDAR_MODE,
  EARTHLY_BRANCHES,
  PILLAR_HISTORICAL_MODE,
  RAT_HOUR_MODE,
  ZonedTime,
  advanceGanzhi,
  calculateDayPillar,
  calendarDateFromJulianDay,
  ganzhiBranch,
  ganzhiIndex,
  ganzhiStem,
  getMonthGanzhi,
  getNextJie,
  getSpecificSolarTerm,
  historicalEventCivilDay,
  julianDay,
  makeGanzhi,
  type CalendarOptions,
  type CivilDate,
  type Ganzhi,
  type SolarTermEvent,
} from 'js-ephemeris-lite';
import { BaziChart } from './chart.js';
import {
  BaziOptions,
  resolveBaziOptions,
  type BaziOptionsInput,
} from './options.js';

const SECONDS_PER_DAY = 86_400;
const CHINA_OFFSET_DAYS = 480 / 1440;
const MONTH_START_JIE_INDICES = Object.freeze([21, 23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]);
const SOLAR_TERM_NAMES_FROM_WINTER_SOLSTICE = Object.freeze([
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
  '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
]);

export const BAZI_DATE_PHASE = Object.freeze({
  NORMAL: 'normal',
  BEFORE_JIE: 'before-jie',
  AFTER_JIE: 'after-jie',
} as const);
export type BaziDatePhase = typeof BAZI_DATE_PHASE[keyof typeof BAZI_DATE_PHASE];

export interface BaziDateSearchQuery {
  readonly year?: Ganzhi;
  readonly month?: Ganzhi;
  readonly day?: Ganzhi;
  /** Inclusive local civil date. */
  readonly startDate: CivilDate;
  /** Inclusive local civil date. */
  readonly endDate: CivilDate;
  readonly options?: BaziOptions | BaziOptionsInput;
}

export interface BaziDateCandidate {
  readonly date: Readonly<CivilDate>;
  readonly phase: BaziDatePhase;
  readonly sampleTime: ZonedTime;
  readonly chart: BaziChart;
  readonly jieName: string | null;
  readonly jieTime: ZonedTime | null;
  readonly isJieBoundaryDay: boolean;
  readonly options: BaziOptions;
}

export interface BaziTimeSearchQuery {
  readonly dateCandidate: BaziDateCandidate;
  readonly hour?: Ganzhi;
}

export interface BaziTimeCandidate {
  readonly startTime: ZonedTime;
  readonly endTime: ZonedTime;
  readonly sampleTime: ZonedTime;
  readonly chart: BaziChart;
  readonly hourIndex: number;
  readonly isLateZi: boolean;
  readonly hourPillar: Ganzhi;
  readonly label: string;
}

export interface BaziFullSearchQuery {
  readonly year: Ganzhi;
  readonly month: Ganzhi;
  readonly day: Ganzhi;
  readonly hour?: Ganzhi;
  /** Inclusive local civil date. */
  readonly startDate: CivilDate;
  /** Inclusive local civil date. */
  readonly endDate: CivilDate;
  readonly options?: BaziOptions | BaziOptionsInput;
}

export interface BaziFullCandidate {
  readonly dateCandidate: BaziDateCandidate;
  readonly timeCandidate: BaziTimeCandidate | null;
  readonly chart: BaziChart;
}

interface SearchWindow {
  readonly start: ZonedTime;
  readonly endExclusive: ZonedTime;
}

interface JieBoundary {
  readonly event: SolarTermEvent;
  readonly time: ZonedTime;
}

interface TimeState {
  readonly chart: BaziChart;
  readonly hourIndex: number;
  readonly isLateZi: boolean;
}

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function freezeDate(value: CivilDate): Readonly<CivilDate> {
  return Object.freeze({ year: value.year, month: value.month, day: value.day });
}

function validateDate(value: CivilDate, name: string): Readonly<CivilDate> {
  if (!value || !Number.isInteger(value.year) || !Number.isInteger(value.month)
    || !Number.isInteger(value.day)) {
    throw new TypeError(`${name} must contain integer year, month and day fields`);
  }
  const probe = calendarDateFromJulianDay(julianDay({ ...value, hour: 12, minute: 0, second: 0 }));
  if (probe.year !== value.year || probe.month !== value.month || probe.day !== value.day) {
    throw new RangeError(`${name} is not a valid civil date`);
  }
  return freezeDate(value);
}

function addCivilDays(value: CivilDate, days: number): Readonly<CivilDate> {
  const result = calendarDateFromJulianDay(
    julianDay({ ...value, hour: 12, minute: 0, second: 0 }) + days,
  );
  return freezeDate(result);
}

function compareDates(first: CivilDate, second: CivilDate): number {
  return julianDay({ ...first, hour: 12, minute: 0, second: 0 })
    - julianDay({ ...second, hour: 12, minute: 0, second: 0 });
}

function sameDate(first: CivilDate, second: CivilDate): boolean {
  return first.year === second.year && first.month === second.month && first.day === second.day;
}

function startOfDate(date: CivilDate, options: BaziOptions): ZonedTime {
  return new ZonedTime({ ...date, hour: 0, minute: 0, second: 0, offsetMinutes: options.utcOffsetMinutes });
}

function endExclusiveOfDate(date: CivilDate, options: BaziOptions): ZonedTime {
  return startOfDate(addCivilDays(date, 1), options);
}

function addSeconds(value: ZonedTime, seconds: number): ZonedTime {
  return ZonedTime.fromJulianTime(
    value.toJulianTime().jdUT1 + seconds / SECONDS_PER_DAY,
    value.offsetMinutes,
  );
}

function secondsBetween(first: ZonedTime, second: ZonedTime): number {
  return Math.round((second.toJulianTime().jdUT1 - first.toJulianTime().jdUT1) * SECONDS_PER_DAY);
}

function compareTimes(first: ZonedTime, second: ZonedTime): number {
  return first.toJulianTime().jdUT1 - second.toJulianTime().jdUT1;
}

function calendarOptions(options: BaziOptions): CalendarOptions {
  return Object.freeze({
    mode: options.mode,
    utcOffsetMinutes: options.utcOffsetMinutes,
    meridianDeg: options.meridianDeg,
  });
}

function samePillar(first: Ganzhi, second: Ganzhi): boolean {
  return ganzhiIndex(first) === ganzhiIndex(second);
}

function matchesPillar(actual: Ganzhi, expected: Ganzhi | undefined): boolean {
  return expected === undefined || samePillar(actual, expected);
}

function validatePillar(value: Ganzhi | undefined, name: string): void {
  if (value === undefined) return;
  try {
    ganzhiIndex(value);
  } catch {
    throw new RangeError(`${name} must be a valid Ganzhi pillar`);
  }
}

function monthIndexFromPillar(month: Ganzhi): number {
  return positiveMod(ganzhiBranch(month) - 2, 12);
}

function yearPillarForCivilYear(year: number): Ganzhi {
  return advanceGanzhi(makeGanzhi(0, 0), year - 1984);
}

function chartAt(time: ZonedTime, options: BaziOptions): BaziChart {
  return BaziChart.fromZonedTime(time, options);
}

function matchesDateQuery(chart: BaziChart, query: BaziDateSearchQuery): boolean {
  return matchesPillar(chart.pillars.year, query.year)
    && matchesPillar(chart.pillars.month, query.month)
    && matchesPillar(chart.pillars.day, query.day);
}

function validateDateQuery(query: BaziDateSearchQuery): {
  startDate: Readonly<CivilDate>;
  endDate: Readonly<CivilDate>;
  options: BaziOptions;
} {
  validatePillar(query.year, 'year');
  validatePillar(query.month, 'month');
  validatePillar(query.day, 'day');
  const startDate = validateDate(query.startDate, 'startDate');
  const endDate = validateDate(query.endDate, 'endDate');
  if (compareDates(startDate, endDate) > 0) {
    throw new RangeError('startDate must be earlier than or equal to endDate');
  }
  if (query.year !== undefined && query.month !== undefined) {
    const expected = getMonthGanzhi(ganzhiStem(query.year), monthIndexFromPillar(query.month));
    if (!samePillar(expected, query.month)) {
      throw new RangeError('month pillar does not match year pillar by Wu-Hu-Dun');
    }
  }
  return { startDate, endDate, options: resolveBaziOptions(query.options) };
}

function specificJieBoundary(year: number, jieIndex: number, options: BaziOptions): JieBoundary {
  const event = getSpecificSolarTerm(year, jieIndex, calendarOptions(options));
  return jieBoundaryFromEvent(event, options);
}

function usesHistoricalPillarBoundary(options: BaziOptions): boolean {
  if (options.pillarHistoricalMode === PILLAR_HISTORICAL_MODE.ON) return true;
  if (options.pillarHistoricalMode === PILLAR_HISTORICAL_MODE.OFF) return false;
  return options.mode === CALENDAR_MODE.HISTORICAL;
}

function jieBoundaryFromEvent(event: SolarTermEvent, options: BaziOptions): JieBoundary {
  let boundaryJd = event.time.jdUT1;
  if (usesHistoricalPillarBoundary(options)) {
    const assignedDay = historicalEventCivilDay('solarTerm', event.time.jdUT1);
    if (assignedDay !== null) boundaryJd = assignedDay - 0.5 - CHINA_OFFSET_DAYS;
  }
  return Object.freeze({
    event,
    time: ZonedTime.fromJulianTime(boundaryJd, options.utcOffsetMinutes),
  });
}

function monthBoundary(yearStart: number, boundaryIndex: number, options: BaziOptions): JieBoundary {
  const normalized = boundaryIndex === 12 ? 0 : boundaryIndex;
  const jieIndex = MONTH_START_JIE_INDICES[normalized]!;
  const gregorianYear = boundaryIndex >= 11 ? yearStart + 1 : yearStart;
  return specificJieBoundary(gregorianYear, jieIndex, options);
}

function intersectWindows(first: SearchWindow, second: SearchWindow): SearchWindow | null {
  const start = compareTimes(first.start, second.start) >= 0 ? first.start : second.start;
  const endExclusive = compareTimes(first.endExclusive, second.endExclusive) <= 0
    ? first.endExclusive
    : second.endExclusive;
  return compareTimes(start, endExclusive) < 0 ? Object.freeze({ start, endExclusive }) : null;
}

function buildSearchWindows(
  query: BaziDateSearchQuery,
  startDate: CivilDate,
  endDate: CivilDate,
  options: BaziOptions,
): readonly SearchWindow[] {
  const searchWindow = Object.freeze({
    start: startOfDate(startDate, options),
    endExclusive: endExclusiveOfDate(endDate, options),
  });
  if (query.year === undefined && query.month === undefined) return Object.freeze([searchWindow]);

  const windows: SearchWindow[] = [];
  for (let yearStart = startDate.year - 1; yearStart <= endDate.year + 1; yearStart += 1) {
    const yearPillar = yearPillarForCivilYear(yearStart);
    if (query.year !== undefined && !samePillar(yearPillar, query.year)) continue;
    const yearWindow = intersectWindows(Object.freeze({
      start: specificJieBoundary(yearStart, 21, options).time,
      endExclusive: specificJieBoundary(yearStart + 1, 21, options).time,
    }), searchWindow);
    if (!yearWindow) continue;
    if (query.month === undefined) {
      windows.push(yearWindow);
      continue;
    }
    const monthIndex = monthIndexFromPillar(query.month);
    const expectedMonth = getMonthGanzhi(ganzhiStem(yearPillar), monthIndex);
    if (!samePillar(expectedMonth, query.month)) continue;
    const narrowed = intersectWindows(Object.freeze({
      start: monthBoundary(yearStart, monthIndex, options).time,
      endExclusive: monthBoundary(yearStart, monthIndex + 1, options).time,
    }), yearWindow);
    if (narrowed) windows.push(narrowed);
  }
  return Object.freeze(windows);
}

function termName(event: SolarTermEvent): string {
  return SOLAR_TERM_NAMES_FROM_WINTER_SOLSTICE[event.indexFromWinterSolstice] ?? '节气';
}

function findJieOnDate(date: CivilDate, options: BaziOptions): JieBoundary | null {
  const dayStart = startOfDate(date, options);
  const dayEnd = endExclusiveOfDate(date, options);
  let event = getNextJie(dayStart.toJulianTime().jdUT1 - 3, calendarOptions(options));
  for (let index = 0; index < 2; index += 1) {
    const boundary = jieBoundaryFromEvent(event, options);
    if (sameDate(boundary.time, date)) return boundary;
    if (compareTimes(boundary.time, dayEnd) >= 0) break;
    event = getNextJie(event.time.jdUT1 + 2 / SECONDS_PER_DAY, calendarOptions(options));
  }
  return null;
}

function clampedNormalSample(date: CivilDate, window: SearchWindow): ZonedTime {
  const noon = new ZonedTime({
    ...date, hour: 12, minute: 0, second: 0, offsetMinutes: window.start.offsetMinutes,
  });
  if (compareTimes(noon, window.start) < 0) return window.start;
  const last = addSeconds(window.endExclusive, -1);
  if (compareTimes(noon, last) > 0) return last;
  return noon;
}

function makeDateCandidate(
  date: CivilDate,
  sampleTime: ZonedTime,
  phase: BaziDatePhase,
  options: BaziOptions,
  jie: JieBoundary | null,
): BaziDateCandidate {
  return Object.freeze({
    date: freezeDate(date),
    phase,
    sampleTime,
    chart: chartAt(sampleTime, options),
    jieName: jie ? termName(jie.event) : null,
    jieTime: jie?.time ?? null,
    isJieBoundaryDay: phase !== BAZI_DATE_PHASE.NORMAL,
    options,
  });
}

function candidatesForDate(
  date: CivilDate,
  window: SearchWindow,
  query: BaziDateSearchQuery,
  options: BaziOptions,
): readonly BaziDateCandidate[] {
  const jie = findJieOnDate(date, options);
  const raw = jie
    ? [
      makeDateCandidate(date, addSeconds(jie.time, -1), BAZI_DATE_PHASE.BEFORE_JIE, options, jie),
      makeDateCandidate(date, addSeconds(jie.time, 1), BAZI_DATE_PHASE.AFTER_JIE, options, jie),
    ]
    : [makeDateCandidate(date, clampedNormalSample(date, window), BAZI_DATE_PHASE.NORMAL, options, null)];
  return Object.freeze(raw.filter((candidate) => compareTimes(candidate.sampleTime, window.start) >= 0
    && compareTimes(candidate.sampleTime, window.endExclusive) < 0
    && matchesDateQuery(candidate.chart, query)));
}

function datesMatchingDayPillar(
  window: SearchWindow,
  targetDay: Ganzhi | undefined,
): readonly Readonly<CivilDate>[] {
  const start = freezeDate(window.start);
  const end = freezeDate(addSeconds(window.endExclusive, -1));
  if (targetDay === undefined) {
    const dates: Readonly<CivilDate>[] = [];
    for (let current = start; compareDates(current, end) <= 0; current = addCivilDays(current, 1)) {
      dates.push(current);
    }
    return Object.freeze(dates);
  }
  const firstIndex = ganzhiIndex(calculateDayPillar(start));
  const offset = positiveMod(ganzhiIndex(targetDay) - firstIndex, 60);
  const dates: Readonly<CivilDate>[] = [];
  for (let current = addCivilDays(start, offset); compareDates(current, end) <= 0;
    current = addCivilDays(current, 60)) {
    dates.push(current);
  }
  return Object.freeze(dates);
}

function candidateKey(candidate: BaziDateCandidate): string {
  return `${candidate.phase}@${candidate.sampleTime.toJulianTime().jdUT1}`;
}

export function searchBaziDates(query: BaziDateSearchQuery): readonly BaziDateCandidate[] {
  const { startDate, endDate, options } = validateDateQuery(query);
  const results: BaziDateCandidate[] = [];
  const seen = new Set<string>();
  for (const window of buildSearchWindows(query, startDate, endDate, options)) {
    for (const date of datesMatchingDayPillar(window, query.day)) {
      for (const candidate of candidatesForDate(date, window, query, options)) {
        const key = candidateKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(candidate);
      }
    }
  }
  results.sort((first, second) => compareTimes(first.sampleTime, second.sampleTime));
  return Object.freeze(results);
}

function timeWindowForCandidate(candidate: BaziDateCandidate): SearchWindow | null {
  let start = startOfDate(candidate.date, candidate.options);
  let endExclusive = endExclusiveOfDate(candidate.date, candidate.options);
  if (candidate.phase === BAZI_DATE_PHASE.BEFORE_JIE && candidate.jieTime) {
    endExclusive = candidate.jieTime;
  } else if (candidate.phase === BAZI_DATE_PHASE.AFTER_JIE && candidate.jieTime) {
    start = candidate.jieTime;
  }
  return compareTimes(start, endExclusive) < 0 ? Object.freeze({ start, endExclusive }) : null;
}

function evaluateTimeState(candidate: BaziDateCandidate, clockTime: ZonedTime): TimeState | null {
  const chart = chartAt(clockTime, candidate.options);
  if (!samePillar(chart.pillars.year, candidate.chart.pillars.year)
    || !samePillar(chart.pillars.month, candidate.chart.pillars.month)
    || !samePillar(chart.pillars.day, candidate.chart.pillars.day)) {
    return null;
  }
  const hourIndex = ganzhiBranch(chart.pillars.hour);
  const isLateZi = candidate.options.ratHourMode !== RAT_HOUR_MODE.NEXT_DAY
    && hourIndex === 0
    && chart.birthCivilTime.hour >= 23;
  return Object.freeze({ chart, hourIndex, isLateZi });
}

function sameTimeState(first: TimeState | null, second: TimeState | null): boolean {
  if (!first || !second) return first === second;
  return first.hourIndex === second.hourIndex
    && first.isLateZi === second.isLateZi
    && samePillar(first.chart.pillars.hour, second.chart.pillars.hour);
}

function findStateChange(
  candidate: BaziDateCandidate,
  from: ZonedTime,
  to: ZonedTime,
  previousState: TimeState | null,
): ZonedTime {
  let left = 0;
  let right = secondsBetween(from, to);
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    const state = evaluateTimeState(candidate, addSeconds(from, middle));
    if (sameTimeState(state, previousState)) left = middle + 1;
    else right = middle;
  }
  return addSeconds(from, left);
}

function makeTimeCandidate(
  candidate: BaziDateCandidate,
  state: TimeState,
  startTime: ZonedTime,
  endTime: ZonedTime,
): BaziTimeCandidate {
  const sampleTime = addSeconds(startTime, Math.floor(secondsBetween(startTime, endTime) / 2));
  const chart = chartAt(sampleTime, candidate.options);
  return Object.freeze({
    startTime,
    endTime,
    sampleTime,
    chart,
    hourIndex: state.hourIndex,
    isLateZi: state.isLateZi,
    hourPillar: chart.pillars.hour,
    label: state.isLateZi ? '晚子时' : `${EARTHLY_BRANCHES[state.hourIndex]}时`,
  });
}

export function searchBaziTimesForDate(query: BaziTimeSearchQuery): readonly BaziTimeCandidate[] {
  validatePillar(query.hour, 'hour');
  const window = timeWindowForCandidate(query.dateCandidate);
  if (!window) return Object.freeze([]);
  const points: ZonedTime[] = [window.start];
  for (let cursor = addSeconds(window.start, 600); compareTimes(cursor, window.endExclusive) < 0;
    cursor = addSeconds(cursor, 600)) {
    points.push(cursor);
  }
  const lastSample = addSeconds(window.endExclusive, -1);
  if (compareTimes(points.at(-1)!, lastSample) !== 0) points.push(lastSample);

  const results: BaziTimeCandidate[] = [];
  let previousPoint = points[0]!;
  let previousState = evaluateTimeState(query.dateCandidate, previousPoint);
  let segmentStart: ZonedTime | null = previousState ? previousPoint : null;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    const state = evaluateTimeState(query.dateCandidate, point);
    if (!sameTimeState(previousState, state)) {
      const changeAt = findStateChange(query.dateCandidate, previousPoint, point, previousState);
      if (previousState && segmentStart) {
        results.push(makeTimeCandidate(query.dateCandidate, previousState, segmentStart, addSeconds(changeAt, -1)));
        segmentStart = null;
      }
      if (state) segmentStart = changeAt;
    }
    previousPoint = point;
    previousState = state;
  }
  if (previousState && segmentStart) {
    results.push(makeTimeCandidate(query.dateCandidate, previousState, segmentStart, lastSample));
  }
  const filtered = query.hour === undefined
    ? results
    : results.filter((candidate) => samePillar(candidate.hourPillar, query.hour!));
  filtered.sort((first, second) => compareTimes(first.startTime, second.startTime));
  return Object.freeze(filtered);
}

export function reverseLookupBazi(query: BaziFullSearchQuery): readonly BaziFullCandidate[] {
  validatePillar(query.hour, 'hour');
  const dateCandidates = searchBaziDates({
    year: query.year,
    month: query.month,
    day: query.day,
    startDate: query.startDate,
    endDate: query.endDate,
    options: query.options,
  });
  const results: BaziFullCandidate[] = [];
  for (const dateCandidate of dateCandidates) {
    if (query.hour === undefined) {
      results.push(Object.freeze({ dateCandidate, timeCandidate: null, chart: dateCandidate.chart }));
      continue;
    }
    for (const timeCandidate of searchBaziTimesForDate({ dateCandidate, hour: query.hour })) {
      results.push(Object.freeze({ dateCandidate, timeCandidate, chart: timeCandidate.chart }));
    }
  }
  results.sort((first, second) => compareTimes(
    first.timeCandidate?.startTime ?? first.dateCandidate.sampleTime,
    second.timeCandidate?.startTime ?? second.dateCandidate.sampleTime,
  ));
  return Object.freeze(results);
}

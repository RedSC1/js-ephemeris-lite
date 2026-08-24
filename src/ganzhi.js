import {
  CALENDAR_MODE,
  civilDayNumber,
  getPreviousJie,
  getSpecificSolarTerm,
  historicalEventCivilDay,
} from './chinese-calendar.js';
import {
  ZonedTime,
  asUt1JulianDay,
  calendarDateFromJulianDay,
  julianDay,
} from './time.js';

const J2000 = 2451545;
const JIA_ZI_YEAR = 1984;
const LI_CHUN_INDEX_FROM_VERNAL_EQUINOX = 21;
const CHINA_DAY_OFFSET = 480 / 1440;
const ROOT_EQUALITY_DAYS = 1e-10;

export const HEAVENLY_STEMS = Object.freeze([
  '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
]);

export const EARTHLY_BRANCHES = Object.freeze([
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
]);

export const WUXING = Object.freeze({
  WATER: 0,
  WOOD: 1,
  METAL: 2,
  EARTH: 3,
  FIRE: 4,
});

/** How 23:00–00:00 chooses the day pillar and the hour stem. */
export const RAT_HOUR_MODE = Object.freeze({
  /** 23:00 starts the following Ganzhi day; its hour stem follows that day. */
  NO_SPLIT: 'no-split',
  /** Keep today's day pillar and use today's day stem for the late-Zi hour. */
  TODAY_STEM: 'today-stem',
  /** Keep today's day pillar but use tomorrow's day stem for the late-Zi hour. */
  TOMORROW_STEM: 'tomorrow-stem',
});

/** Whether year/month pillar boundaries use historical assigned term days. */
export const PILLAR_HISTORICAL_MODE = Object.freeze({
  FOLLOW_CALENDAR: 'follow-calendar',
  OFF: 'off',
  ON: 'on',
});

const NAYIN_ELEMENT_BY_INDEX = Object.freeze([
  2, 2, 4, 4, 1, 1, 3, 3, 2, 2,
  4, 4, 0, 0, 3, 3, 2, 2, 1, 1,
  0, 0, 3, 3, 4, 4, 1, 1, 0, 0,
  2, 2, 4, 4, 1, 1, 3, 3, 2, 2,
  4, 4, 0, 0, 3, 3, 2, 2, 1, 1,
  0, 0, 3, 3, 4, 4, 1, 1, 0, 0,
]);

function positiveMod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function validateStem(stem) {
  if (!Number.isInteger(stem) || stem < 0 || stem >= 10) throw new RangeError('stem must be 0..9');
}

function validateBranch(branch) {
  if (!Number.isInteger(branch) || branch < 0 || branch >= 12) throw new RangeError('branch must be 0..11');
}

/** Packed as the C++ layer does: high nibble=stem, low nibble=branch. */
export function makeGanzhi(stem, branch) {
  validateStem(stem);
  validateBranch(branch);
  if ((stem & 1) !== (branch & 1)) throw new RangeError('stem and branch parity is incompatible');
  return (stem << 4) | branch;
}

export function ganzhiStem(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new RangeError('invalid Ganzhi value');
  const stem = value >> 4;
  validateStem(stem);
  validateBranch(value & 0x0f);
  if ((stem & 1) !== ((value & 0x0f) & 1)) throw new RangeError('invalid Ganzhi value');
  return stem;
}

export function ganzhiBranch(value) {
  ganzhiStem(value);
  return value & 0x0f;
}

export function ganzhiIndex(value) {
  const stem = ganzhiStem(value);
  const branch = ganzhiBranch(value);
  return positiveMod(6 * stem - 5 * branch, 60);
}

export function ganzhiName(value) {
  return `${HEAVENLY_STEMS[ganzhiStem(value)]}${EARTHLY_BRANCHES[ganzhiBranch(value)]}`;
}

export function advanceGanzhi(value, delta) {
  if (!Number.isInteger(delta)) throw new TypeError('delta must be an integer');
  const index = positiveMod(ganzhiIndex(value) + positiveMod(delta, 60), 60);
  return makeGanzhi(index % 10, index % 12);
}

/** monthIndex: 0=Yin, ..., 10=Zi, 11=Chou. */
export function getMonthGanzhi(yearStem, monthIndex) {
  validateStem(yearStem);
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex >= 12) {
    throw new RangeError('monthIndex must be 0..11');
  }
  const startStem = ((yearStem % 5) * 2 + 2) % 10;
  return makeGanzhi((startStem + monthIndex) % 10, (monthIndex + 2) % 12);
}

/** hourIndex: 0=Zi, ..., 11=Hai. */
export function getHourGanzhi(dayStem, hourIndex) {
  validateStem(dayStem);
  if (!Number.isInteger(hourIndex) || hourIndex < 0 || hourIndex >= 12) {
    throw new RangeError('hourIndex must be 0..11');
  }
  const startStem = (dayStem % 5) * 2;
  return makeGanzhi((startStem + hourIndex) % 10, hourIndex);
}

export function getNayinId(value) {
  return Math.floor(ganzhiIndex(value) / 2);
}

export function getNayinElement(value) {
  return NAYIN_ELEMENT_BY_INDEX[ganzhiIndex(value)];
}

function validateVirtualTime(value) {
  if (!value || !Number.isInteger(value.year) || !Number.isInteger(value.month)
    || !Number.isInteger(value.day) || !Number.isInteger(value.hour)
    || !Number.isInteger(value.minute) || !Number.isFinite(value.second)) {
    throw new TypeError('virtualTime must contain valid civil date-time fields');
  }
  if (value.month < 1 || value.month > 12 || value.day < 1 || value.day > 31
    || value.hour < 0 || value.hour > 23 || value.minute < 0 || value.minute > 59
    || value.second < 0 || value.second >= 60) {
    throw new RangeError('virtualTime field is outside its valid range');
  }
  const jd = julianDay({ ...value, hour: 12, minute: 0, second: 0 });
  const roundtrip = calendarDateFromJulianDay(jd);
  if (roundtrip.year !== value.year || roundtrip.month !== value.month
    || roundtrip.day !== value.day) {
    throw new RangeError('invalid virtualTime');
  }
}

/** Civil-date day pillar. Time-of-day fields are deliberately ignored. */
export function calculateDayPillar(civilDate) {
  validateVirtualTime({ ...civilDate, hour: 0, minute: 0, second: 0 });
  const noon = julianDay({ ...civilDate, hour: 12, minute: 0, second: 0 });
  const dayIndex = positiveMod(Math.floor(noon - J2000) - 6, 60);
  return makeGanzhi(dayIndex % 10, dayIndex % 12);
}

function useHistoricalTerms(options) {
  const pillarMode = options.pillarHistoricalMode ?? PILLAR_HISTORICAL_MODE.FOLLOW_CALENDAR;
  if (!Object.values(PILLAR_HISTORICAL_MODE).includes(pillarMode)) {
    throw new RangeError(`unknown pillarHistoricalMode: ${pillarMode}`);
  }
  if (pillarMode === PILLAR_HISTORICAL_MODE.ON) return true;
  if (pillarMode === PILLAR_HISTORICAL_MODE.OFF) return false;
  return (options.mode ?? CALENDAR_MODE.HISTORICAL) === CALENDAR_MODE.HISTORICAL;
}

function calendarOptions(options) {
  const { ratHourMode, pillarHistoricalMode, ...calendar } = options;
  return calendar;
}

function historicalBoundary(term, historical) {
  if (!historical) return { jdUT1: term.jdUT1, assignedDay: null };
  const assignedDay = historicalEventCivilDay('solarTerm', term.jdUT1);
  if (assignedDay === null) return { jdUT1: term.jdUT1, assignedDay: null };
  return {
    jdUT1: assignedDay - 0.5 - CHINA_DAY_OFFSET,
    assignedDay,
  };
}

function calculateYearPillar(jdUT1, virtualTime, options, historical) {
  const liChun = getSpecificSolarTerm(
    virtualTime.year,
    LI_CHUN_INDEX_FROM_VERNAL_EQUINOX,
    calendarOptions(options),
  );
  const boundary = historicalBoundary(liChun, historical).jdUT1;
  const pillarYear = virtualTime.year + (jdUT1 - boundary < -ROOT_EQUALITY_DAYS ? -1 : 0);
  const index = positiveMod(pillarYear - JIA_ZI_YEAR, 60);
  return makeGanzhi(index % 10, index % 12);
}

function calculateMonthPillar(jdUT1, yearPillar, options, historical) {
  const query = jdUT1 + (historical ? 1 : 0);
  let previousJie = getPreviousJie(query, calendarOptions(options));
  let boundary = historicalBoundary(previousJie, historical);
  const candidateInFuture = boundary.assignedDay !== null
    ? boundary.assignedDay > civilDayNumber(jdUT1, CHINA_DAY_OFFSET)
    : previousJie.jdUT1 - jdUT1 > ROOT_EQUALITY_DAYS;
  if (candidateInFuture) {
    previousJie = getPreviousJie(previousJie.jdUT1 - 10, calendarOptions(options));
    boundary = historicalBoundary(previousJie, historical);
  }
  const index = previousJie.indexFromWinterSolstice;
  if ((index & 1) === 0) throw new Error('internal error: previous Jie has an invalid index');
  const monthIndex = ((index + 21) / 2) % 12;
  return getMonthGanzhi(ganzhiStem(yearPillar), monthIndex);
}

function nextCivilDate(virtualTime) {
  return calendarDateFromJulianDay(julianDay({ ...virtualTime, hour: 0, minute: 0, second: 0 }) + 1);
}

function calculateDayAndHourPillars(virtualTime, ratHourMode) {
  if (!Object.values(RAT_HOUR_MODE).includes(ratHourMode)) {
    throw new RangeError(`unknown ratHourMode: ${ratHourMode}`);
  }
  const lateRatHour = virtualTime.hour >= 23;
  let dayAnchor = virtualTime;
  if (lateRatHour && ratHourMode === RAT_HOUR_MODE.NO_SPLIT) dayAnchor = nextCivilDate(virtualTime);
  const day = calculateDayPillar(dayAnchor);
  const hourBranch = Math.floor((virtualTime.hour + 1) / 2) % 12;
  let hourDayStem = ganzhiStem(day);
  if (lateRatHour && ratHourMode === RAT_HOUR_MODE.TOMORROW_STEM) {
    hourDayStem = ganzhiStem(advanceGanzhi(day, 1));
  }
  return { day, hour: getHourGanzhi(hourDayStem, hourBranch) };
}

/**
 * Calculate year/month/day/hour pillars.
 *
 * `instant` is the physical UT1-like instant. `virtualTime` is the resolved
 * clock used for day/hour boundaries: normally a ZonedTime, but a caller may
 * pass a separately resolved mean/apparent-solar clock with the same fields.
 */
export function calculateFourPillars(instant, virtualTime, rawOptions = {}) {
  const jdUT1 = asUt1JulianDay(instant);
  validateVirtualTime(virtualTime);
  const ratHourMode = rawOptions.ratHourMode ?? RAT_HOUR_MODE.NO_SPLIT;
  const historical = useHistoricalTerms(rawOptions);
  const year = calculateYearPillar(jdUT1, virtualTime, rawOptions, historical);
  const month = calculateMonthPillar(jdUT1, year, rawOptions, historical);
  const { day, hour } = calculateDayAndHourPillars(virtualTime, ratHourMode);
  return Object.freeze({ year, month, day, hour });
}

/** Convenience path for an ordinary fixed-offset wall clock. */
export function fourPillarsForZonedTime(zonedTime, rawOptions = {}) {
  if (!(zonedTime instanceof ZonedTime)) throw new TypeError('zonedTime must be a ZonedTime');
  return calculateFourPillars(zonedTime.toJulianTime(), zonedTime, rawOptions);
}

export function describeFourPillars(pillars) {
  return Object.freeze({
    year: ganzhiName(pillars.year),
    month: ganzhiName(pillars.month),
    day: ganzhiName(pillars.day),
    hour: ganzhiName(pillars.hour),
  });
}

export const GANZHI_INFO = Object.freeze({
  encoding: 'high nibble=stem, low nibble=branch',
  defaultRatHourMode: RAT_HOUR_MODE.NO_SPLIT,
  historicalTermBoundary: 'assigned civil day 00:00 at UTC+08',
  calendarModes: Object.values(CALENDAR_MODE),
});

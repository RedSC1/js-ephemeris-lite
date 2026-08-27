import { HISTORICAL_CALENDAR_DATA as HISTORY } from './generated/historical-calendar-data.js';
import {
  solarLongitudeState,
  solveSolarLongitude,
  solveNewMoon,
} from './calendar-events.js';
import {
  JulianTime,
  asUt1JulianDay,
  calendarDateFromJulianDay,
  julianDay,
  ut1ToTt,
} from './time.js';

const TWO_PI = 2 * Math.PI;
const SOLAR_TERM_STEP = Math.PI / 12;
const DAYS_PER_SOLAR_TERM = 15.2184;
const DAYS_PER_SYNODIC_MONTH = 29.5306;
const DAYS_PER_TROPICAL_YEAR = 365.2422;
const J2000 = 2451545;
const CHINA_OFFSET_MINUTES = 480;
const ROOT_EQUALITY_DAYS = 1e-10;
// The source lunarYear label is intentionally preserved across these reform
// windows. historicalYear records the actual calendar/ganzhi year instead.
const QIN_HAN_FIRST_YEAR_START_DAY = 1640641;
const TAICHU_FIRST_YEAR_START_DAY = 1683490;

export const CALENDAR_MODE = Object.freeze({
  HISTORICAL: 'historical',
  CHINA_ASTRONOMICAL: 'china-astronomical',
  LOCAL_ASTRONOMICAL: 'local-astronomical',
});

export const CALENDAR_DAY_BOUNDARY_MODE = Object.freeze({
  FIXED_UTC_OFFSET: 'fixed-utc-offset',
  MEAN_SOLAR_MERIDIAN: 'mean-solar-meridian',
});

export const MONTH_NAME = Object.freeze({
  NORMAL: 0,
  THIRTEEN: 1,
  LATER_NINE: 2,
  ALT_TWELVE: 3,
  ALT_ONE: 4,
  LATER_SAME_NAME: 5,
});

function positiveMod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function normalizeRadians(value) {
  return positiveMod(value, TWO_PI);
}

function normalizeOptions(options = {}) {
  const mode = options.mode ?? CALENDAR_MODE.HISTORICAL;
  if (!Object.values(CALENDAR_MODE).includes(mode)) throw new RangeError(`unknown calendar mode: ${mode}`);
  const dayBoundaryMode = options.dayBoundaryMode
    ?? CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET;
  if (!Object.values(CALENDAR_DAY_BOUNDARY_MODE).includes(dayBoundaryMode)) {
    throw new RangeError(`unknown calendar day-boundary mode: ${dayBoundaryMode}`);
  }
  const utcOffsetMinutes = options.utcOffsetMinutes ?? CHINA_OFFSET_MINUTES;
  if (!Number.isFinite(utcOffsetMinutes) || Math.abs(utcOffsetMinutes) > 14 * 60) {
    throw new RangeError('utcOffsetMinutes must be within ±14 hours');
  }
  const meridianDeg = options.meridianDeg;
  if (meridianDeg !== undefined && (!Number.isFinite(meridianDeg) || Math.abs(meridianDeg) > 180)) {
    throw new RangeError('meridianDeg must be within ±180 degrees');
  }
  if (dayBoundaryMode === CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN
    && meridianDeg === undefined) {
    throw new RangeError('meridianDeg is required for mean-solar-meridian day boundaries');
  }
  if (dayBoundaryMode === CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET
    && meridianDeg !== undefined) {
    throw new RangeError('meridianDeg is only valid with mean-solar-meridian day boundaries');
  }
  const localOffset = dayBoundaryMode === CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET
    ? utcOffsetMinutes / 1440
    : meridianDeg / 360;
  return {
    mode,
    dayBoundaryMode,
    utcOffsetMinutes,
    meridianDeg,
    localOffset,
    structureOffset: mode === CALENDAR_MODE.LOCAL_ASTRONOMICAL ? localOffset : CHINA_OFFSET_MINUTES / 1440,
    historical: mode === CALENDAR_MODE.HISTORICAL,
  };
}

export function civilDayNumber(jdUT1, dayOffset = CHINA_OFFSET_MINUTES / 1440) {
  if (!Number.isFinite(dayOffset)) throw new TypeError('civil-day offset must be finite');
  return Math.floor(asUt1JulianDay(jdUT1) + dayOffset + 0.5);
}

function solarDateFromDayNumber(dayNumber) {
  const { year, month, day } = calendarDateFromJulianDay(dayNumber - 0.5);
  return { year, month, day };
}

function solarDateDayNumber(date) {
  if (!date || !Number.isInteger(date.year) || !Number.isInteger(date.month)
    || !Number.isInteger(date.day)) {
    throw new TypeError('solar date must contain integer year, month and day');
  }
  const dayNumber = Math.floor(julianDay({ ...date, hour: 0 }) + 0.5);
  const roundtrip = solarDateFromDayNumber(dayNumber);
  if (roundtrip.year !== date.year || roundtrip.month !== date.month || roundtrip.day !== date.day) {
    throw new RangeError('invalid solar date');
  }
  return dayNumber;
}

function popcount32(value) {
  let word = value >>> 0;
  word -= (word >>> 1) & 0x55555555;
  word = (word & 0x33333333) + ((word >>> 2) & 0x33333333);
  return (((word + (word >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function packedBitAt(words, bitIndex) {
  return ((words[bitIndex >>> 5] >>> (bitIndex & 31)) & 1) !== 0;
}

function packedRank(words, prefixes, bitIndex) {
  const blockIndex = Math.floor(bitIndex / HISTORY.rankBlockEvents);
  const blockWord = blockIndex * (HISTORY.rankBlockEvents / 32);
  const wordIndex = bitIndex >>> 5;
  let rank = prefixes[blockIndex];
  for (let index = blockWord; index < wordIndex; index += 1) rank += popcount32(words[index]);
  const bitInWord = bitIndex & 31;
  if (bitInWord !== 0) {
    const mask = 0xffffffff >>> (32 - bitInWord);
    rank += popcount32(words[wordIndex] & mask);
  }
  return rank;
}

function roundedLinearDay(segment, eventIndex, phaseTicks = 0) {
  const [firstEventIndex, , baseTicks, stepTicks] = segment;
  const ticks = baseTicks + stepTicks * (eventIndex - firstEventIndex) + phaseTicks;
  return Math.floor((ticks + HISTORY.civilDayScale / 2) / HISTORY.civilDayScale);
}

function profileCivilDay(profile, eventIndex) {
  for (const segment of profile.exactSegments) {
    if (eventIndex >= segment[0] && eventIndex < segment[0] + segment[1]) {
      return roundedLinearDay(segment, eventIndex);
    }
  }
  const localIndex = eventIndex - profile.tail[0];
  const phase = profile.phaseTicks ? profile.phaseTicks[localIndex % profile.phaseTicks.length] : 0;
  let day = roundedLinearDay(profile.tail, eventIndex, phase);
  if (!packedBitAt(profile.residualMask, localIndex)) return day;
  const rank = packedRank(profile.residualMask, profile.residualRank, localIndex);
  day += packedBitAt(profile.residualSigns, rank) ? 1 : -1;
  return day;
}

function historicalEventIndex(kind, estimateJdUT1) {
  if (!Number.isFinite(estimateJdUT1) || estimateJdUT1 >= HISTORY.profileEndJd) return null;
  const profile = kind === 'solarTerm' ? HISTORY.solarTerm : HISTORY.newMoon;
  const phaseIndex = kind === 'solarTerm'
    ? Math.floor((estimateJdUT1 + 7 - 2451259) / DAYS_PER_TROPICAL_YEAR * 24)
    : Math.floor((estimateJdUT1 + 14 - 2451551) / DAYS_PER_SYNODIC_MONTH);
  const ordinal = phaseIndex - profile.firstPhaseIndex;
  return ordinal >= 0 && ordinal < profile.eventCount ? ordinal : null;
}

/** Historical-profile civil day, or null when the event lies outside it. */
export function historicalEventCivilDay(kind, estimateJdUT1) {
  if (kind !== 'solarTerm' && kind !== 'newMoon') throw new RangeError('kind must be solarTerm or newMoon');
  const eventIndex = historicalEventIndex(kind, estimateJdUT1);
  if (eventIndex === null) return null;
  return profileCivilDay(kind === 'solarTerm' ? HISTORY.solarTerm : HISTORY.newMoon, eventIndex);
}

function assignedEventDay(kind, estimateJdUT1, preciseJdUT1, options) {
  if (options.historical) {
    const historical = historicalEventCivilDay(kind, estimateJdUT1);
    if (historical !== null) return historical;
  }
  return civilDayNumber(preciseJdUT1, options.structureOffset);
}

function solarTermEvent(index, estimateJdTT, options) {
  const targetLongitude = normalizeRadians((270 + 15 * index) * Math.PI / 180);
  const solved = solveSolarLongitude(targetLongitude, estimateJdTT);
  return {
    indexFromWinterSolstice: index,
    targetLongitude,
    time: JulianTime.fromUT1(solved.jdUT1),
    jdTT: solved.jdTT,
    jdUT1: solved.jdUT1,
    deltaTSeconds: solved.deltaTSeconds,
    civilDayNumber: assignedEventDay('solarTerm', solved.jdUT1, solved.jdUT1, options),
  };
}

function newMoonEvent(estimateJdTT, options) {
  const solved = solveNewMoon(estimateJdTT);
  return {
    time: JulianTime.fromUT1(solved.jdUT1),
    jdTT: solved.jdTT,
    jdUT1: solved.jdUT1,
    deltaTSeconds: solved.deltaTSeconds,
    civilDayNumber: assignedEventDay('newMoon', solved.jdUT1, solved.jdUT1, options),
  };
}

function findWinterSolstice(jdUT1, options) {
  const targetDay = civilDayNumber(jdUT1, options.structureOffset);
  let event = solarTermEvent(0, ut1ToTt(jdUT1), options);
  while (event.civilDayNumber > targetDay) event = solarTermEvent(0, event.jdTT - DAYS_PER_TROPICAL_YEAR, options);
  for (;;) {
    const next = solarTermEvent(0, event.jdTT + DAYS_PER_TROPICAL_YEAR, options);
    if (next.civilDayNumber > targetDay) break;
    event = next;
  }
  return event;
}

function fillSolarTerms(winter, options) {
  const terms = [winter];
  for (let index = 1; index < 25; index += 1) {
    terms.push(solarTermEvent(index, terms[index - 1].jdTT + DAYS_PER_SOLAR_TERM, options));
  }
  return terms;
}

function fillNewMoons(winter, options) {
  let event = newMoonEvent(winter.jdTT, options);
  while (event.civilDayNumber > winter.civilDayNumber) {
    event = newMoonEvent(event.jdTT - DAYS_PER_SYNODIC_MONTH, options);
  }
  for (;;) {
    const next = newMoonEvent(event.jdTT + DAYS_PER_SYNODIC_MONTH, options);
    if (next.civilDayNumber > winter.civilDayNumber) break;
    event = next;
  }
  const moons = [event];
  while (moons.length < 15) moons.push(newMoonEvent(moons.at(-1).jdTT + DAYS_PER_SYNODIC_MONTH, options));
  return moons;
}

function monthNumberFromSequence(sequence) {
  return [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10][positiveMod(sequence, 12)];
}

function resolvePhysicalMonthSequences(year) {
  const sequence = Array.from({ length: 14 }, (_, index) => index);
  if (year.newMoons[13].civilDayNumber > year.solarTerms[24].civilDayNumber) {
    return { sequence, leapIndex: -1 };
  }
  let leapIndex = 1;
  while (leapIndex < 13
    && year.newMoons[leapIndex + 1].civilDayNumber > year.solarTerms[2 * leapIndex].civilDayNumber) {
    leapIndex += 1;
  }
  for (let index = leapIndex; index < sequence.length; index += 1) sequence[index] -= 1;
  return { sequence, leapIndex };
}

function assignLunarYears(months) {
  const starts = [];
  for (let index = 0; index < months.length; index += 1) {
    if (months[index].month === 1 && !months[index].isLeap && months[index].monthName !== MONTH_NAME.ALT_ONE) {
      starts.push(index);
    }
  }
  if (starts.length) {
    let firstYear;
    for (let boundary = 0; boundary < starts.length; boundary += 1) {
      const first = starts[boundary];
      const next = starts[boundary + 1] ?? months.length;
      const startDay = months[first].firstCivilDayNumber;
      const endDay = boundary + 1 < starts.length ? months[next].firstCivilDayNumber : startDay + 180;
      const year = solarDateFromDayNumber(Math.floor((startDay + endDay) / 2)).year;
      if (boundary === 0) firstYear = year;
      for (let index = first; index < next; index += 1) {
        months[index].lunarYear = year;
        months[index].historicalYear = year;
      }
    }
    for (let index = 0; index < starts[0]; index += 1) {
      months[index].lunarYear = firstYear - 1;
      months[index].historicalYear = firstYear - 1;
    }
    return;
  }
  for (const month of months) {
    const date = solarDateFromDayNumber(month.firstCivilDayNumber);
    month.lunarYear = month.month >= 11 ? date.year - 1 : date.year;
    month.historicalYear = month.lunarYear;
  }
}

function assignEarlyHistoricalMonths(yearHint, year, options, months) {
  const { sequence } = resolvePhysicalMonthSequences(year);
  const yearStarts = [];
  const baseMonths = [];
  const specialNames = [];
  for (let index = 0; index < 3; index += 1) {
    const historicalYear = yearHint + index - 1;
    let estimate;
    if (historicalYear >= -721) {
      estimate = 1457698 + Math.floor(0.342 + (historicalYear + 721) * 12.368422) * DAYS_PER_SYNODIC_MONTH;
      baseMonths[index] = 2;
      specialNames[index] = MONTH_NAME.THIRTEEN;
    }
    if (historicalYear >= -479) {
      estimate = 1546083 + Math.floor(0.5 + (historicalYear + 479) * 12.368422) * DAYS_PER_SYNODIC_MONTH;
      baseMonths[index] = 2;
      specialNames[index] = MONTH_NAME.THIRTEEN;
    }
    if (historicalYear >= -220) {
      estimate = 1640641 + Math.floor(0.866 + (historicalYear + 220) * 12.369) * DAYS_PER_SYNODIC_MONTH;
      baseMonths[index] = 11;
      specialNames[index] = MONTH_NAME.LATER_NINE;
    }
    if (!Number.isFinite(estimate)) throw new RangeError('historical month table does not cover this year');
    yearStarts[index] = assignedEventDay('newMoon', estimate, estimate, options);
  }
  for (let index = 0; index < months.length; index += 1) {
    let era = 2;
    while (era > 0 && year.newMoons[index].civilDayNumber < yearStarts[era]) era -= 1;
    const offset = Math.floor((year.newMoons[index].civilDayNumber - yearStarts[era] + 15) / DAYS_PER_SYNODIC_MONTH);
    const month = months[index];
    const winterYearShift = baseMonths[era] === 11 ? 1 : 0;
    month.historicalYear = yearHint + era - 1;
    month.lunarYear = yearHint + era - 1 - winterYearShift;
    month.monthBuildingBranch = positiveMod(sequence[index], 12);
    if (offset < 12) {
      month.month = monthNumberFromSequence(offset + baseMonths[era]);
    } else {
      month.monthName = specialNames[era];
      month.month = specialNames[era] === MONTH_NAME.THIRTEEN ? 13 : 9;
      month.isLeap = true;
    }
  }
  year.leapMonthIndex = -1;
}

function assignMonths(year, options) {
  const months = [];
  for (let index = 0; index < 14; index += 1) {
    const firstDay = year.newMoons[index].civilDayNumber;
    const dayCount = year.newMoons[index + 1].civilDayNumber - firstDay;
    const jingchu = options.historical && dayCount === 28 && firstDay === 1807696;
    if (!jingchu && (dayCount < 29 || dayCount > 30)) {
      throw new RangeError(`invalid lunar month length ${dayCount} at civil day ${firstDay}`);
    }
    months.push({
      lunarYear: 0,
      historicalYear: 0,
      month: 0,
      isLeap: false,
      dayCount,
      monthName: MONTH_NAME.NORMAL,
      monthBuildingBranch: 0,
      firstCivilDayNumber: firstDay,
      astronomicalNewMoonJdUT1: year.newMoons[index].jdUT1,
    });
  }

  const yearHint = Math.floor((year.solarTerms[0].civilDayNumber - J2000 + 190) / DAYS_PER_TROPICAL_YEAR) + 2000;
  if (options.historical && yearHint >= -721 && yearHint <= -104) {
    assignEarlyHistoricalMonths(yearHint, year, options, months);
    return months;
  }

  const physical = resolvePhysicalMonthSequences(year);
  year.leapMonthIndex = physical.leapIndex;
  for (let index = 0; index < months.length; index += 1) {
    const month = months[index];
    const sequence = physical.sequence[index];
    month.monthBuildingBranch = positiveMod(sequence, 12);
    month.month = monthNumberFromSequence(sequence);
    month.isLeap = index === physical.leapIndex;
    if (!options.historical) continue;
    const day = month.firstCivilDayNumber;
    if ((day >= 1724360 && day <= 1729794) || (day >= 1807724 && day <= 1808699)) {
      month.month = monthNumberFromSequence(sequence + 1);
    } else if (day >= 1999349 && day <= 1999467) {
      month.month = monthNumberFromSequence(sequence + 2);
    } else if (day >= 1973067 && day <= 1977052) {
      if (sequence % 12 === 0) month.month = 1;
      if (sequence === 2) {
        month.month = 1;
        month.monthName = MONTH_NAME.ALT_ONE;
      }
    }
    if (day === 1729794 || day === 1808699) {
      month.month = 12;
      month.monthName = MONTH_NAME.ALT_TWELVE;
    }
    if (day === 1977112 || day === 1999526) month.monthName = MONTH_NAME.LATER_SAME_NAME;
  }
  assignLunarYears(months);
  if (options.historical) {
    for (const month of months) {
      if (month.firstCivilDayNumber >= QIN_HAN_FIRST_YEAR_START_DAY
        && month.firstCivilDayNumber < TAICHU_FIRST_YEAR_START_DAY) {
        month.historicalYear = month.lunarYear + 1;
      }
    }
  }
  return months;
}

/** Build the 25-term/15-new-moon/14-month winter-solstice calendar window containing jdUT1. */
export function calculateChineseCalendarYear(jdUT1, rawOptions = {}) {
  const value = asUt1JulianDay(jdUT1);
  const options = normalizeOptions(rawOptions);
  const winter = findWinterSolstice(value, options);
  const solarTerms = fillSolarTerms(winter, options);
  const newMoons = fillNewMoons(winter, options);
  const year = {
    solarTerms,
    newMoons,
    months: [],
    leapMonthIndex: -1,
    firstWinterSolsticeDayNumber: solarTerms[0].civilDayNumber,
    secondWinterSolsticeDayNumber: solarTerms[24].civilDayNumber,
    mode: options.mode,
    dayBoundaryMode: options.dayBoundaryMode,
  };
  year.months = assignMonths(year, options);
  return year;
}

function termIdFromLongitudeStep(step) {
  return positiveMod(step + 5, 24);
}

function matchesTermFilter(termId, filter) {
  return filter === 'any' || (filter === 'jie' ? (termId & 1) === 0 : (termId & 1) !== 0);
}

/** Previous includes an exact boundary; next excludes it. */
export function findSolarTerm(jdUT1, { direction = 'previous', filter = 'any', ...rawOptions } = {}) {
  if (!['previous', 'next'].includes(direction)) throw new RangeError('direction must be previous or next');
  if (!['any', 'jie', 'qi'].includes(filter)) throw new RangeError('filter must be any, jie or qi');
  const value = asUt1JulianDay(jdUT1);
  const options = normalizeOptions(rawOptions);
  const jdTT = ut1ToTt(value);
  const approximateStep = Math.floor(normalizeRadians(solarLongitudeState(jdTT).value) / SOLAR_TERM_STEP);
  let best = null;
  for (let offset = -3; offset <= 3; offset += 1) {
    const longitudeStep = approximateStep + offset;
    const termId = termIdFromLongitudeStep(longitudeStep);
    if (!matchesTermFilter(termId, filter)) continue;
    const target = positiveMod(longitudeStep, 24) * SOLAR_TERM_STEP;
    const solved = solveSolarLongitude(target, jdTT + offset * DAYS_PER_SOLAR_TERM);
    const candidate = {
      indexFromWinterSolstice: positiveMod(termId + 1, 24),
      targetLongitude: target,
      time: JulianTime.fromUT1(solved.jdUT1),
      jdTT: solved.jdTT,
      jdUT1: solved.jdUT1,
      deltaTSeconds: solved.deltaTSeconds,
      civilDayNumber: assignedEventDay('solarTerm', solved.jdUT1, solved.jdUT1, options),
    };
    const difference = candidate.jdUT1 - value;
    const valid = direction === 'next' ? difference > ROOT_EQUALITY_DAYS : difference <= ROOT_EQUALITY_DAYS;
    if (!valid || (best && (direction === 'next' ? candidate.jdUT1 >= best.jdUT1 : candidate.jdUT1 <= best.jdUT1))) continue;
    best = candidate;
  }
  if (!best) throw new RangeError('solar term not found');
  return best;
}

/** 0=vernal equinox; 18=winter solstice; 19..23 are Jan–Mar terms in civilYear. */
export function getSpecificSolarTerm(civilYear, termIndexFromVernalEquinox, rawOptions = {}) {
  if (!Number.isInteger(termIndexFromVernalEquinox) || termIndexFromVernalEquinox < 0 || termIndexFromVernalEquinox >= 24) {
    throw new RangeError('term index must be 0..23');
  }
  const options = normalizeOptions(rawOptions);
  const anchor = julianDay({ year: civilYear, month: 6, day: 1 });
  const winter = findWinterSolstice(anchor, options);
  const index = termIndexFromVernalEquinox >= 19
    ? termIndexFromVernalEquinox - 18
    : termIndexFromVernalEquinox + 6;
  return solarTermEvent(index, winter.jdTT + index * DAYS_PER_SOLAR_TERM, options);
}

export function solarToLunar(solarDate, rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const targetDay = solarDateDayNumber(solarDate);
  const year = calculateChineseCalendarYear(targetDay - options.structureOffset, options);
  for (const month of year.months) {
    if (month.firstCivilDayNumber >= year.secondWinterSolsticeDayNumber) break;
    if (targetDay < month.firstCivilDayNumber || targetDay >= month.firstCivilDayNumber + month.dayCount) continue;
    return {
      year: month.lunarYear,
      historicalYear: month.historicalYear,
      month: month.month,
      day: targetDay - month.firstCivilDayNumber + 1,
      isLeap: month.isLeap,
      monthDays: month.dayCount,
      monthName: month.monthName,
    };
  }
  throw new RangeError('solar date is outside the calculated lunar window');
}

/** Convert an instant using the configured local civil date, then the selected calendar structure. */
export function instantToLunar(jdUT1, rawOptions = {}) {
  const value = asUt1JulianDay(jdUT1);
  const options = normalizeOptions(rawOptions);
  const localDate = solarDateFromDayNumber(civilDayNumber(value, options.localOffset));
  return solarToLunar(localDate, rawOptions);
}

export function lunarToSolar(lunarDate, rawOptions = {}) {
  if (!lunarDate || !Number.isInteger(lunarDate.year) || !Number.isInteger(lunarDate.month)
    || !Number.isInteger(lunarDate.day) || lunarDate.month < 1 || lunarDate.month > 13
    || lunarDate.day < 1 || lunarDate.day > 30) {
    throw new RangeError('invalid lunar date');
  }
  const options = normalizeOptions(rawOptions);
  for (let offset = 0; offset <= 1; offset += 1) {
    const anchor = julianDay({ year: lunarDate.year + offset, month: 6, day: 1, hour: 12 }) - options.structureOffset;
    const year = calculateChineseCalendarYear(anchor, options);
    for (const month of year.months) {
      if (month.firstCivilDayNumber >= year.secondWinterSolsticeDayNumber) break;
      if (month.lunarYear !== lunarDate.year || month.month !== lunarDate.month
        || month.isLeap !== Boolean(lunarDate.isLeap)
        || month.monthName !== (lunarDate.monthName ?? MONTH_NAME.NORMAL)) continue;
      if (lunarDate.day < 1 || lunarDate.day > month.dayCount) throw new RangeError('lunar day is outside the month');
      return solarDateFromDayNumber(month.firstCivilDayNumber + lunarDate.day - 1);
    }
  }
  throw new RangeError('lunar date not found');
}

/** Return the requested lunar month's length, preferring its ordinary historical name. */
export function getLunarMonthDays(lunarYear, monthNumber, isLeap = false, rawOptions = {}) {
  if (!Number.isInteger(lunarYear) || !Number.isInteger(monthNumber)
    || monthNumber < 1 || monthNumber > 13) {
    throw new RangeError('invalid lunar year or month');
  }
  const options = normalizeOptions(rawOptions);
  let exceptional = null;
  for (let offset = 0; offset <= 1; offset += 1) {
    const anchor = julianDay({ year: lunarYear + offset, month: 6, day: 1, hour: 12 })
      - options.structureOffset;
    const year = calculateChineseCalendarYear(anchor, options);
    for (const candidate of year.months) {
      if (candidate.firstCivilDayNumber >= year.secondWinterSolsticeDayNumber) break;
      if (candidate.lunarYear !== lunarYear || candidate.month !== monthNumber
        || candidate.isLeap !== Boolean(isLeap)) continue;
      if (candidate.monthName === MONTH_NAME.NORMAL) return candidate.dayCount;
      exceptional ??= candidate.dayCount;
    }
  }
  if (exceptional !== null) return exceptional;
  throw new RangeError('lunar month not found');
}

export const getPreviousSolarTerm = (jdUT1, options = {}) => findSolarTerm(
  jdUT1, { ...options, direction: 'previous', filter: 'any' },
);
export const getNextSolarTerm = (jdUT1, options = {}) => findSolarTerm(
  jdUT1, { ...options, direction: 'next', filter: 'any' },
);
export const getPreviousJie = (jdUT1, options = {}) => findSolarTerm(
  jdUT1, { ...options, direction: 'previous', filter: 'jie' },
);
export const getNextJie = (jdUT1, options = {}) => findSolarTerm(
  jdUT1, { ...options, direction: 'next', filter: 'jie' },
);
export const getPreviousQi = (jdUT1, options = {}) => findSolarTerm(
  jdUT1, { ...options, direction: 'previous', filter: 'qi' },
);
export const getNextQi = (jdUT1, options = {}) => findSolarTerm(
  jdUT1, { ...options, direction: 'next', filter: 'qi' },
);

export const HISTORICAL_PROFILE_INFO = Object.freeze({
  sha256: HISTORY.profileSha256,
  profileEndJd: HISTORY.profileEndJd,
  newMoonEvents: HISTORY.newMoon.eventCount,
  solarTermEvents: HISTORY.solarTerm.eventCount,
  packedBitBytes: HISTORY.newMoon.residualMask.byteLength + HISTORY.newMoon.residualSigns.byteLength
    + HISTORY.solarTerm.residualMask.byteLength + HISTORY.solarTerm.residualSigns.byteLength,
});

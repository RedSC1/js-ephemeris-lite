import {
  elongationState,
  solarLongitudeState,
  solveLunarPhase,
  solveSolarLongitude,
} from './calendar-events.js';
import {
  CALENDAR_DAY_BOUNDARY_MODE,
  CALENDAR_MODE,
  civilDayNumber,
  historicalEventCivilDay,
} from './chinese-calendar.js';
import {
  ZonedTime,
  calendarDateFromJulianDay,
  ut1ToTt,
} from './time.js';

const TWO_PI = 2 * Math.PI;
const DAYS_PER_TROPICAL_YEAR = 365.2422;
const DAYS_PER_SYNODIC_MONTH = 29.53058886;
const CHINA_OFFSET_MINUTES = 480;
const RANGE_START_YEAR = -6000;
const RANGE_END_YEAR = 10000;
const ROOT_EQUALITY_DAYS = 1e-8;

export const SOLAR_TERM_NAMES = Object.freeze([
  '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
]);

export const LUNAR_PHASE_NAMES = Object.freeze({
  0: '朔',
  90: '上弦',
  180: '望',
  270: '下弦',
});

const PENTAD_SUFFIXES = Object.freeze(['初候', '二候', '三候']);

function positiveMod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function normalizeYear(value) {
  if (!Number.isInteger(value)) throw new TypeError('civilYear must be an integer');
  if (value < RANGE_START_YEAR || value > RANGE_END_YEAR) {
    throw new RangeError(`civilYear must be within ${RANGE_START_YEAR}..${RANGE_END_YEAR}`);
  }
  return value;
}

function normalizeOffset(value) {
  if (!Number.isInteger(value) || Math.abs(value) > 14 * 60) {
    throw new RangeError('utcOffsetMinutes must be an integer within ±14 hours');
  }
  return value;
}

function normalizeMode(value) {
  if (!Object.values(CALENDAR_MODE).includes(value)) throw new RangeError(`unknown calendar mode: ${value}`);
  return value;
}

function normalizeDayBoundaryMode(value) {
  if (!Object.values(CALENDAR_DAY_BOUNDARY_MODE).includes(value)) {
    throw new RangeError(`unknown calendar day-boundary mode: ${value}`);
  }
  return value;
}

function normalizeMeridian(value) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || Math.abs(value) > 180) {
    throw new RangeError('meridianDeg must be within ±180 degrees');
  }
  return value;
}

function normalizePhaseAngles(values) {
  if (values === undefined) return [0];
  if (!Array.isArray(values)) throw new TypeError('lunarPhaseAnglesDeg must be an array');
  const phases = [];
  for (const value of values) {
    if (!Number.isFinite(value)) throw new TypeError('lunar phase angles must be finite');
    const normalized = positiveMod(value, 360);
    if (!phases.some(existing => Math.abs(existing - normalized) < 1e-10)) phases.push(normalized);
  }
  return phases.sort((a, b) => a - b);
}

function dateFromDayNumber(dayNumber) {
  const { year, month, day } = calendarDateFromJulianDay(dayNumber - 0.5);
  return { year, month, day };
}

function phaseName(angleDeg) {
  for (const [angle, name] of Object.entries(LUNAR_PHASE_NAMES)) {
    if (Math.abs(Number(angle) - angleDeg) < 1e-10) return name;
  }
  return `${Number(angleDeg.toFixed(6))}°月相`;
}

function structureOffset(mode, dayBoundaryMode, utcOffsetMinutes, meridianDeg) {
  if (mode !== CALENDAR_MODE.LOCAL_ASTRONOMICAL) return CHINA_OFFSET_MINUTES / 1440;
  return dayBoundaryMode === CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET
    ? utcOffsetMinutes / 1440
    : meridianDeg / 360;
}

function decorateEvent(event, {
  mode,
  dayBoundaryMode,
  utcOffsetMinutes,
  meridianDeg,
  historicalKind,
}) {
  const localTime = ZonedTime.fromJulianTime(event.time.jdUT1, utcOffsetMinutes).toJSON();
  const localCivilDayNumber = civilDayNumber(event.time.jdUT1, utcOffsetMinutes / 1440);
  let assignedCivilDayNumber = civilDayNumber(
    event.time.jdUT1,
    structureOffset(mode, dayBoundaryMode, utcOffsetMinutes, meridianDeg),
  );
  let assignmentSource = mode === CALENDAR_MODE.LOCAL_ASTRONOMICAL
    ? 'local-astronomical'
    : 'china-astronomical';
  if (mode === CALENDAR_MODE.HISTORICAL && historicalKind) {
    const historicalDay = historicalEventCivilDay(historicalKind, event.time.jdUT1);
    if (historicalDay !== null) {
      assignedCivilDayNumber = historicalDay;
      assignmentSource = 'historical-profile';
    }
  }
  return {
    ...event,
    localTime,
    localCivilDayNumber,
    localDate: dateFromDayNumber(localCivilDayNumber),
    assignedCivilDayNumber,
    assignedDate: dateFromDayNumber(assignedCivilDayNumber),
    assignmentSource,
    assignmentDiffersFromLocalDate: assignedCivilDayNumber !== localCivilDayNumber,
  };
}

function solarEvents(startJdUT1, endJdUT1, stepCount, options) {
  const startJdTT = ut1ToTt(startJdUT1);
  const startLongitude = solarLongitudeState(startJdTT).value;
  const events = [];
  for (let step = 0; step < stepCount; step += 1) {
    const targetLongitude = step / stepCount * TWO_PI;
    const forwardAngle = positiveMod(targetLongitude - startLongitude, TWO_PI);
    let solved = solveSolarLongitude(
      targetLongitude,
      startJdTT + forwardAngle / TWO_PI * DAYS_PER_TROPICAL_YEAR,
    );
    if (solved.jdUT1 < startJdUT1 - ROOT_EQUALITY_DAYS) {
      solved = solveSolarLongitude(targetLongitude, solved.jdTT + DAYS_PER_TROPICAL_YEAR);
    }
    const degree = step * 360 / stepCount;
    const termIndex = stepCount === 24 ? step : Math.floor(step / 3);
    const pentadIndex = stepCount === 72 ? step % 3 : undefined;
    const name = stepCount === 24
      ? SOLAR_TERM_NAMES[termIndex]
      : `${SOLAR_TERM_NAMES[termIndex]}·${PENTAD_SUFFIXES[pentadIndex]}`;
    // A civil year can be longer than a solar cycle: the same target may occur
    // near both January 1 and December 31. Keep occurrences, not unique angles.
    while (solved.jdUT1 < endJdUT1 - ROOT_EQUALITY_DAYS) {
      events.push(decorateEvent({
        kind: stepCount === 24 ? 'solar-term' : 'pentad',
        name,
        index: step,
        termIndex,
        pentadIndex,
        targetLongitude,
        targetLongitudeDeg: degree,
        time: solved,
      }, {
        ...options,
        historicalKind: stepCount === 24 || pentadIndex === 0 ? 'solarTerm' : null,
      }));
      solved = solveSolarLongitude(targetLongitude, solved.jdTT + DAYS_PER_TROPICAL_YEAR);
    }
  }
  return events;
}

function lunarPhaseEvents(startJdUT1, endJdUT1, anglesDeg, options) {
  const startJdTT = ut1ToTt(startJdUT1);
  const startElongation = elongationState(startJdTT).value;
  const events = [];
  for (const angleDeg of anglesDeg) {
    const targetElongation = angleDeg / 360 * TWO_PI;
    const forwardAngle = positiveMod(targetElongation - startElongation, TWO_PI);
    let solved = solveLunarPhase(
      targetElongation,
      startJdTT + forwardAngle / TWO_PI * DAYS_PER_SYNODIC_MONTH,
    );
    if (solved.jdUT1 < startJdUT1 - ROOT_EQUALITY_DAYS) {
      solved = solveLunarPhase(targetElongation, solved.jdTT + DAYS_PER_SYNODIC_MONTH);
    }
    let serial = 0;
    while (solved.jdUT1 < endJdUT1 - ROOT_EQUALITY_DAYS) {
      events.push(decorateEvent({
        kind: 'lunar-phase',
        name: phaseName(angleDeg),
        index: serial,
        phaseAngle: targetElongation,
        phaseAngleDeg: angleDeg,
        time: solved,
      }, {
        ...options,
        historicalKind: Math.abs(angleDeg) < 1e-10 ? 'newMoon' : null,
      }));
      serial += 1;
      solved = solveLunarPhase(targetElongation, solved.jdTT + DAYS_PER_SYNODIC_MONTH);
    }
  }
  return events;
}

/**
 * Calculate the requested solar terms, pentads, and lunar phases occurring
 * inside one fixed-offset civil year.
 * A civil year need not contain exactly 72 pentads; repeated target angles
 * from consecutive solar cycles are retained as separate occurrences.
 */
export function getQiShuoYear(civilYear, rawOptions = {}) {
  const year = normalizeYear(civilYear);
  const utcOffsetMinutes = normalizeOffset(rawOptions.utcOffsetMinutes ?? CHINA_OFFSET_MINUTES);
  const mode = normalizeMode(rawOptions.mode ?? CALENDAR_MODE.HISTORICAL);
  const dayBoundaryMode = normalizeDayBoundaryMode(
    rawOptions.dayBoundaryMode ?? CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET,
  );
  const meridianDeg = normalizeMeridian(rawOptions.meridianDeg);
  if (dayBoundaryMode === CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN
    && meridianDeg === undefined) {
    throw new RangeError('meridianDeg is required for mean-solar-meridian day boundaries');
  }
  if (dayBoundaryMode === CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET
    && meridianDeg !== undefined) {
    throw new RangeError('meridianDeg is only valid with mean-solar-meridian day boundaries');
  }
  const includeSolarTerms = rawOptions.includeSolarTerms ?? true;
  const includePentads = rawOptions.includePentads ?? false;
  if (typeof includeSolarTerms !== 'boolean' || typeof includePentads !== 'boolean') {
    throw new TypeError('includeSolarTerms and includePentads must be boolean');
  }
  const lunarPhaseAnglesDeg = normalizePhaseAngles(rawOptions.lunarPhaseAnglesDeg);
  const start = new ZonedTime({
    year,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    offsetMinutes: utcOffsetMinutes,
  }).toJulianTime().jdUT1;
  const end = new ZonedTime({
    year: year + 1,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    offsetMinutes: utcOffsetMinutes,
  }).toJulianTime().jdUT1;
  const options = { mode, dayBoundaryMode, utcOffsetMinutes, meridianDeg };
  const events = [];
  if (includeSolarTerms) events.push(...solarEvents(start, end, 24, options));
  if (includePentads) {
    const pentads = solarEvents(start, end, 72, options);
    events.push(...pentads.filter(event => !includeSolarTerms || event.pentadIndex !== 0));
  }
  events.push(...lunarPhaseEvents(start, end, lunarPhaseAnglesDeg, options));
  events.sort((left, right) => left.time.jdUT1 - right.time.jdUT1
    || left.kind.localeCompare(right.kind)
    || left.index - right.index);
  return {
    civilYear: year,
    utcOffsetMinutes,
    mode,
    dayBoundaryMode,
    meridianDeg,
    startJdUT1: start,
    endJdUT1: end,
    events,
  };
}

export const QI_SHUO_INFO = Object.freeze({
  rangeStartYear: RANGE_START_YEAR,
  rangeEndYear: RANGE_END_YEAR,
  defaultUtcOffsetMinutes: CHINA_OFFSET_MINUTES,
  defaultDayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET,
  dayBoundaryModes: Object.values(CALENDAR_DAY_BOUNDARY_MODE),
  civilCalendar: 'hybrid Julian/Gregorian, switch at 1582-10-15',
});

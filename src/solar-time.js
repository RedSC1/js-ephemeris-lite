import {
  apparentSunEquatorial,
  greenwichApparentSiderealTimeRadians,
  normalizeRadians,
  normalizeSignedRadians,
} from './solar-core.js';
import {
  JulianTime,
  ZonedTime,
  asUt1JulianDay,
  calendarDateFromJulianDay,
} from './time.js';

const TWO_PI = 2 * Math.PI;
const SECONDS_PER_DAY = 86400;
const CONVERSION_ITERATIONS = 12;
// Scalar JD resolution is roughly 40 microseconds near the present.
const CONVERSION_TOLERANCE_DAYS = 5e-10;

function validateLongitude(longitudeDeg) {
  if (!Number.isFinite(longitudeDeg) || Math.abs(longitudeDeg) > 180) {
    throw new RangeError('longitudeDeg must be within ±180 degrees');
  }
}

function resolveInput(value) {
  if (value instanceof ZonedTime) {
    return { instant: value.toJulianTime(), sourceClock: value };
  }
  const instant = value instanceof JulianTime
    ? value
    : JulianTime.fromUT1(asUt1JulianDay(value));
  return { instant, sourceClock: null };
}

/** A virtual solar clock. It deliberately has no UTC offset or instant conversion method. */
export class SolarClock {
  constructor({ mode, longitudeDeg, jdSolar, instant, sourceClock, equationOfTimeSeconds }) {
    const fields = calendarDateFromJulianDay(jdSolar);
    Object.assign(this, fields, {
      mode,
      longitudeDeg,
      jdSolar,
      instant,
      sourceClock,
      equationOfTimeSeconds,
    });
    Object.freeze(this);
  }

  toJSON() {
    return {
      year: this.year,
      month: this.month,
      day: this.day,
      hour: this.hour,
      minute: this.minute,
      second: this.second,
      mode: this.mode,
      longitudeDeg: this.longitudeDeg,
      jdSolar: this.jdSolar,
      jdUT1: this.instant.jdUT1,
      jdTT: this.instant.jdTT,
      sourceClock: this.sourceClock?.toJSON() ?? null,
      equationOfTimeSeconds: this.equationOfTimeSeconds,
    };
  }
}

/** Apparent solar time minus mean solar time at the same physical instant. */
export function equationOfTime(time) {
  const { instant } = resolveInput(time);
  const jdUT1 = instant.jdUT1;
  const jdTT = instant.jdTT;
  const sun = apparentSunEquatorial(jdTT);
  const rightAscension = normalizeRadians(Math.atan2(sun.position[1], sun.position[0]));
  const gast = greenwichApparentSiderealTimeRadians(jdUT1, jdTT, sun.nutation);
  const midnightFraction = jdUT1 + 0.5 - Math.floor(jdUT1 + 0.5);
  const meanSolarAngle = normalizeRadians(TWO_PI * midnightFraction);
  const apparentSolarAngle = normalizeRadians(gast - rightAscension + Math.PI);
  const equationAngle = normalizeSignedRadians(apparentSolarAngle - meanSolarAngle);
  const equationDays = equationAngle / TWO_PI;
  return Object.freeze({
    jdUT1,
    jdTT,
    equationDays,
    equationSeconds: equationDays * SECONDS_PER_DAY,
    apparentSunRightAscensionRad: rightAscension,
    gastRad: gast,
  });
}

/** Local mean solar clock: LMT = UT1 + east-positive longitude / 360°. */
export function meanSolarTime(time, longitudeDeg) {
  validateLongitude(longitudeDeg);
  const { instant, sourceClock } = resolveInput(time);
  return new SolarClock({
    mode: 'mean',
    longitudeDeg,
    jdSolar: instant.jdUT1 + longitudeDeg / 360,
    instant,
    sourceClock,
    equationOfTimeSeconds: 0,
  });
}

/** Local apparent/true solar clock: LAT = LMT + equation of time. */
export function trueSolarTime(time, longitudeDeg) {
  validateLongitude(longitudeDeg);
  const { instant, sourceClock } = resolveInput(time);
  const equation = equationOfTime(instant);
  return new SolarClock({
    mode: 'apparent',
    longitudeDeg,
    jdSolar: instant.jdUT1 + longitudeDeg / 360 + equation.equationDays,
    instant,
    sourceClock,
    equationOfTimeSeconds: equation.equationSeconds,
  });
}

export const localMeanSolarTime = meanSolarTime;
export const localApparentSolarTime = trueSolarTime;

/** Convert a local-mean solar-clock JD to a local-apparent solar-clock JD. */
export function localMeanToApparentSolarTime(jdLocalMean, longitudeDeg) {
  validateLongitude(longitudeDeg);
  if (!Number.isFinite(jdLocalMean)) throw new TypeError('jdLocalMean must be finite');
  const jdUT1 = jdLocalMean - longitudeDeg / 360;
  return jdLocalMean + equationOfTime(jdUT1).equationDays;
}

/** Invert localMeanToApparentSolarTime with the C++ fixed-point iteration. */
export function localApparentToMeanSolarTime(jdLocalApparent, longitudeDeg) {
  validateLongitude(longitudeDeg);
  if (!Number.isFinite(jdLocalApparent)) throw new TypeError('jdLocalApparent must be finite');
  let jdLocalMean = jdLocalApparent;
  for (let iteration = 0; iteration < CONVERSION_ITERATIONS; iteration += 1) {
    const jdUT1 = jdLocalMean - longitudeDeg / 360;
    const next = jdLocalApparent - equationOfTime(jdUT1).equationDays;
    if (next === jdLocalMean || Math.abs(next - jdLocalMean) <= CONVERSION_TOLERANCE_DAYS) {
      return next;
    }
    jdLocalMean = next;
  }
  throw new RangeError('apparent-to-mean solar-time conversion did not converge');
}

export const SOLAR_TIME_INFO = Object.freeze({
  longitudeConvention: 'east-positive degrees',
  meanDefinition: 'LMT = UT1 + longitude / 360 degrees',
  apparentDefinition: 'LAT = LMT + equation of time',
  clockIsVirtual: true,
});

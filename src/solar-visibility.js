import {
  apparentSunEquatorial,
  greenwichApparentSiderealTimeRadians,
  greenwichMeanSiderealTimeRadians,
  normalizeRadians,
  normalizeSignedRadians,
} from './solar-core.js';
import { J2000 } from './coordinates.js';
import {
  JulianTime,
  ZonedTime,
  asUt1JulianDay,
  ut1ToTt,
} from './time.js';

const TWO_PI = 2 * Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const AU_KM = 149597870.7;
const AU_M = AU_KM * 1000;
const SUN_RADIUS_KM = 695700;
const WGS84_A_M = 6378137;
const WGS84_E2 = 6.69437999014e-3;
const REFRACTION_CUTOFF_RAD = -DEG_TO_RAD;
const HIGH_LATITUDE_DEG = 65;
const WINDOW_STEP_DAYS = 2 / 24;
// A scalar JS Julian Day has roughly 40 microseconds of ULP near the present.
const ROOT_TOLERANCE_DAYS = 5e-10;

export const SOLAR_ALTITUDE_STATE = Object.freeze({
  NOT_FOUND: 'not-found',
  CROSSES: 'crosses',
  ALWAYS_ABOVE: 'always-above',
  ALWAYS_BELOW: 'always-below',
  TANGENT: 'tangent',
});

export const SOLAR_LIMB = Object.freeze({
  UPPER: 'upper',
  CENTER: 'center',
  LOWER: 'lower',
});

/** C++ hybrid model: Bennett below 14°, Smart above 16°, linear blend between. */
export function hybridAtmosphericRefraction(
  altitudeRad,
  { pressureMbar = 1010, temperatureCelsius = 10 } = {},
) {
  if (![altitudeRad, pressureMbar, temperatureCelsius].every(Number.isFinite)) {
    throw new TypeError('refraction arguments must be finite');
  }
  const temperatureKelvin = 273 + temperatureCelsius;
  if (pressureMbar <= 0 || temperatureKelvin <= 0 || altitudeRad < REFRACTION_CUTOFF_RAD) return 0;
  const altitudeDeg = altitudeRad * RAD_TO_DEG;
  if (altitudeDeg < -2) return 0;
  const zenithDeg = 90 - altitudeDeg;
  const tanZ = Math.tan(zenithDeg * DEG_TO_RAD);
  const smartArcmin = (58.276 * tanZ - 0.0824 * tanZ ** 3) / 60;
  const bennettArcmin = 1.02 / Math.tan(
    (altitudeDeg + 10.3 / (altitudeDeg + 5.11)) * DEG_TO_RAD,
  );
  let refractionArcmin;
  if (altitudeDeg >= 16) refractionArcmin = smartArcmin;
  else if (altitudeDeg <= 14) refractionArcmin = bennettArcmin;
  else {
    const weight = (altitudeDeg - 14) / 2;
    refractionArcmin = bennettArcmin * (1 - weight) + smartArcmin * weight;
  }
  if (!(refractionArcmin > 0)) return 0;
  const scale = pressureMbar / 1010 * (283 / temperatureKelvin);
  return refractionArcmin * scale * DEG_TO_RAD / 60;
}

function defaultAtmosphere() {
  return { pressureMbar: 1013.25, temperatureCelsius: 15 };
}

function resolveObserver(observer) {
  if (!observer || !Number.isFinite(observer.longitudeDeg)
    || !Number.isFinite(observer.latitudeDeg) || Math.abs(observer.longitudeDeg) > 180
    || Math.abs(observer.latitudeDeg) > 90) {
    throw new RangeError('observer requires longitudeDeg ±180 and latitudeDeg ±90');
  }
  const heightMeters = observer.heightMeters ?? 0;
  if (!Number.isFinite(heightMeters)) throw new TypeError('heightMeters must be finite');
  const standard = defaultAtmosphere();
  const pressureMbar = observer.pressureMbar ?? standard.pressureMbar;
  const temperatureCelsius = observer.temperatureCelsius ?? standard.temperatureCelsius;
  if (!Number.isFinite(pressureMbar) || pressureMbar <= 0 || !Number.isFinite(temperatureCelsius)) {
    throw new RangeError('invalid atmospheric pressure or temperature');
  }
  return {
    longitudeDeg: observer.longitudeDeg,
    latitudeDeg: observer.latitudeDeg,
    longitudeRad: observer.longitudeDeg * DEG_TO_RAD,
    latitudeRad: observer.latitudeDeg * DEG_TO_RAD,
    heightMeters,
    pressureMbar,
    temperatureCelsius,
  };
}

function resolveOptions(options = {}) {
  const limb = options.limb ?? SOLAR_LIMB.UPPER;
  if (!Object.values(SOLAR_LIMB).includes(limb)) throw new RangeError('limb must be upper, center or lower');
  const horizonDegrees = options.horizonDegrees ?? 0;
  if (!Number.isFinite(horizonDegrees) || Math.abs(horizonDegrees) > 90) {
    throw new RangeError('horizonDegrees must be within ±90');
  }
  return {
    limb,
    refraction: options.refraction ?? true,
    fixedDiscSize: options.fixedDiscSize ?? false,
    horizonRad: horizonDegrees * DEG_TO_RAD,
  };
}

function observerEquatorialAu(observer, siderealRad) {
  const sinLat = Math.sin(observer.latitudeRad);
  const cosLat = Math.cos(observer.latitudeRad);
  const n = WGS84_A_M / Math.sqrt(1 - WGS84_E2 * sinLat ** 2);
  const x = (n + observer.heightMeters) * cosLat;
  const z = (n * (1 - WGS84_E2) + observer.heightMeters) * sinLat;
  const angle = siderealRad + observer.longitudeRad;
  return [x * Math.cos(angle) / AU_M, x * Math.sin(angle) / AU_M, z / AU_M];
}

function rawSolarSample(jdUT1, observer, options) {
  const jdTT = ut1ToTt(jdUT1);
  const sun = apparentSunEquatorial(jdTT);
  const gmst = greenwichMeanSiderealTimeRadians(jdUT1, jdTT);
  const gast = greenwichApparentSiderealTimeRadians(jdUT1, jdTT, sun.nutation);
  const site = observerEquatorialAu(observer, gmst);
  const topocentric = sun.position.map((value, index) => value - site[index]);
  const distance = Math.hypot(...topocentric);
  const rightAscension = Math.atan2(topocentric[1], topocentric[0]);
  const declination = Math.atan2(topocentric[2], Math.hypot(topocentric[0], topocentric[1]));
  const hourAngle = normalizeSignedRadians(gast + observer.longitudeRad - rightAscension);
  const sinAltitude = Math.sin(observer.latitudeRad) * Math.sin(declination)
    + Math.cos(observer.latitudeRad) * Math.cos(declination) * Math.cos(hourAngle);
  const centerAltitude = Math.asin(Math.max(-1, Math.min(1, sinAltitude)));
  const cosAltitude = Math.max(1e-12, Math.cos(centerAltitude));
  const centerSlope = -TWO_PI * Math.cos(observer.latitudeRad)
    * Math.cos(declination) * Math.sin(hourAngle) / cosAltitude;
  const discDistance = options.fixedDiscSize ? 1 : distance;
  const angularRadius = Math.asin(Math.min(1, SUN_RADIUS_KM / (discDistance * AU_KM)));
  const limbSign = options.limb === SOLAR_LIMB.UPPER ? 1
    : options.limb === SOLAR_LIMB.LOWER ? -1 : 0;

  const eventAltitudeAt = altitude => {
    const limbAltitude = altitude + limbSign * angularRadius;
    return limbAltitude + (options.refraction
      ? hybridAtmosphericRefraction(limbAltitude, observer)
      : 0);
  };
  const eventAltitude = eventAltitudeAt(centerAltitude);
  let slope = centerSlope;
  if (options.refraction) {
    const h = 1e-5;
    slope *= (eventAltitudeAt(centerAltitude + h) - eventAltitudeAt(centerAltitude - h)) / (2 * h);
  }
  return {
    residualRad: eventAltitude - options.horizonRad,
    slopeRadPerDay: slope,
    centerAltitudeRad: centerAltitude,
    apparentAltitudeRad: eventAltitude,
    azimuthRad: normalizeRadians(Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(observer.latitudeRad)
        - Math.tan(declination) * Math.cos(observer.latitudeRad),
    ) + Math.PI),
  };
}

function analyticSeed(localNoonUT1, observer, options, eventKind) {
  let dayOfYear = (localNoonUT1 - J2000) % 365.2422;
  if (dayOfYear < 0) dayOfYear += 365.2422;
  const phase = (dayOfYear - 80) / 365.2422 * TWO_PI;
  const declination = 0.409092804222 * Math.sin(phase);
  const denominator = Math.cos(observer.latitudeRad) * Math.cos(declination);
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return null;
  const cosHourAngle = (Math.sin(options.horizonRad)
    - Math.sin(observer.latitudeRad) * Math.sin(declination)) / denominator;
  if (!(Math.abs(cosHourAngle) <= 1)) return null;
  const b = TWO_PI * (dayOfYear - 81) / 364;
  const equationOfTimeMinutes = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const meanNoonHour = 12 - equationOfTimeMinutes / 60;
  const hourAngleHours = Math.acos(cosHourAngle) * 12 / Math.PI;
  const eventHour = eventKind === 'rise'
    ? meanNoonHour - hourAngleHours
    : meanNoonHour + hourAngleHours;
  return localNoonUT1 + (eventHour - 12) / 24;
}

function newtonEvent(localNoonUT1, searchStart, searchEnd, observer, options, eventKind, counters) {
  let value = analyticSeed(localNoonUT1, observer, options, eventKind);
  if (value === null) return null;
  const iterations = options.refraction ? 3 : 2;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sample = rawSolarSample(value, observer, options);
    counters.samples += 1;
    const directionOkay = eventKind === 'rise'
      ? sample.slopeRadPerDay > 0.2
      : sample.slopeRadPerDay < -0.2;
    if (!directionOkay) return null;
    const next = value - sample.residualRad / sample.slopeRadPerDay;
    counters.refinements += 1;
    if (!Number.isFinite(next) || Math.abs(next - value) > 0.25
      || next < searchStart - 0.05 || next > searchEnd + 0.05) return null;
    value = next;
  }
  return value >= searchStart && value <= searchEnd ? value : null;
}

function bisectResidual(lo, hi, flo, observer, options, counters) {
  let lower = lo;
  let upper = hi;
  let lowerValue = flo;
  for (let iteration = 0; iteration < 60 && upper - lower > ROOT_TOLERANCE_DAYS; iteration += 1) {
    const middle = (lower + upper) / 2;
    const middleValue = rawSolarSample(middle, observer, options).residualRad;
    counters.samples += 1;
    counters.refinements += 1;
    if ((lowerValue <= 0 && middleValue >= 0) || (lowerValue >= 0 && middleValue <= 0)) {
      upper = middle;
    } else {
      lower = middle;
      lowerValue = middleValue;
    }
  }
  return (lower + upper) / 2;
}

function fallbackWindow(searchStart, searchEnd, observer, options, counters) {
  let rise = null;
  let set = null;
  let previousJd = searchStart;
  let previous = rawSolarSample(previousJd, observer, options).residualRad;
  counters.samples += 1;
  let minimum = previous;
  let maximum = previous;
  for (let jd = searchStart + WINDOW_STEP_DAYS; ; jd += WINDOW_STEP_DAYS) {
    const currentJd = Math.min(searchEnd, jd);
    const current = rawSolarSample(currentJd, observer, options).residualRad;
    counters.samples += 1;
    minimum = Math.min(minimum, current);
    maximum = Math.max(maximum, current);
    if (rise === null && previous < 0 && current > 0) {
      rise = bisectResidual(previousJd, currentJd, previous, observer, options, counters);
    }
    if (set === null && previous > 0 && current < 0) {
      set = bisectResidual(previousJd, currentJd, previous, observer, options, counters);
    }
    previousJd = currentJd;
    previous = current;
    if (currentJd >= searchEnd) break;
  }
  const altitudeState = rise !== null || set !== null ? SOLAR_ALTITUDE_STATE.CROSSES
    : minimum > 0 ? SOLAR_ALTITUDE_STATE.ALWAYS_ABOVE
      : maximum < 0 ? SOLAR_ALTITUDE_STATE.ALWAYS_BELOW
        : SOLAR_ALTITUDE_STATE.TANGENT;
  return { rise, set, altitudeState };
}

/** Topocentric apparent solar altitude using the same geometry as the fast rise/set solver. */
export function solarAltitude(time, rawObserver, rawOptions = {}) {
  const jdUT1 = asUt1JulianDay(time);
  const observer = resolveObserver(rawObserver);
  const options = resolveOptions(rawOptions);
  return rawSolarSample(jdUT1, observer, options);
}

/**
 * Fast sunrise/sunset over the UT1 day centered on `center`.
 * Ordinary latitudes use analytic seeds + Newton; polar/shallow cases use a
 * 2-hour sampled window followed by exact residual bisection.
 */
export function computeSolarRiseSetFast(center, rawObserver, rawOptions = {}) {
  const centerUT1 = asUt1JulianDay(center);
  const observer = resolveObserver(rawObserver);
  const options = resolveOptions(rawOptions);
  const searchStart = centerUT1 - 0.5;
  const searchEnd = centerUT1 + 0.5;
  const localNoon = Math.round(centerUT1 + observer.longitudeDeg / 360)
    - observer.longitudeDeg / 360;
  const counters = { samples: 0, refinements: 0 };
  let rise = null;
  let set = null;
  let path = 'analytic-newton';
  if (Math.abs(observer.latitudeDeg) <= HIGH_LATITUDE_DEG) {
    rise = newtonEvent(localNoon, searchStart, searchEnd, observer, options, 'rise', counters);
    set = newtonEvent(localNoon, searchStart, searchEnd, observer, options, 'set', counters);
  }
  let altitudeState = SOLAR_ALTITUDE_STATE.CROSSES;
  if (rise === null || set === null) {
    path = 'fallback-window';
    const fallback = fallbackWindow(searchStart, searchEnd, observer, options, counters);
    rise ??= fallback.rise;
    set ??= fallback.set;
    altitudeState = fallback.altitudeState;
  }
  if (rise !== null || set !== null) altitudeState = SOLAR_ALTITUDE_STATE.CROSSES;
  return {
    altitudeState,
    rise: rise === null ? null : JulianTime.fromUT1(rise),
    set: set === null ? null : JulianTime.fromUT1(set),
    sampleCount: counters.samples,
    refineCount: counters.refinements,
    path,
    limb: options.limb,
    refraction: options.refraction,
  };
}

/**
 * Same-type rise/set wrapper.
 * A ZonedTime selects its local civil date; a scalar JD or JulianTime selects
 * the 24-hour window centred on that instant.
 */
export function solarRiseSetForDate(
  dateOrCenter,
  observer,
  options = {},
) {
  if (dateOrCenter instanceof ZonedTime) {
    const offsetMinutes = dateOrCenter.offsetMinutes;
    const center = new ZonedTime({
      year: dateOrCenter.year,
      month: dateOrCenter.month,
      day: dateOrCenter.day,
      hour: 12,
      minute: 0,
      second: 0,
      offsetMinutes,
    }).toJulianTime();
    const result = computeSolarRiseSetFast(center, observer, options);
    return {
      ...result,
      rise: result.rise?.toZonedTime(offsetMinutes) ?? null,
      set: result.set?.toZonedTime(offsetMinutes) ?? null,
    };
  }
  if (dateOrCenter instanceof JulianTime) {
    return computeSolarRiseSetFast(dateOrCenter, observer, options);
  }
  if (Number.isFinite(dateOrCenter)) {
    const result = computeSolarRiseSetFast(dateOrCenter, observer, options);
    return {
      ...result,
      rise: result.rise?.jdUT1 ?? null,
      set: result.set?.jdUT1 ?? null,
    };
  }
  throw new TypeError('dateOrCenter must be a UT1 Julian Day, JulianTime or ZonedTime');
}

export const SOLAR_VISIBILITY_INFO = Object.freeze({
  ordinaryLatitudeLimitDeg: HIGH_LATITUDE_DEG,
  fallbackWindowStepHours: WINDOW_STEP_DAYS * 24,
  refractionModel: 'C++ hybrid (Bennett/Smart blend)',
  defaultLimb: SOLAR_LIMB.UPPER,
  defaultRefraction: true,
});

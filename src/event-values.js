// Value-only calendar evaluators. Coefficients and frames match the state APIs;
// derivative accumulation and lunar distance are deliberately skipped.
import { meanEclipticOfDateMatrix, iau2000bNutationLongitude as nutationLongitude } from './coordinates.js';
import { LOW_SOLAR_DRIFT, LOW_ELONGATION_DRIFT, FAST_EARTH_RADIUS_TERMS } from './event-series.js';
import { EARTH_L, EARTH_B, EARTH_R } from './planet-series.js';
import {
  EARTH_L_PREFIX_COUNTS,
  EARTH_B_PREFIX_COUNTS,
  EARTH_R_PREFIX_COUNTS,
} from './earth-prefix-counts.js';
import { planetTheoryToJ2000 } from './planet-frame.js';
import {
  MOON_L,
  MOON_B,
  MOON_W1,
  MOON_ARGUMENTS,
  MOON_PRECESSION_P,
  MOON_PRECESSION_Q,
} from './moon-series.js';

const J2000 = 2451545;
const SCALE_DAYS = 2922000;
const ABERRATION = 20.4898 * Math.PI / 648000;

const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const apply = (matrix, vector) => matrix.map(row =>
  row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);

function polynomial(coefficients, x) {
  let value = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) value = value * x + coefficients[i];
  return value;
}

const earthDegree = Math.max(EARTH_L.length, EARTH_B.length, EARTH_R.length) - 1;
const earthGroupsByCoordinate = [EARTH_L, EARTH_B, EARTH_R].map((blocks, coordinate) =>
  blocks.map((coefficients, power) => ({ coordinate, power, coefficients })));
const earthGroups = earthGroupsByCoordinate.flat();
const earthPrefixCounts = [EARTH_L_PREFIX_COUNTS, EARTH_B_PREFIX_COUNTS, EARTH_R_PREFIX_COUNTS];

function earthNativeValue(jd, limits, coordinates = [0, 1, 2]) {
  const tau = (jd - J2000) / 365250;
  const basis = new Float64Array(earthDegree + 1);
  basis[0] = 1;
  for (let power = 1; power <= earthDegree; power++) basis[power] = basis[power - 1] * tau;

  const values = [0, 0, 0];
  for (const { coordinate, power, coefficients } of earthGroups) {
    if (!coordinates.includes(coordinate) || limits?.[coordinate] !== undefined) continue;

    let sum = 0;
    for (let i = 0; i < coefficients.length; i += 3)
      sum += coefficients[i] * Math.cos(coefficients[i + 1] + coefficients[i + 2] * tau);
    values[coordinate] += basis[power] * sum;
  }

  if (limits) {
    for (const coordinate of coordinates) {
      const limit = limits[coordinate];
      if (limit === undefined) continue;

      const counts = earthPrefixCounts[coordinate][limit];
      if (!counts)
        throw new RangeError(`Unsupported Earth prefix ${limit} for coordinate ${coordinate}`);

      for (const { power, coefficients } of earthGroupsByCoordinate[coordinate]) {
        const end = Math.min((counts[power] ?? 0) * 3, coefficients.length);
        for (let i = 0; i < end; i += 3) {
          const value = coefficients[i]
            * Math.cos(coefficients[i + 1] + coefficients[i + 2] * tau);
          values[coordinate] += basis[power] * value;
        }
      }
    }
  }

  values[0] = wrap(values[0]);
  return values;
}

function earthPosition(jd, limits) {
  const [longitude, latitude, radius] = earthNativeValue(jd, limits);
  const cosLongitude = Math.cos(longitude);
  const sinLongitude = Math.sin(longitude);
  const cosLatitude = Math.cos(latitude);
  const sinLatitude = Math.sin(latitude);
  return planetTheoryToJ2000([
    radius * cosLatitude * cosLongitude,
    radius * cosLatitude * sinLongitude,
    radius * sinLatitude,
  ]);
}

const moonSeries = [MOON_L, MOON_B];
const rankedMoonTerms = moonSeries.map(blocks => blocks
  .flatMap((rows, power) => Array.from({ length: rows.length / 3 }, (_, term) => ({
    rows,
    index: term * 3,
    power,
    score: Math.hypot(rows[term * 3], rows[term * 3 + 1]),
  })))
  .sort((a, b) => b.score - a.score));

// Synchronous per-call scratch space; no date/result memoization.
const sine = new Float64Array(MOON_ARGUMENTS.length);
const cosine = new Float64Array(MOON_ARGUMENTS.length);
const stamps = new Uint32Array(MOON_ARGUMENTS.length);
let serial = 0;

function beginMoonEvaluation() {
  serial = (serial + 1) >>> 0;
  if (!serial) {
    stamps.fill(0);
    serial = 1;
  }
}

function evaluateMoonArgument(index, x) {
  if (stamps[index] === serial) return;

  const coefficients = MOON_ARGUMENTS[index];
  let argument = coefficients[7];
  for (let i = 6; i >= 0; i--) argument = argument * x + coefficients[i];
  argument *= x;

  sine[index] = Math.sin(argument);
  cosine[index] = Math.cos(argument);
  stamps[index] = serial;
}

function moonCoordinate(coordinate, x, limit = 'full') {
  let value = 0;
  if (limit === 'full') {
    for (let power = 0; power < moonSeries[coordinate].length; power++) {
      const rows = moonSeries[coordinate][power];
      let sum = 0;
      for (let i = 0; i < rows.length; i += 3) {
        const argumentIndex = rows[i + 2];
        evaluateMoonArgument(argumentIndex, x);
        sum += rows[i] * sine[argumentIndex] + rows[i + 1] * cosine[argumentIndex];
      }
      value += sum * x ** power;
    }
  } else {
    const ranked = rankedMoonTerms[coordinate];
    if (!Number.isInteger(limit) || limit < 0 || limit > ranked.length)
      throw new RangeError('Invalid lunar term limit');

    for (let i = 0; i < limit; i++) {
      const { rows, index, power } = ranked[i];
      const argumentIndex = rows[index + 2];
      evaluateMoonArgument(argumentIndex, x);
      value += (rows[index] * sine[argumentIndex] + rows[index + 1] * cosine[argumentIndex])
        * x ** power;
    }
  }

  if (coordinate === 0) value += polynomial(MOON_W1, x);
  return value;
}

function moonNativeLongitude(jd, terms = 'full') {
  beginMoonEvaluation();
  return moonCoordinate(0, (jd - J2000) / SCALE_DAYS, terms);
}

function moonDirection(jd, latitudeTerms = 'full', longitudeTerms = 'full') {
  beginMoonEvaluation();
  const x = (jd - J2000) / SCALE_DAYS;
  const longitude = moonCoordinate(0, x, longitudeTerms);
  const latitude = moonCoordinate(1, x, latitudeTerms);
  const cosLatitude = Math.cos(latitude);
  const native = [
    cosLatitude * Math.cos(longitude),
    cosLatitude * Math.sin(longitude),
    Math.sin(latitude),
  ];

  const t = x * 80;
  const p = polynomial(MOON_PRECESSION_P, t) * t;
  const q = polynomial(MOON_PRECESSION_Q, t) * t;
  const r = 2 * Math.sqrt(1 - p * p - q * q);
  return apply([
    [1 - 2 * p * p, 2 * p * q, p * r],
    [2 * p * q, 1 - 2 * q * q, -q * r],
    [-p * r, q * r, 1 - 2 * p * p - 2 * q * q],
  ], native);
}

export function solarLongitude(jd, fast = false) {
  const earth = earthPosition(jd, fast ? { 2: FAST_EARTH_RADIUS_TERMS } : undefined);
  const sun = apply(meanEclipticOfDateMatrix(jd), earth.map(value => -value));
  return Math.atan2(sun[1], sun[0]) + nutationLongitude(jd) - ABERRATION / Math.hypot(...earth);
}

export function elongation(jd, latitudeTerms = 'full', fast = false) {
  const frame = meanEclipticOfDateMatrix(jd);
  const moon = apply(frame, moonDirection(jd, latitudeTerms));
  const earth = earthPosition(jd, fast ? { 2: FAST_EARTH_RADIUS_TERMS } : undefined);
  const sun = apply(frame, earth.map(value => -value));
  return wrap(Math.atan2(moon[1], moon[0]) - Math.atan2(sun[1], sun[0])
    - 3.4e-6 + ABERRATION / Math.hypot(...earth));
}

// Intermediate correction only: Earth B0/R3. Main values retain full L/B/R30.
export function mediumElongation(jd, latitudeTerms, earthTerms, moonTerms) {
  const frame = meanEclipticOfDateMatrix(jd);
  const moon = apply(frame, moonDirection(jd, latitudeTerms, moonTerms));
  const earth = earthPosition(jd, { 0: earthTerms, 1: 0, 2: 3 });
  const sun = apply(frame, earth.map(value => -value));
  return wrap(Math.atan2(moon[1], moon[0]) - Math.atan2(sun[1], sun[0])
    - 3.4e-6 + ABERRATION / Math.hypot(...earth));
}

function drift(coefficients, jd) {
  const x = (jd - J2000) / SCALE_DAYS;
  let previous = 1;
  let current = x;
  let value = coefficients[0] ?? 0;
  if (coefficients.length > 1) value += coefficients[1] * x;
  for (let i = 2; i < coefficients.length; i++) {
    const next = 2 * x * current - previous;
    value += coefficients[i] * next;
    previous = current;
    current = next;
  }
  return value;
}

export function lowSolarValue(jd, withDrift = true) {
  const earth = earthPosition(jd, { 0: 10, 1: 0, 2: 3 });
  const sun = meanEclipticOfDateMatrix(jd).map(row =>
    -(row[0] * earth[0] + row[1] * earth[1] + row[2] * earth[2]));
  return Math.atan2(sun[1], sun[0]) + nutationLongitude(jd, 10)
    - ABERRATION / Math.hypot(...earth)
    + (withDrift ? drift(LOW_SOLAR_DRIFT, jd) : 0);
}

export function lowPhaseValue(jd) {
  return wrap(moonNativeLongitude(jd, 10) - lowSolarValue(jd, false)
    - 3.4e-6 + drift(LOW_ELONGATION_DRIFT, jd));
}

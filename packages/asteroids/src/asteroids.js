import { asteroidOrbitalRadius, asteroidTrueAnomaly } from './asteroid-kepler.js';
import {
  CENTAUR_ASTEROID_COUNTS,
  CENTAUR_ASTEROID_DATA_BASE64,
} from './asteroid-centaur-data.js';
import { STABLE_ASTEROID_DATA_BASE64 } from './asteroid-stable-data.js';
import { icrfEquatorialToJ2000Ecliptic } from 'js-ephemeris-lite/coordinates';
import { earthHeliocentricPosition } from 'js-ephemeris-lite/sun-moon';

const J2000 = 2451545;
const JULIAN_YEAR_DAYS = 365.25;
const START_YEAR = -3000;
const END_YEAR = 3000;
const SEGMENT_YEARS = 600;
const SEGMENTS_PER_BODY = 10;
const STABLE_BLEND_YEARS = 5;
const FREQUENCY_COUNT = 64;
const ELEMENT_COUNT = 6;
const SECULAR_COUNT = 6;
const AMPLITUDE_DEGREE = 2;
const COEFFICIENT_ROWS = 390;
const SEGMENT_BYTES = 16 + FREQUENCY_COUNT * 4 + COEFFICIENT_ROWS * ELEMENT_COUNT * 4;
const CENTAUR_START_JD = 625295;
const CENTAUR_TICK_DAYS = 0.125 * JULIAN_YEAR_DAYS;
const CENTAUR_TICK_COUNT = 48000;
const CENTAUR_RECORD_BYTES = 98;
const CENTAUR_BLEND_FRACTION = 0.2;

export const ASTEROID = Object.freeze({
  CERES: 'ceres',
  PALLAS: 'pallas',
  JUNO: 'juno',
  VESTA: 'vesta',
  EROS: 'eros',
  LILITH_1181: 'lilith_1181',
  CHIRON: 'chiron',
  PHOLUS: 'pholus',
  NESSUS: 'nessus',
});

const STABLE_BODIES = Object.freeze([
  ASTEROID.CERES, ASTEROID.PALLAS, ASTEROID.JUNO,
  ASTEROID.VESTA, ASTEROID.EROS, ASTEROID.LILITH_1181,
]);
const CENTAUR_BODIES = Object.freeze([ASTEROID.CHIRON, ASTEROID.PHOLUS, ASTEROID.NESSUS]);
const STABLE_BODY_INDEX = new Map(STABLE_BODIES.map((body, index) => [body, index]));
const CENTAUR_BODY_INDEX = new Map(CENTAUR_BODIES.map((body, index) => [body, index]));

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new DataView(bytes.buffer);
}

let stableData;
let centaurData;

function dataView() {
  stableData ??= decodeBase64(STABLE_ASTEROID_DATA_BASE64);
  return stableData;
}

function centaurDataView() {
  centaurData ??= decodeBase64(CENTAUR_ASTEROID_DATA_BASE64);
  return centaurData;
}

function checkedBody(body) {
  const stableIndex = STABLE_BODY_INDEX.get(body);
  if (stableIndex !== undefined) return { kind: 'stable', index: stableIndex };
  const centaurIndex = CENTAUR_BODY_INDEX.get(body);
  if (centaurIndex !== undefined) return { kind: 'centaur', index: centaurIndex };
  throw new RangeError(`unknown lightweight asteroid: ${body}`);
}

function checkedJulianDay(jdTT) {
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  const year = 2000 + (jdTT - J2000) / JULIAN_YEAR_DAYS;
  if (year < START_YEAR || year > END_YEAR) {
    throw new RangeError(`asteroid model supports years ${START_YEAR} through ${END_YEAR}`);
  }
  return year;
}

function coefficient(view, base, row, element) {
  const offset = base + 16 + FREQUENCY_COUNT * 4 + (row * ELEMENT_COUNT + element) * 4;
  return view.getFloat32(offset, true);
}

function evaluateSegmentElements(bodyIndex, segmentIndex, jdTT) {
  const base = (bodyIndex * SEGMENTS_PER_BODY + segmentIndex) * SEGMENT_BYTES;
  const view = dataView();
  const epoch = view.getFloat64(base, true);
  const halfSpan = view.getFloat64(base + 8, true);
  const normalized = (jdTT - epoch) / halfSpan;
  const years = (jdTT - epoch) / JULIAN_YEAR_DAYS;
  const elements = [0, 0, 0, 0, 0, 0];

  let power = 1;
  for (let row = 0; row < SECULAR_COUNT; row++) {
    for (let element = 0; element < ELEMENT_COUNT; element++) {
      elements[element] += power * coefficient(view, base, row, element);
    }
    power *= normalized;
  }

  let envelope = 1;
  for (let degree = 0; degree <= AMPLITUDE_DEGREE; degree++) {
    const cosineRow = SECULAR_COUNT + degree * 2 * FREQUENCY_COUNT;
    const sineRow = cosineRow + FREQUENCY_COUNT;
    for (let frequencyIndex = 0; frequencyIndex < FREQUENCY_COUNT; frequencyIndex++) {
      const frequency = view.getFloat32(base + 16 + frequencyIndex * 4, true);
      const phase = 2 * Math.PI * years * frequency;
      const cosine = Math.cos(phase), sine = Math.sin(phase);
      for (let element = 0; element < ELEMENT_COUNT; element++) {
        elements[element] += envelope * (
          coefficient(view, base, cosineRow + frequencyIndex, element) * cosine
          + coefficient(view, base, sineRow + frequencyIndex, element) * sine
        );
      }
    }
    envelope *= normalized;
  }
  return elements;
}

function smootherstep(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function correctedBoundaryPosition(raw, ownAtBoundary, otherAtBoundary, distance, width) {
  const weight = 1 - smootherstep(distance / width);
  return raw.map((coordinate, index) => coordinate
    + weight * (otherAtBoundary[index] - ownAtBoundary[index]) / 2);
}

function stableIcrfPosition(bodyIndex, jdTT, year) {
  const segmentIndex = Math.min(SEGMENTS_PER_BODY - 1, Math.max(
    0, Math.floor((year - START_YEAR) / SEGMENT_YEARS),
  ));
  const raw = elementsToPosition(evaluateSegmentElements(bodyIndex, segmentIndex, jdTT));
  const segmentStartYear = START_YEAR + segmentIndex * SEGMENT_YEARS;
  const distanceFromStart = year - segmentStartYear;
  if (segmentIndex > 0 && distanceFromStart < STABLE_BLEND_YEARS) {
    const boundaryJd = J2000 + (segmentStartYear - 2000) * JULIAN_YEAR_DAYS;
    const own = elementsToPosition(evaluateSegmentElements(bodyIndex, segmentIndex, boundaryJd));
    const other = elementsToPosition(evaluateSegmentElements(bodyIndex, segmentIndex - 1, boundaryJd));
    return correctedBoundaryPosition(raw, own, other, distanceFromStart, STABLE_BLEND_YEARS);
  }
  const distanceFromEnd = segmentStartYear + SEGMENT_YEARS - year;
  if (segmentIndex + 1 < SEGMENTS_PER_BODY && distanceFromEnd < STABLE_BLEND_YEARS) {
    const boundaryJd = J2000
      + (segmentStartYear + SEGMENT_YEARS - 2000) * JULIAN_YEAR_DAYS;
    const own = elementsToPosition(evaluateSegmentElements(bodyIndex, segmentIndex, boundaryJd));
    const other = elementsToPosition(evaluateSegmentElements(bodyIndex, segmentIndex + 1, boundaryJd));
    return correctedBoundaryPosition(raw, own, other, distanceFromEnd, STABLE_BLEND_YEARS);
  }
  return raw;
}

function elementsToPosition(elements) {
  const [semiMajorAxis, eccentricity, inclination, ascendingNode, periapsis, meanAnomaly] = elements;
  const trueAnomaly = asteroidTrueAnomaly(meanAnomaly, eccentricity);
  const radius = asteroidOrbitalRadius(semiMajorAxis, eccentricity, trueAnomaly);
  const xOrbit = radius * Math.cos(trueAnomaly), yOrbit = radius * Math.sin(trueAnomaly);
  const cosineNode = Math.cos(ascendingNode), sineNode = Math.sin(ascendingNode);
  const cosineInclination = Math.cos(inclination), sineInclination = Math.sin(inclination);
  const cosinePeriapsis = Math.cos(periapsis), sinePeriapsis = Math.sin(periapsis);
  return [
    (cosineNode * cosinePeriapsis - sineNode * sinePeriapsis * cosineInclination) * xOrbit
      + (-cosineNode * sinePeriapsis - sineNode * cosinePeriapsis * cosineInclination) * yOrbit,
    (sineNode * cosinePeriapsis + cosineNode * sinePeriapsis * cosineInclination) * xOrbit
      + (-sineNode * sinePeriapsis + cosineNode * cosinePeriapsis * cosineInclination) * yOrbit,
    sinePeriapsis * sineInclination * xOrbit + cosinePeriapsis * sineInclination * yOrbit,
  ];
}

function centaurBodyRecordOffset(bodyIndex) {
  let records = 0;
  for (let index = 0; index < bodyIndex; index++) records += CENTAUR_ASTEROID_COUNTS[index];
  return records;
}

function centaurRecord(view, bodyIndex, index) {
  const count = CENTAUR_ASTEROID_COUNTS[bodyIndex];
  const bodyRecordOffset = centaurBodyRecordOffset(bodyIndex);
  const offset = (bodyRecordOffset + index) * CENTAUR_RECORD_BYTES;
  const startTick = view.getUint16(offset, true);
  const endTick = index + 1 < count
    ? view.getUint16(offset + CENTAUR_RECORD_BYTES, true)
    : CENTAUR_TICK_COUNT;
  return { index, offset, startTick, endTick };
}

function findCentaurRecord(view, bodyIndex, jdTT) {
  const count = CENTAUR_ASTEROID_COUNTS[bodyIndex];
  const bodyOffset = centaurBodyRecordOffset(bodyIndex) * CENTAUR_RECORD_BYTES;
  const targetTick = (jdTT - CENTAUR_START_JD) / CENTAUR_TICK_DAYS;
  let low = 0, high = count;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    const tick = view.getUint16(bodyOffset + middle * CENTAUR_RECORD_BYTES, true);
    if (tick <= targetTick) low = middle;
    else high = middle;
  }
  return centaurRecord(view, bodyIndex, low);
}

function centaurChebyshev(view, offset, x) {
  let b1 = 0, b2 = 0;
  for (let degree = 7; degree >= 1; degree--) {
    const coefficient = view.getFloat32(offset + degree * 4, true);
    const b0 = 2 * x * b1 - b2 + coefficient;
    b2 = b1;
    b1 = b0;
  }
  return x * b1 - b2 + view.getFloat32(offset, true);
}

function evaluateCentaurRecord(view, record, jdTT) {
  const { offset, startTick, endTick } = record;
  const start = CENTAUR_START_JD + startTick * CENTAUR_TICK_DAYS;
  const end = CENTAUR_START_JD + endTick * CENTAUR_TICK_DAYS;
  const x = (2 * jdTT - start - end) / (end - start);
  return [
    centaurChebyshev(view, offset + 2, x),
    centaurChebyshev(view, offset + 34, x),
    centaurChebyshev(view, offset + 66, x),
  ];
}

function correctCentaurBoundary(view, bodyIndex, record, raw, adjacentIndex, boundaryTick, distance) {
  const adjacent = centaurRecord(view, bodyIndex, adjacentIndex);
  const boundaryJd = CENTAUR_START_JD + boundaryTick * CENTAUR_TICK_DAYS;
  const own = evaluateCentaurRecord(view, record, boundaryJd);
  const other = evaluateCentaurRecord(view, adjacent, boundaryJd);
  const adjacentSpan = adjacent.endTick - adjacent.startTick;
  const ownSpan = record.endTick - record.startTick;
  const width = Math.min(ownSpan, adjacentSpan) * CENTAUR_TICK_DAYS * CENTAUR_BLEND_FRACTION;
  return correctedBoundaryPosition(raw, own, other, distance, width);
}

function centaurIcrfPosition(bodyIndex, jdTT) {
  const view = centaurDataView();
  const record = findCentaurRecord(view, bodyIndex, jdTT);
  const raw = evaluateCentaurRecord(view, record, jdTT);
  const count = CENTAUR_ASTEROID_COUNTS[bodyIndex];
  const start = CENTAUR_START_JD + record.startTick * CENTAUR_TICK_DAYS;
  const end = CENTAUR_START_JD + record.endTick * CENTAUR_TICK_DAYS;
  if (record.index > 0) {
    const adjacent = centaurRecord(view, bodyIndex, record.index - 1);
    const width = Math.min(
      record.endTick - record.startTick, adjacent.endTick - adjacent.startTick,
    ) * CENTAUR_TICK_DAYS * CENTAUR_BLEND_FRACTION;
    if (jdTT - start < width) {
      return correctCentaurBoundary(
        view, bodyIndex, record, raw, record.index - 1, record.startTick, jdTT - start,
      );
    }
  }
  if (record.index + 1 < count) {
    const adjacent = centaurRecord(view, bodyIndex, record.index + 1);
    const width = Math.min(
      record.endTick - record.startTick, adjacent.endTick - adjacent.startTick,
    ) * CENTAUR_TICK_DAYS * CENTAUR_BLEND_FRACTION;
    if (end - jdTT < width) {
      return correctCentaurBoundary(
        view, bodyIndex, record, raw, record.index + 1, record.endTick, end - jdTT,
      );
    }
  }
  return raw;
}

function asteroidIcrfPosition(body, jdTT) {
  const descriptor = checkedBody(body);
  const year = checkedJulianDay(jdTT);
  return descriptor.kind === 'stable'
    ? stableIcrfPosition(descriptor.index, jdTT, year)
    : centaurIcrfPosition(descriptor.index, jdTT);
}

/** Geometric heliocentric position in the library's fixed mean-J2000 ecliptic axes, in AU. */
export function asteroidHeliocentricPosition(body, jdTT) {
  return icrfEquatorialToJ2000Ecliptic(asteroidIcrfPosition(body, jdTT));
}

/** Geometric geocentric position in fixed mean-J2000 ecliptic axes, in AU. */
export function asteroidGeocentricPosition(body, jdTT, accuracy = 'accurate') {
  const asteroid = asteroidHeliocentricPosition(body, jdTT);
  const earth = earthHeliocentricPosition(jdTT, accuracy);
  return asteroid.map((coordinate, index) => coordinate - earth[index]);
}

export const ASTEROID_MODEL_INFO = Object.freeze({
  bodies: Object.freeze(Object.values(ASTEROID)),
  intervalYears: Object.freeze([START_YEAR, END_YEAR]),
  frame: 'J2000 mean/dynamical ecliptic and equinox',
  center: 'Sun',
  unit: 'AU',
  model: 'segmented Poisson elements and adaptive Cartesian Chebyshev fits',
  continuity: 'quintic boundary correction',
  positionErrorBudgetKm: Object.freeze({
    ceres: 100000,
    pallas: 450000,
    juno: 600000,
    vesta: 75000,
    eros: 200000,
    lilith_1181: 100000,
    chiron: 10000,
    pholus: 10000,
    nessus: 10000,
  }),
});

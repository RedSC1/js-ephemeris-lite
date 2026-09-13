import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ASTEROID,
  ASTEROID_MODEL_INFO,
  asteroidGeocentricPosition,
  asteroidHeliocentricPosition,
} from '../src/asteroids.js';
import { icrfEquatorialToJ2000Ecliptic } from 'js-ephemeris-lite/coordinates';
import { earthHeliocentricPosition } from 'js-ephemeris-lite/sun-moon';
import {
  CENTAUR_ASTEROID_COUNTS,
  CENTAUR_ASTEROID_DATA_BASE64,
} from '../src/asteroid-centaur-data.js';

const AU_KM = 149597870.7;
const REFERENCE = JSON.parse(readFileSync(
  new URL('./fixtures/asteroid-reference.json', import.meta.url), 'utf8',
));

test('asteroid positions remain inside conservative cross-epoch error budgets', () => {
  assert.deepEqual(ASTEROID_MODEL_INFO.bodies, Object.values(ASTEROID));
  for (const [body, rows] of Object.entries(REFERENCE.bodies)) {
    for (const [jdTT, ...icrf] of rows) {
      const expected = icrfEquatorialToJ2000Ecliptic(icrf);
      const actual = asteroidHeliocentricPosition(body, jdTT);
      const errorKm = Math.hypot(
        ...actual.map((coordinate, index) => coordinate - expected[index]),
      ) * AU_KM;
      assert.ok(
        errorKm < ASTEROID_MODEL_INFO.positionErrorBudgetKm[body],
        `${body} at ${jdTT}: ${errorKm} km`,
      );
    }
  }
});

test('piecewise asteroid models do not jump at segment boundaries', () => {
  const epsilonDays = 1e-6;
  const distanceKm = (left, right) => Math.hypot(
    ...left.map((coordinate, index) => coordinate - right[index]),
  ) * AU_KM;
  const stableBodies = [
    ASTEROID.CERES, ASTEROID.PALLAS, ASTEROID.JUNO,
    ASTEROID.VESTA, ASTEROID.EROS, ASTEROID.LILITH_1181,
  ];
  for (const body of stableBodies) {
    for (let year = -2400; year <= 2400; year += 600) {
      const jdTT = 2451545 + (year - 2000) * 365.25;
      const movement = distanceKm(
        asteroidHeliocentricPosition(body, jdTT - epsilonDays),
        asteroidHeliocentricPosition(body, jdTT + epsilonDays),
      );
      assert.ok(movement < 8, `${body} boundary ${year}: ${movement} km`);
    }
  }

  const binary = atob(CENTAUR_ASTEROID_DATA_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  const view = new DataView(bytes.buffer);
  const bodies = [ASTEROID.CHIRON, ASTEROID.PHOLUS, ASTEROID.NESSUS];
  const recordBytes = 98;
  let bodyRecordOffset = 0;
  for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex++) {
    const count = CENTAUR_ASTEROID_COUNTS[bodyIndex];
    for (let record = 1; record < count; record++) {
      const tick = view.getUint16((bodyRecordOffset + record) * recordBytes, true);
      const jdTT = 625295 + tick * 0.125 * 365.25;
      const movement = distanceKm(
        asteroidHeliocentricPosition(bodies[bodyIndex], jdTT - epsilonDays),
        asteroidHeliocentricPosition(bodies[bodyIndex], jdTT + epsilonDays),
      );
      assert.ok(movement < 8, `${bodies[bodyIndex]} boundary ${jdTT}: ${movement} km`);
    }
    bodyRecordOffset += count;
  }
});

test('geocentric asteroid positions subtract the selected Earth model', () => {
  for (const body of Object.values(ASTEROID)) {
    const heliocentric = asteroidHeliocentricPosition(body, 2451545);
    const earth = earthHeliocentricPosition(2451545, 'fast');
    const geocentric = asteroidGeocentricPosition(body, 2451545, 'fast');
    geocentric.forEach((coordinate, index) => {
      assert.ok(Math.abs(coordinate - (heliocentric[index] - earth[index])) < 1e-14);
    });
  }
});

test('asteroid API validates names and supported dates', () => {
  for (const body of Object.values(ASTEROID)) {
    for (const jdTT of [625295, 2816795]) {
      assert.ok(asteroidHeliocentricPosition(body, jdTT).every(Number.isFinite), `${body} at ${jdTT}`);
    }
  }
  assert.throws(() => asteroidHeliocentricPosition('pluto', 2451545), RangeError);
  assert.throws(() => asteroidHeliocentricPosition(ASTEROID.CERES, Number.NaN), TypeError);
  assert.throws(() => asteroidHeliocentricPosition(ASTEROID.CERES, 625294.9), RangeError);
  assert.throws(() => asteroidHeliocentricPosition(ASTEROID.CERES, 2816795.1), RangeError);
});

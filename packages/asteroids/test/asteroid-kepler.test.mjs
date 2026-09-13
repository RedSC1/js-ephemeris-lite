import test from 'node:test';
import assert from 'node:assert/strict';
import {
  asteroidOrbitalRadius,
  asteroidTrueAnomaly,
} from '../src/asteroid-kepler.js';

const ARCSEC_PER_RADIAN = 206264.80624709636;

function exactTrueAnomaly(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 12; iteration++) {
    eccentricAnomaly -= (
      eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly
    ) / (1 - eccentricity * Math.cos(eccentricAnomaly));
  }
  return 2 * Math.atan2(
    Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
    Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2),
  );
}

test('shared asteroid expansion stays below one arcsecond', () => {
  let worstArcsec = 0;
  for (let eccentricityIndex = 0; eccentricityIndex <= 84; eccentricityIndex++) {
    const eccentricity = 0.42 * eccentricityIndex / 84;
    for (let anomalyIndex = 0; anomalyIndex <= 2048; anomalyIndex++) {
      const meanAnomaly = -Math.PI + 2 * Math.PI * anomalyIndex / 2048;
      const approximate = asteroidTrueAnomaly(meanAnomaly, eccentricity);
      const exact = exactTrueAnomaly(meanAnomaly, eccentricity);
      const difference = Math.atan2(Math.sin(approximate - exact), Math.cos(approximate - exact));
      worstArcsec = Math.max(worstArcsec, Math.abs(difference) * ARCSEC_PER_RADIAN);
    }
  }
  assert.ok(worstArcsec < 1, `worst error: ${worstArcsec} arcsec`);
});

test('asteroid orbital radius is exact at apsides', () => {
  assert.equal(asteroidOrbitalRadius(2, 0.25, 0), 1.5);
  assert.equal(asteroidOrbitalRadius(2, 0.25, Math.PI), 2.5);
});

test('shared asteroid expansion rejects eccentricities outside its domain', () => {
  assert.throws(() => asteroidTrueAnomaly(0, 0.42001), RangeError);
});

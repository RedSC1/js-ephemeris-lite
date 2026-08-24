import test from 'node:test';
import assert from 'node:assert/strict';
import {
  J2000,
  AU_KM,
  EARTH_MOON_MASS_RATIO,
  MOON_MODEL_INFO,
  correctionWeight,
  earthPosition,
  moonDirectionState,
  moonElpLongitudeState,
  moonPosition,
  embPosition,
  iau2000bNutation,
  vondrak2011PrecessionMatrix,
} from '../src/ephemeris.js';

function near(actual, expected, tolerance, message = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} != ${expected} (tol ${tolerance})`);
}

test('modern correction gate is exactly closed and smoothly opens', () => {
  assert.equal(correctionWeight(J2000), 0);
  assert.equal(correctionWeight(J2000 + 200 * 365.25), 0);
  assert.equal(correctionWeight(J2000 - 200 * 365.25), 0);
  near(correctionWeight(J2000 + 600 * 365.25), 0.5, 1e-15);
  assert.equal(correctionWeight(J2000 + 1000 * 365.25), 1);
});

test('J2000 truncated Earth and Moon regression values', () => {
  const earth = earthPosition(J2000);
  const moon = moonPosition(J2000);
  const expectedEarth = [-0.17713539623857041, 0.9672416027622578, -0.000003945988425422161];
  const expectedMoon = [-291608.5374584195, -274979.66456961766, 36271.36061049973];
  earth.forEach((value, index) => near(value, expectedEarth[index], 2e-15, `earth[${index}]`));
  moon.forEach((value, index) => near(value, expectedMoon[index], 2e-9, `moon[${index}]`));
  assert.deepEqual(moonPosition(J2000, { corrections: false }), moon);
});

test('event direction skips radius while matching the complete Moon state', () => {
  assert.deepEqual(MOON_MODEL_INFO, {
    longitudeTerms: 627,
    latitudeTerms: 277,
    radiusTerms: 327,
    eventDirectionSkipsRadius: true,
    directionLatitudeTerms: [0, 5, 10, 20, 'full'],
  });
  for (const jd of [J2000, 2415020.5, 3182029.5, 3912514.5]) {
    const position = moonPosition(jd);
    const radius = Math.hypot(...position);
    const direction = moonDirectionState(jd).position;
    direction.forEach((value, index) => near(value, position[index] / radius, 4e-15));
    near(Math.hypot(...direction), 1, 4e-15);
  }
});

test('raw ELP longitude remains separately accessible with analytic rate', () => {
  for (const jd of [J2000, 2415020.5, 3182029.5]) {
    const h = 1e-3;
    const state = moonElpLongitudeState(jd);
    const numerical = Math.atan2(
      Math.sin(moonElpLongitudeState(jd + h).value - moonElpLongitudeState(jd - h).value),
      Math.cos(moonElpLongitudeState(jd + h).value - moonElpLongitudeState(jd - h).value),
    ) / (2 * h);
    near(state.rate, numerical, 2e-7);
  }
});

test('EMB is Earth plus the lunar mass-weighted displacement', () => {
  for (const jd of [J2000, 2415020.5, 3182029.5]) {
    const earth = earthPosition(jd);
    const moon = moonPosition(jd);
    const emb = embPosition(jd);
    const scale = 1 / ((1 + EARTH_MOON_MASS_RATIO) * AU_KM);
    emb.forEach((value, index) => near(value, earth[index] + moon[index] * scale, 2e-15));
  }
});

test('IAU 2000B matches C++/SOFA regression oracles', () => {
  const oracles = [
    [2451545.0, -0.000067542612539922361, -0.000027970923310985653, 0.40909260060058289],
    [2460000.0, -0.000044811878657808338, 0.000037607177053908570, 0.40904003706375935],
    [2415020.5, 0.000084518702696893369, -0.000011103153586824906, 0.40931965795344111],
  ];
  for (const [jd, dpsi, deps, obliquity] of oracles) {
    const actual = iau2000bNutation(jd);
    near(actual.dpsi, dpsi, 1e-16);
    near(actual.deps, deps, 1e-16);
    near(actual.meanObliquity, obliquity, 1e-16);
  }
});

test('Vondrak 2011 matches C++/SOFA long-term precession oracles', () => {
  const oracles = [
    [2451545.0, [[1, -7.0782797432736689e-8, 8.0561489398790301e-8], [7.0782797433127277e-8, 1, 3.3055566297944602e-8], [-8.0561489398447120e-8, -3.3055566297944596e-8, 1]]],
    [2460000.0, [[0.99998407267080236, -0.0051765046329333838, -0.0022490452445638656], [0.0051765047729521365, 0.99998660179283250, -0.0000057588872958970894], [0.0022490449222988557, -0.0000058833978765631683, 0.99999747087796709]]],
    [1219339.078, [[0.68473393269150270, 0.66647787827593630, 0.29486722298289560], [-0.66669476097832980, 0.73625641556112600, -0.11595079227472853], [-0.29437652267952263, -0.11719099075396050, 0.94847706065103420]]],
  ];
  for (const [jd, expected] of oracles) {
    const actual = vondrak2011PrecessionMatrix(jd);
    actual.forEach((row, i) => row.forEach((value, j) => near(value, expected[i][j], 2e-14)));
  }
});

test('models remain finite over the intended wide interval', () => {
  for (const year of [-6000, -4712, 0, 2000, 9999, 10000]) {
    const jd = J2000 + (year - 2000) * 365.25;
    for (const vector of [earthPosition(jd), moonPosition(jd), embPosition(jd)]) {
      assert.equal(vector.length, 3);
      assert.ok(vector.every(Number.isFinite), `${year}: ${vector}`);
    }
  }
});

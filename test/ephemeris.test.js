import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { planetModels } from '../src/planet-models.js';
import * as series from '../src/planet-series.js';
import { EARTH_L_PREFIX_COUNTS, EARTH_B_PREFIX_COUNTS, EARTH_R_PREFIX_COUNTS } from '../src/earth-prefix-counts.js';
import * as planetPrefixes from '../src/planet-prefix-counts.js';
import { MOON_PREFIX_COUNTS } from '../src/moon-prefix-counts.js';
import { MOON_L, MOON_B, MOON_R } from '../src/moon-series.js';
import { ACCURACY } from '../src/accuracy.js';
const topModels = Object.fromEntries(['jupiter', 'saturn', 'uranus', 'neptune'].map(body => [body, planetModels[body]]));
import { meanObliquityIau2006, ARCSEC_TO_RAD } from '../src/coordinates.js';
import { planetTheoryToJ2000 } from '../src/planet-frame.js';
import {
  J2000,
  AU_KM,
  EARTH_MOON_MASS_RATIO,
  PLANET,
  PLUTO_MODEL_INFO,
  plutoHeliocentricState,
  plutoHeliocentricPosition,
  earthDirectionState,
  earthHeliocentricPosition,
  earthHeliocentricState,
  earthPosition,
  moonGeocentricPosition,
  moonGeocentricState,
  moonHeliocentricPosition,
  moonHeliocentricState,
  moonDirectionState,
  moonElpLongitudeState,
  moonPosition,
  planetGeocentricState,
  planetHeliocentricPosition,
  planetHeliocentricState,
  sunGeocentricPosition,
  sunGeocentricState,
  embHeliocentricPosition,
  embHeliocentricState,
  embPosition,
  iau2000bNutation,
  vondrak2011PrecessionMatrix,
} from '../src/ephemeris.js';

function near(actual, expected, tolerance, message = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} != ${expected} (tol ${tolerance})`);
}

test('public entry point imports and evaluates without Node globals', () => {
  const entry = new URL('../src/index.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    globalThis.process = undefined;
    globalThis.Buffer = undefined;
    const api = await import(${JSON.stringify(entry)});
    if (!api.moonPosition(api.J2000).every(Number.isFinite)) throw new Error('invalid Moon');
    if (!api.earthPosition(api.J2000).every(Number.isFinite)) throw new Error('invalid Earth');
    for (const name of ['correctionWeight', 'moonCorrectionState', 'earthLongitudeCorrectionState', 'planetCorrectionState',
      'solveSolarLongitudeWithDiagnostics', 'solveLunarPhaseWithDiagnostics', 'solveNewMoonWithDiagnostics']) {
      if (name in api) throw new Error('removed API remains: ' + name);
    }
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || String(result.error ?? ''));
});


test('global Moon matches independent Python states and frozen DE441 samples', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/moon-model.json', import.meta.url)));
  for (const sample of fixture.samples) {
    const state = moonGeocentricState(sample.jd);
    state.position.forEach((v, i) => near(v, sample.expected[i], 0.0002, `Moon position ${sample.year}`));
    state.velocity.forEach((v, i) => near(v, sample.expected[i + 3], 0.00005, `Moon velocity ${sample.year}`));
    const error = Math.hypot(...state.position.map((v, i) => v - sample.de441[i]));
    assert.ok(error < (sample.year >= 1600 && sample.year <= 2200 ? 2 : 30), `Moon DE441 ${sample.year}: ${error} km`);
    const h = 0.002, before = moonPosition(sample.jd - h), after = moonPosition(sample.jd + h);
    state.velocity.forEach((v, i) => near(v, (after[i] - before[i]) / (2 * h), 0.05, `Moon derivative ${sample.year}`));
  }
});

test('bare planetary series retain every folded term', () => {
  const expected = {
    mercury: [299, 160, 242], venus: [156, 82, 153], earth: [386, 50, 475],
    mars: [489, 101, 528], jupiter: [586, 232, 723], saturn: [849, 320, 1241],
    uranus: [413, 138, 653], neptune: [153, 101, 167], pluto_fallback: [448, 448, 448],
  };
  for (const [body, counts] of Object.entries(expected)) {
    const actual = ['L', 'B', 'R'].map(axis => series[`${body.toUpperCase()}_${axis}`].reduce((sum, group) => {
      assert.equal(group.length % 3, 0);
      assert.ok(group.every(Number.isFinite));
      return sum + group.length / 3;
    }, 0));
    assert.deepEqual(actual, counts, body);
  }
});

test('ordinary planet tables use the classic VSOP Julian-millennium variable', () => {
  assert.equal(series.PLANET_PHASE_DAYS, 365250);
  assert.equal(series.PLUTO_FALLBACK_SCALE_DAYS, 2922000);
  const jd = J2000 + 2.375 * series.PLANET_PHASE_DAYS;
  const evaluate = blocks => {
    const T = (jd - J2000) / series.PLANET_PHASE_DAYS;
    let power = 1;
    let value = 0;
    for (const rows of blocks) {
      let sum = 0;
      for (let i = 0; i < rows.length; i += 3)
        sum += rows[i] * Math.cos(rows[i + 1] + rows[i + 2] * T);
      value += power * sum;
      power *= T;
    }
    return value;
  };
  for (const body of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
    const upper = body.toUpperCase();
    const longitude = evaluate(series[`${upper}_L`]);
    const latitude = evaluate(series[`${upper}_B`]);
    const radius = evaluate(series[`${upper}_R`]);
    const cosLatitude = Math.cos(latitude);
    const expected = planetTheoryToJ2000([
      radius * cosLatitude * Math.cos(longitude),
      radius * cosLatitude * Math.sin(longitude),
      radius * Math.sin(latitude),
    ]);
    planetModels[body].state(jd).position.forEach((value, coordinate) =>
      near(value, expected[coordinate], 2e-14, body));
  }
});

test('Earth precision tiers are nested per-power prefixes of complete frequency envelopes', () => {
  const specifications = [
    [series.EARTH_L, EARTH_L_PREFIX_COUNTS],
    [series.EARTH_B, EARTH_B_PREFIX_COUNTS],
    [series.EARTH_R, EARTH_R_PREFIX_COUNTS],
  ];
  for (const [blocks, budgets] of specifications) {
    let previous = new Set();
    for (const [limitText, counts] of Object.entries(budgets).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const limit = Number(limitText), selected = new Set();
      for (let power = 0; power < blocks.length; power++)
        for (let i = 0; i < counts[power] * 3; i += 3) selected.add(blocks[power][i + 2]);
      assert.equal(selected.size, limit);
      for (const frequency of previous) assert.ok(selected.has(frequency));
      for (let power = 0; power < blocks.length; power++)
        for (let i = 0; i < blocks[power].length; i += 3)
          assert.equal(i < counts[power] * 3, selected.has(blocks[power][i + 2]), `power ${power}, frequency ${blocks[power][i + 2]}`);
      previous = selected;
    }
  }
});

test('planet and Moon position tiers are offline-ordered nested prefixes', () => {
  for (const body of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
    const upper = body.toUpperCase();
    const budgets = planetPrefixes[`${upper}_PREFIX_COUNTS`];
    for (let coordinate = 0; coordinate < 3; coordinate++) {
      const blocks = series[`${upper}_${['L', 'B', 'R'][coordinate]}`];
      const fast = budgets[coordinate].fast;
      const mid = budgets[coordinate].mid;
      for (let power = 0; power < blocks.length; power++) {
        assert.ok(fast[power] <= mid[power]);
        assert.ok(mid[power] <= blocks[power].length / 3);
      }
    }
  }
  for (const [coordinate, blocks] of [MOON_L, MOON_B, MOON_R].entries()) {
    const { fast, mid } = MOON_PREFIX_COUNTS[coordinate];
    for (let power = 0; power < blocks.length; power++) {
      assert.ok(fast[power] <= mid[power]);
      assert.ok(mid[power] <= blocks[power].length / 3);
    }
  }
});

test('direct positions share fast, mid and accurate call-local accuracy', () => {
  assert.deepEqual(Object.values(ACCURACY), ['fast', 'mid', 'accurate']);
  const dates = [2451545 - 123456, 2451545, 2451545 + 234567];
  for (const body of Object.values(PLANET)) {
    let fastDelta = 0;
    let midDelta = 0;
    for (const jd of dates) {
      const accurate = planetHeliocentricState(body, jd, 'accurate');
      assert.deepEqual(planetHeliocentricState(body, jd), accurate);
      const fast = planetHeliocentricState(body, jd, 'fast');
      const mid = planetHeliocentricState(body, jd, 'mid');
      fastDelta += Math.hypot(...fast.position.map((value, axis) => value - accurate.position[axis]));
      midDelta += Math.hypot(...mid.position.map((value, axis) => value - accurate.position[axis]));
      assert.ok([...fast.position, ...fast.velocity, ...mid.position, ...mid.velocity].every(Number.isFinite));
    }
    assert.ok(fastDelta >= midDelta, body);
    assert.ok(fastDelta > 0, body);
  }
  for (const jd of dates) {
    const accurate = moonGeocentricState(jd, 'accurate');
    assert.deepEqual(moonGeocentricState(jd), accurate);
    const fast = moonGeocentricState(jd, 'fast');
    const mid = moonGeocentricState(jd, 'mid');
    const error = state => Math.hypot(...state.position.map((value, axis) => value - accurate.position[axis]));
    assert.ok(error(fast) >= error(mid));
  }
  assert.throws(() => earthPosition(J2000, 'turbo'), /accuracy/u);
  assert.throws(() => planetHeliocentricState('mars', J2000, null), /accuracy/u);
  assert.throws(() => moonGeocentricState(J2000, 'low'), /accuracy/u);
});

test('truncated planets stay close to the official VSOP87B J2000 position checks', () => {
  const oracles = {
    mercury: [4.4293481043, -0.0527573411, 0.4664714751, 1e-6],
    venus: [3.1870221910, 0.0569782849, 0.7202129248, 1e-6],
    earth: [1.7519238637, -0.0000039656, 0.9833276823, 1e-6],
    mars: [6.2735389872, -0.0247779824, 1.3912076937, 2e-6],
  };
  for (const [planet, [longitude, latitude, radius, tolerance]] of Object.entries(oracles)) {
    const cosLatitude = Math.cos(latitude);
    const expected = [
      radius * cosLatitude * Math.cos(longitude),
      radius * cosLatitude * Math.sin(longitude),
      radius * Math.sin(latitude),
    ];
    const actual = planetHeliocentricPosition(planet, J2000);
    near(Math.hypot(...actual.map((value, axis) => value - expected[axis])), 0, tolerance, planet);
  }
});

test('shared native frame matches the official 2013 to ICRF to mean-J2000 convention', () => {
  const multiply = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((sum, v, k) => sum + v * b[k][j], 0)));
  // Official TOP2013.f and VSOP2013.f frame constants, not fitted residuals.
  const e2013 = (23 * 3600 + 26 * 60 + 21.41136) * ARCSEC_TO_RAD;
  const phi = -0.05188 * ARCSEC_TO_RAD;
  const ce = Math.cos(e2013), se = Math.sin(e2013), cp = Math.cos(phi), sp = Math.sin(phi);
  const nativeToIcrf = [[cp, -sp * ce, sp * se], [sp, cp * ce, -cp * se], [0, se, ce]];
  const e = meanObliquityIau2006(J2000), c = Math.cos(e), s = Math.sin(e);
  const expected = multiply(multiply([[1, 0, 0], [0, c, s], [0, -s, c]], vondrak2011PrecessionMatrix(J2000)), nativeToIcrf);
  for (let axis = 0; axis < 3; axis++) {
    const unit = [0, 0, 0]; unit[axis] = 1;
    planetTheoryToJ2000(unit).forEach((v, row) => near(v, expected[row][axis], 2e-16));
  }
});

test('direct planetary states match independent Python and DE441 ICRF controls', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/top-model.json', import.meta.url)));
  const pluto = JSON.parse(readFileSync(new URL('./fixtures/pluto-model.json', import.meta.url)));
  fixture.bodies.pluto = pluto.samples.map(s => ({ ...s, corrected: s.expected }));
  const eps = meanObliquityIau2006(J2000), c = Math.cos(eps), s = Math.sin(eps);
  const precession = vondrak2011PrecessionMatrix(J2000);
  const icrfToMean = [[1, 0, 0], [0, c, s], [0, -s, c]].map(row =>
    [0, 1, 2].map(j => row.reduce((sum, value, k) => sum + value * precession[k][j], 0)));
  const toIcrf = v => [0, 1, 2].map(j => v.reduce((sum, value, k) => sum + value * icrfToMean[k][j], 0));
  // Sample bounds for compact tables, not a continuous-interval guarantee.
  const compactBoundsKm = { mercury: 350, venus: 750, mars: 10000, jupiter: 5000, saturn: 21000, uranus: 90000, neptune: 16000, pluto: 5000000 };
  for (const [body, samples] of Object.entries(fixture.bodies)) {
    for (const sample of samples) {
      const state = planetHeliocentricState(body, sample.jd);
      const expected = sample.corrected;
      // Reordered secular terms can differ by a few metres over eight millennia.
      toIcrf(state.position).forEach((v, k) => near(v * AU_KM, expected[k], 0.01, `${body} position ${sample.jd}`));
      toIcrf(state.velocity).forEach((v, k) => near(v * AU_KM / 86.4, expected[k + 3], 1e-7, `${body} velocity ${sample.jd}`));

      if (sample.de441) {
        const p = toIcrf(planetHeliocentricPosition(body, sample.jd));
        const error = Math.hypot(...p.map((v, k) => v * AU_KM - sample.de441[k]));
        const year = 2000 + (sample.jd - J2000) / 365.25;
        const bound = body === 'pluto' && year >= 1600 && year <= 2200 ? 2000 : compactBoundsKm[body];
        assert.ok(error < bound, `${body} DE441 position ${sample.jd}: ${error} km`);
      }
    }
    for (const jd of [NaN, Infinity, -Infinity]) {
      assert.throws(() => planetHeliocentricState(body, jd), TypeError);
    }
  }
});

test('single TOP tables preserve direction evaluation across the entire interval', () => {
  for (const [body, model] of Object.entries(topModels)) {
    for (const year of [-6000, 1500, 1550, 1600, 2000, 2200, 2250, 2300, 10000]) {
      const jd = J2000 + (year - 2000) * 365.25;
      const full = model.state(jd);
      const direction = model.direction(jd);
      const radius = Math.hypot(...full.position);
      const radiusRate = full.position.reduce((sum, v, k) => sum + v * full.velocity[k], 0) / radius;
      direction.position.forEach((v, k) => near(v, full.position[k] / radius, 1e-14));
      direction.velocity.forEach((v, k) => near(v,
        full.velocity[k] / radius - full.position[k] * radiusRate / radius ** 2, 1e-14));
    }
  }
});

for (const body of ['earth', 'mercury']) {
  test(`direct ${body} states preserve the public frame and AU`, () => {
    const fixture = JSON.parse(readFileSync(new URL(`./fixtures/${body}-model.json`, import.meta.url), 'utf8'));
    for (const sample of fixture.samples) {
      const year = 2000 + (sample.jdTT - J2000) / 365.25;
      const span = 1 + Math.abs(year - 2000) / 1000;
      const state = planetHeliocentricState(body, sample.jdTT);
      const expected = sample.corrected;
      for (let axis = 0; axis < 3; axis += 1) {
        // Contiguous range sums regroup the large secular longitude. Allow
        // its floating-point roundoff to grow with distance from J2000.
        near(state.position[axis], expected.position[axis], body === 'earth' ? 4e-12 * span : 3e-13, `${body} position ${sample.jdTT}/${axis}`);
        near(state.velocity[axis], expected.velocity[axis], body === 'earth' ? 8e-14 * span : 1e-14, `${body} velocity ${sample.jdTT}/${axis}`);
      }
    }
    for (const date of [NaN, Infinity, -Infinity]) {
      assert.throws(() => planetHeliocentricState(body, date), TypeError);
    }
  });
}

test('planet velocities are analytic derivatives and geocentric states subtract Earth', () => {
  const h = 0.001;
  for (const planet of Object.values(PLANET)) {
    const state = planetHeliocentricState(planet, J2000);
    const before = planetHeliocentricPosition(planet, J2000 - h);
    const after = planetHeliocentricPosition(planet, J2000 + h);
    for (let axis = 0; axis < 3; axis += 1) {
      near(state.velocity[axis], (after[axis] - before[axis]) / (2 * h), 1e-8, `${planet}[${axis}]`);
    }

    const geocentric = planetGeocentricState(planet, J2000);
    const earth = planetHeliocentricState(PLANET.EARTH, J2000);
    for (let axis = 0; axis < 3; axis += 1) {
      near(geocentric.position[axis], state.position[axis] - earth.position[axis], 0);
      near(geocentric.velocity[axis], state.velocity[axis] - earth.velocity[axis], 0);
    }
  }
  assert.throws(() => planetHeliocentricState('ceres', J2000), /unknown planet/u);
});

test('Pluto remains computable outside its recommended interval and blends analytic velocities', () => {
  assert.deepEqual(PLUTO_MODEL_INFO.recommendedIntervalYears, [1600, 2200]);
  assert.ok(PLUTO_MODEL_INFO.warning.includes('low accuracy'));
  for (const year of [-6000, 0, 1589, 1590, 1595, 1600, 1900, 2200, 2205, 2210, 2211, 10000]) {
    const jd = J2000 + (year - 2000) * 365.25, h = 1 / 32;
    const state = plutoHeliocentricState(jd);
    assert.deepEqual(state, planetHeliocentricState(PLANET.PLUTO, jd));
    assert.deepEqual(plutoHeliocentricPosition(jd), state.position);
    assert.ok([...state.position, ...state.velocity].every(Number.isFinite));
    assert.ok(Math.hypot(...state.position) > 20 && Math.hypot(...state.position) < 60);
    const before = plutoHeliocentricPosition(jd - h), after = plutoHeliocentricPosition(jd + h);
    state.velocity.forEach((v, k) => near(v, (after[k] - before[k]) / (2 * h), 2e-9, `Pluto/${year}/${k}`));
  }
});

test('planet analytic velocities remain continuous at former correction-layer bridges', () => {
  const h = 0.002;
  for (const planet of Object.values(PLANET).filter(value => value !== PLANET.EARTH)) {
    for (const year of [990, 1000, 1200, 2800, 3000, 3010]) {
      const jd = J2000 + (year - 2000) * 365.25;
      const state = planetHeliocentricState(planet, jd);
      const before = planetHeliocentricPosition(planet, jd - h);
      const after = planetHeliocentricPosition(planet, jd + h);
      for (let axis = 0; axis < 3; axis += 1) {
        near(state.velocity[axis], (after[axis] - before[axis]) / (2 * h), 2e-7,
          `${planet}/${year}[${axis}]`);
      }
    }
  }
});

test('TOP2013 single tables preserve analytic velocity at endpoints and former joins', () => {
  const h = 0.002;
  for (const planet of Object.keys(topModels)) {
    for (const year of [-6000, -5975.25, -5975, -5974.75, -4000, 0, 1500, 1550, 1600, 2024.75, 2025, 2025.25, 2200, 2250, 2300, 4000, 9975, 10000]) {
      const jd = J2000 + (year - 2000) * 365.25;
      const state = planetHeliocentricState(planet, jd);
      const before = planetHeliocentricPosition(planet, jd - h);
      const after = planetHeliocentricPosition(planet, jd + h);
      for (let axis = 0; axis < 3; axis += 1) {
        near(state.velocity[axis], (after[axis] - before[axis]) / (2 * h), 2e-7,
          `${planet}/${year}[${axis}]`);
      }
    }
  }
});

test('direct Earth and Mercury tables preserve analytic velocity at former segment joins', () => {
  for (const body of ['earth', 'mercury']) {
    const h = 0.002;
    for (const year of [-2040, -2020, -2000, -1980, -1960, 5960, 5980, 6000, 6020, 6040]) {
      const jd = J2000 + (year - 2000) * 365.25;
      const state = planetHeliocentricState(body, jd);
      const before = planetHeliocentricPosition(body, jd - h);
      const after = planetHeliocentricPosition(body, jd + h);
      state.velocity.forEach((value, axis) => near(value, (after[axis] - before[axis]) / (2 * h), 2e-7));
    }
  }
});

test('event direction skips radius while matching the complete Moon state', () => {
  for (const jd of [J2000, 2415020.5, 3182029.5, 3912514.5]) {
    const position = moonPosition(jd);
    const radius = Math.hypot(...position);
    const direction = moonDirectionState(jd).position;
    direction.forEach((value, index) => near(value, position[index] / radius, 4e-15));
    near(Math.hypot(...direction), 1, 4e-15);
    // Shared argument scratch storage must not leak between dates or budgets.
    moonElpLongitudeState(jd + 17.25);
    moonDirectionState(jd - 13.75, { latitudeTerms: 0 });
    assert.deepEqual(moonPosition(jd), position);
  }
});

test('Earth event direction skips radius while preserving angular state', () => {
  for (const jd of [J2000, 2415020.5, 3182029.5, 3912514.5]) {
    const state = earthHeliocentricState(jd);
    const radius = Math.hypot(...state.position);
    const radialRate = state.position.reduce(
      (sum, value, index) => sum + value * state.velocity[index],
      0,
    ) / radius;
    const direction = earthDirectionState(jd);
    direction.position.forEach((value, index) => near(value, state.position[index] / radius, 4e-15));
    direction.velocity.forEach((value, index) => near(
      value,
      state.velocity[index] / radius - state.position[index] * radialRate / (radius * radius),
      4e-15,
    ));
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

test('explicit center-named APIs preserve vector, velocity and unit relationships', () => {
  for (const jd of [J2000, 2415020.5, 3182029.5]) {
    const earth = earthHeliocentricState(jd);
    const sun = sunGeocentricState(jd);
    const moonGeo = moonGeocentricState(jd);
    const moonHelio = moonHeliocentricState(jd);

    assert.deepEqual(earthHeliocentricPosition(jd), earth.position);
    assert.deepEqual(earth.position, earthPosition(jd));
    assert.deepEqual(moonGeocentricPosition(jd), moonGeo.position);
    assert.deepEqual(moonGeo.position, moonPosition(jd));
    assert.deepEqual(moonHeliocentricPosition(jd), moonHelio.position);
    assert.deepEqual(sunGeocentricPosition(jd), sun.position);
    assert.deepEqual(embHeliocentricPosition(jd), embHeliocentricState(jd).position);
    assert.deepEqual(embHeliocentricPosition(jd), embPosition(jd));

    for (let axis = 0; axis < 3; axis += 1) {
      near(sun.position[axis], -earth.position[axis], 0);
      near(sun.velocity[axis], -earth.velocity[axis], 0);
      near(moonHelio.position[axis], earth.position[axis] + moonGeo.position[axis] / AU_KM, 0);
      near(moonHelio.velocity[axis], earth.velocity[axis] + moonGeo.velocity[axis] / AU_KM, 0);
    }
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
    const vectors = [moonPosition(jd), embPosition(jd), ...Object.values(PLANET).map(planet => (
      planetHeliocentricPosition(planet, jd)
    ))];
    for (const vector of vectors) {
      assert.equal(vector.length, 3);
      assert.ok(vector.every(Number.isFinite), `${year}: ${vector}`);
    }
  }
});

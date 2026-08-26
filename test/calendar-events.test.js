import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NEW_MOON_LATITUDE_TERMS,
  LOW_MODEL_INFO,
  solarLongitudeState,
  elongationState,
  solveLunarPhase,
  solveSolarLongitude,
  solveNewMoon,
} from '../src/calendar-events.js';
import { J2000 } from '../src/ephemeris.js';

function wrap(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function near(actual, expected, tolerance, message = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} != ${expected} (tol ${tolerance})`);
}

test('low event model is independently selected and compact', () => {
  assert.equal(LOW_MODEL_INFO.earthLongitudeTerms.length, 10);
  assert.equal(LOW_MODEL_INFO.moonLongitudeTerms.length, 10);
  assert.equal(LOW_MODEL_INFO.earthRadiusTerms.length, 3);
  assert.equal(LOW_MODEL_INFO.nutationTerms, 10);
});

test('event angular rates agree with centered numerical diagnostics', () => {
  for (const evaluator of [solarLongitudeState, elongationState]) {
    for (const jd of [2451545, 2415020.5, 3182029.5]) {
      const h = 1e-3;
      const analytic = evaluator(jd).rate;
      const diagnostic = wrap(evaluator(jd + h).value - evaluator(jd - h).value) / (2 * h);
      near(analytic, diagnostic, 1e-6);
    }
  }
});

test('J2000-era spring equinox and new moon converge from low estimators', () => {
  const equinox = solveSolarLongitude(0, 2451623);
  const newMoon = solveNewMoon(2451550);
  near(equinox.jdTT, 2451623.8168862653, 2e-8);
  near(newMoon.jdTT, 2451550.260213573, 2e-8);
  assert.ok(equinox.jdUT1 < equinox.jdTT);
  assert.ok(newMoon.jdUT1 < newMoon.jdTT);
  near((equinox.jdTT - equinox.jdUT1) * 86400, equinox.deltaTSeconds, 3e-5);
  near((newMoon.jdTT - newMoon.jdUT1) * 86400, newMoon.deltaTSeconds, 3e-5);
  assert.ok(equinox.iterations <= 3);
  assert.ok(newMoon.iterations <= 3);
  assert.ok(Math.abs(equinox.residualRadians) < 1e-9);
  assert.ok(Math.abs(newMoon.residualRadians) < 1e-9);
});

test('2026 solar terms and new moons track raw DE441 C++ event fixtures', () => {
  const solar = [
    [285, 2461045.850215711], [300, 2461060.57367191],
    [315, 2461075.335614743], [330, 2461090.161859854],
    [345, 2461105.08342922], [0, 2461120.116048963],
    [15, 2461135.278569083], [30, 2461150.569625891],
    [45, 2461165.992972783], [60, 2461181.526313748],
    [75, 2461197.159387425], [90, 2461212.851151956],
    [105, 2461228.582020279], [120, 2461244.301555634],
    [135, 2461259.988816218], [150, 2461275.597194592],
    [165, 2461291.112805841], [180, 2461306.50442536],
    [195, 2461321.771142145], [210, 2461336.902146769],
    [225, 2461351.911962071], [240, 2461366.808677635],
    [255, 2461381.620609406], [270, 2461396.369020347],
  ];
  const solarErrors = solar.map(([degrees, oracle]) => (
    solveSolarLongitude(degrees * Math.PI / 180, oracle).jdTT - oracle
  ) * 86400);
  assert.ok(Math.max(...solarErrors.map(Math.abs)) < 1);
  assert.ok(solarErrors.reduce((sum, value) => sum + Math.abs(value), 0) / solarErrors.length < 0.4);

  const newMoons = [
    2461059.328565991, 2461089.001600085, 2461118.558772093,
    2461147.995109024, 2461177.334860878, 2461206.621751109,
    2461235.906089245, 2461265.234654732, 2461294.644549851,
    2461324.160581602, 2461353.793936349, 2461383.536808932,
  ];
  const lunarErrors = newMoons.map(oracle => (solveNewMoon(oracle).jdTT - oracle) * 86400);
  assert.ok(Math.max(...lunarErrors.map(Math.abs)) < 0.7);
  assert.ok(lunarErrors.reduce((sum, value) => sum + Math.abs(value), 0) / lunarErrors.length < 0.2);
});

test('new-moon latitude budget is an explicit runtime switch', () => {
  const full = solveNewMoon(2451550, { moonLatitudeTerms: 'full' });
  assert.equal(DEFAULT_NEW_MOON_LATITUDE_TERMS, 10);
  assert.equal(solveNewMoon(2451550).moonLatitudeTerms, 10);
  for (const moonLatitudeTerms of [0, 5, 10, 20]) {
    const result = solveNewMoon(2451550, { moonLatitudeTerms });
    assert.equal(result.moonLatitudeTerms, moonLatitudeTerms);
    assert.ok(Number.isFinite(result.jdTT));
    assert.ok(Math.abs(result.jdTT - full.jdTT) < 1e-3);
  }
});

test('safeguarded event roots stay robust across -6000..10000', () => {
  const solarStep = Math.PI / 12;
  for (let year = -6000; year <= 10000; year += 500) {
    const nearJd = J2000 + (year - 2000) * 365.25 + 73.25;
    const target = Math.round(solarLongitudeState(nearJd).value / solarStep) * solarStep;
    const solar = solveSolarLongitude(target, nearJd);
    const moon = solveNewMoon(nearJd);
    assert.ok(Number.isFinite(solar.jdTT));
    assert.ok(Number.isFinite(moon.jdTT));
    assert.ok(solar.iterations <= 6);
    assert.ok(moon.iterations <= 6);
  }
});

test('fast lunar-phase roots track the safeguarded full model across the supported span', () => {
  for (let year = -6000; year <= 10000; year += 250) {
    const nearJd = J2000 + (year - 2000) * 365.25 + 17.25;
    for (const target of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      const fast = solveLunarPhase(target, nearJd, { toleranceSeconds: 0.0001 });
      const reference = solveLunarPhase(target, nearJd, {
        toleranceSeconds: 0.0001,
        solver: 'safeguarded',
      });
      near((fast.jdTT - reference.jdTT) * 86400, 0, 0.001, `${year}, ${target}`);
    }
  }
  assert.throws(() => solveLunarPhase(0, J2000, { solver: 'unknown' }), /solver/);
});

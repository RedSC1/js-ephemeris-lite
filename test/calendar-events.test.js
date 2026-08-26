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
  near(equinox.jdTT, 2451623.81686673, 2e-8);
  near(newMoon.jdTT, 2451550.26019776, 2e-8);
  assert.ok(equinox.jdUT1 < equinox.jdTT);
  assert.ok(newMoon.jdUT1 < newMoon.jdTT);
  near((equinox.jdTT - equinox.jdUT1) * 86400, equinox.deltaTSeconds, 3e-5);
  near((newMoon.jdTT - newMoon.jdUT1) * 86400, newMoon.deltaTSeconds, 3e-5);
  assert.ok(equinox.iterations <= 3);
  assert.ok(newMoon.iterations <= 3);
  assert.ok(Math.abs(equinox.residualRadians) < 1e-9);
  assert.ok(Math.abs(newMoon.residualRadians) < 1e-9);
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

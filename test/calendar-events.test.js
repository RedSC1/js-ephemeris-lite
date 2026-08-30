import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NEW_MOON_LATITUDE_TERMS,
  LOW_MODEL_INFO,
  solarLongitudeState,
  elongationState,
  lowSolarLongitudeState,
  lowElongationState,
  solveLunarPhase,
  solveSolarLongitude,
  solveNewMoon,
  solarLongitudeTimeFast, lunarPhaseTimeFast, solarLongitudeTimeAccurate, lunarPhaseTimeAccurate,
} from '../src/calendar-events.js';
import { J2000 } from '../src/ephemeris.js';
import { apparentBodyPosition, apparentBodyState } from '../src/apparent.js';
import { JulianTime, calendarDateFromJulianDay, ttToUt1 } from '../src/time.js';
import { solarLongitude, elongation, lowSolarValue, lowPhaseValue } from '../src/event-values.js';
import { solarRate2, elongationRate2, elongationRefineRate } from '../src/event-rates.js';

function wrap(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function near(actual, expected, tolerance, message = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} != ${expected} (tol ${tolerance})`);
}

function unwrappedEventAngle(target, jd, lunar = false) {
  const t = (jd - J2000) / 36525;
  const mean = lunar ? 7771.37714500204 * t - 1.08472 : 1.75347 + Math.PI + 628.3319653318 * t;
  return target + 2 * Math.PI * Math.round((mean - target) / (2 * Math.PI));
}

test('event results contain only TT, UT1 and delta T in every accuracy mode', () => {
  for (const accuracy of ['fast', 'mid', 'accurate']) {
    for (const year of [1600, 2026, 6000]) for (const lunar of [false, true]) {
      const jd = J2000 + (year - 2000) * 365.25;
      const result = (lunar ? solveLunarPhase : solveSolarLongitude)(Math.PI / 2, jd, { accuracy });
        assert.deepEqual(Object.keys(result).sort(), ['deltaTSeconds', 'jdTT', 'jdUT1']);
        assert.ok(result instanceof JulianTime);
        assert.equal(result.toZonedTime(480).offsetMinutes, 480);
      assert.ok(Object.values(result).every(Number.isFinite));
      near((result.jdTT - result.jdUT1) * 86400, result.deltaTSeconds, 1e-4);
    }
    assert.deepEqual(solveNewMoon(2461212, { accuracy }), solveLunarPhase(0, 2461212, { accuracy }));
  }
});

test('event accuracy is per call and omitted accuracy remains mid', () => {
  const nearJd = 2461212, target = Math.PI / 2;
  const midSolar = solveSolarLongitude(target, nearJd), midMoon = solveNewMoon(nearJd);
  const solarW = unwrappedEventAngle(target, nearJd), moonW = unwrappedEventAngle(0, nearJd, true);
  const solar = solveSolarLongitude(target, nearJd, { accuracy: 'fast' });
  const moon = solveNewMoon(nearJd, { accuracy: 'fast' });
  assert.equal(solar.jdTT, solarLongitudeTimeFast(solarW));
  assert.equal(moon.jdTT, lunarPhaseTimeFast(moonW));
  near((solar.jdTT - solar.jdUT1) * 86400, solar.deltaTSeconds, 3e-5);
  assert.deepEqual(solveSolarLongitude(target, nearJd, { accuracy: 'mid' }), midSolar);
  assert.deepEqual(solveNewMoon(nearJd, { accuracy: 'mid' }), midMoon);
  const physical = solveSolarLongitude(target, nearJd, { accuracy: 'accurate' });
  assert.equal(physical.jdTT, solarLongitudeTimeAccurate(solarW));
  const accurateMoon = solveNewMoon(nearJd, { accuracy: 'accurate' });
  assert.equal(accurateMoon.jdTT, lunarPhaseTimeAccurate(moonW));
  const safeguarded = solveSolarLongitude(target, nearJd, { accuracy: 'accurate', solver: 'safeguarded' });
  near((safeguarded.jdTT - physical.jdTT) * 86400, 0, 0.02);
  assert.deepEqual(solveSolarLongitude(target, nearJd), midSolar);
  assert.deepEqual(solveNewMoon(nearJd), midMoon);
  assert.throws(() => solveNewMoon(nearJd, { accuracy: 'high' }), /accuracy/);
  assert.throws(() => solveNewMoon(nearJd, { accuracy: null }), /accuracy/);
  assert.throws(() => solveSolarLongitude(target, nearJd, { accuracy: 'fast', toleranceSeconds: 1 }), /no tolerance/);
  assert.throws(() => solveNewMoon(nearJd, { accuracy: 'fast', solver: 'safeguarded' }), /no tolerance/);
  assert.throws(() => solveNewMoon(nearJd, { accuracy: 'fast', moonLatitudeTerms: 'full' }), /moonLatitudeTerms/);
  assert.throws(() => solveNewMoon(nearJd, { accuracy: 'accurate', moonLatitudeTerms: 10 }), /moonLatitudeTerms/);
  assert.throws(() => solveNewMoon(nearJd, { accuracy: 'accurate', toleranceSeconds: 0 }), /toleranceSeconds/);
  for (const accuracy of ['fast', 'accurate']) {
    assert.throws(() => solveNewMoon(NaN, { accuracy }), TypeError);
    assert.throws(() => solveSolarLongitude(Infinity, nearJd, { accuracy }), TypeError);
    assert.throws(() => solveNewMoon(1e9, { accuracy }), RangeError);
  }
});

test('fast and accurate solve routes select the nearer occurrence on both sides of half-cycle boundaries', () => {
  for (const accuracy of ['fast', 'accurate']) for (const lunar of [false, true]) {
    const time = lunar ? (accuracy === 'fast' ? lunarPhaseTimeFast : lunarPhaseTimeAccurate)
      : (accuracy === 'fast' ? solarLongitudeTimeFast : solarLongitudeTimeAccurate);
    const solve = lunar ? solveLunarPhase : solveSolarLongitude;
    const target = Math.PI / 2, W = unwrappedEventAngle(target, 2461212, lunar);
    const left = time(W), right = time(W + 2 * Math.PI), midpoint = (left + right) / 2;
    for (const [nearJd, expected] of [[midpoint - 0.001, left], [midpoint + 0.001, right]]) {
      near((solve(target, nearJd, { accuracy }).jdTT - expected) * 86400, 0, 0.02);
      near((solve(target - 6 * Math.PI, nearJd, { accuracy }).jdTT - expected) * 86400, 0, 0.02);
    }
  }
});

test('accurate route converges at remote dates without cycle-rounding loss', () => {
  const root = solveNewMoon(-450135.9998242189, { accuracy: 'accurate' });
  const sun = apparentBodyState('sun', root.jdTT), moon = apparentBodyState('moon', root.jdTT);
  const residual = wrap((moon.longitudeDeg - sun.longitudeDeg) * Math.PI / 180);
  const rate = (moon.longitudeSpeedDegPerDay - sun.longitudeSpeedDegPerDay) * Math.PI / 180;
  near(residual / rate * 86400, 0, 0.01 + 3 * Number.EPSILON * Math.abs(root.jdTT) * 86400);
});

test('fast and physical event routes share cycle selection, but accurate roots use apparent positions', () => {
  for (const year of [-5990, -2000, 0, 1600, 2000, 2026, 2200, 6000, 9990]) {
    const jd = J2000 + (year - 2000) * 365.25;
    for (const lunar of [false, true]) for (const target of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      const W = unwrappedEventAngle(target, jd, lunar);
      const fast = (lunar ? lunarPhaseTimeFast : solarLongitudeTimeFast)(W);
      const accurate = (lunar ? lunarPhaseTimeAccurate : solarLongitudeTimeAccurate)(W);
      const sun = apparentBodyState('sun', accurate);
      const moon = lunar ? apparentBodyState('moon', accurate) : null;
      const value = (lunar ? moon.longitudeDeg - sun.longitudeDeg : sun.longitudeDeg) * Math.PI / 180;
      const rate = (lunar ? moon.longitudeSpeedDegPerDay - sun.longitudeSpeedDegPerDay : sun.longitudeSpeedDegPerDay) * Math.PI / 180;
      const roundoff = 3 * Number.EPSILON * Math.abs(accurate) * 86400;
      near(wrap(value - target) / rate * 86400, 0, 0.01 + roundoff);
      assert.ok(Math.abs(fast - accurate) * 86400 < 5);
      const next = (lunar ? lunarPhaseTimeFast : solarLongitudeTimeFast)(W + 2 * Math.PI);
      assert.ok(next - accurate > (lunar ? 29 : 360));
      assert.ok(next - accurate < (lunar ? 30 : 370));
    }
  }
  for (const fn of [solarLongitudeTimeFast, lunarPhaseTimeFast, solarLongitudeTimeAccurate, lunarPhaseTimeAccurate]) {
    for (const bad of [NaN, Infinity, -Infinity, '0', undefined]) assert.throws(() => fn(bad), TypeError);
    for (const outside of [-1e9, 1e9]) assert.throws(() => fn(outside), RangeError);
  }
  for (const fn of [solarLongitudeTimeAccurate, lunarPhaseTimeAccurate]) {
    for (const toleranceSeconds of [0, -1, NaN, Infinity, 1e-12])
      assert.throws(() => fn(0, { toleranceSeconds }), RangeError);
  }
});

test('accurate solar and lunar event roots include aberration and iterated light time', () => {
  const solar = solarLongitudeTimeAccurate(27 * 2 * Math.PI + Math.PI / 2, { toleranceSeconds: 0.001 });
  const noAberration = apparentBodyPosition('sun', solar, { aberration: false });
  assert.ok(Math.abs(wrap(noAberration.longitudeDeg * Math.PI / 180 - Math.PI / 2)) > 1e-5);
  const lunar = lunarPhaseTimeAccurate(0, { toleranceSeconds: 0.001 });
  const noLightTimeMoon = apparentBodyPosition('moon', lunar, { lightTime: false });
  const noLightTimeSun = apparentBodyPosition('sun', lunar, { lightTime: false });
  assert.ok(Math.abs(wrap((noLightTimeMoon.longitudeDeg - noLightTimeSun.longitudeDeg) * Math.PI / 180)) > 1e-6);
});

test('value-only event models preserve positions and short slopes stay close to analytic rates', () => {
  for (let i = 0; i <= 128; i++) {
    const jd = J2000 + (-8000 + 16000 * i / 128) * 365.25;
    const solar = solarLongitudeState(jd);
    near(wrap(solarLongitude(jd, true) - solar.value), 0, 2e-13);
    near(wrap(lowSolarValue(jd) - lowSolarLongitudeState(jd).value), 0, 2e-13);
    near(wrap(lowPhaseValue(jd) - lowElongationState(jd).value), 0, 2e-13);
    assert.ok(Math.abs(solarRate2(jd) / solar.rate - 1) < 0.01);
    for (const moonLatitudeTerms of [0, 5, 10, 20, 'full']) {
      const phase = elongationState(jd, { moonLatitudeTerms });
      near(wrap(elongation(jd, moonLatitudeTerms) - phase.value), 0, 2e-13);
      assert.ok(Math.abs(elongationRate2(jd) / phase.rate - 1) < 0.01);
      assert.ok(Math.abs(elongationRefineRate(jd) / phase.rate - 1) < 0.01);
    }
  }
});

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

test('regenerated low estimators differentiate their frame and drift terms', () => {
  for (const evaluator of [lowSolarLongitudeState, lowElongationState]) {
    for (const year of [-6000, -2000, 1000, 1100, 1200, 1499, 1500, 1550, 1600, 1601,
      2000, 2199, 2200, 2250, 2300, 2301, 2800, 2900, 3000, 6000, 10000]) {
      const jd = J2000 + (year - 2000) * 365.25;
      const h = 0.002;
      for (const withDrift of [false, true]) {
        const before = evaluator(jd - h, { withDrift });
        const after = evaluator(jd + h, { withDrift });
        near(evaluator(jd, { withDrift }).rate, wrap(after.value - before.value) / (2 * h), 2e-6);
      }
    }
  }
});

test('J2000-era spring equinox and new moon converge from low estimators', () => {
  const equinox = solveSolarLongitude(0, 2451623);
  // The fixture below checks sub-millisecond residuals; request that precision
  // explicitly rather than relying on over-convergence at the 10 ms default.
  const newMoon = solveNewMoon(2451550, { toleranceSeconds: 0.0001 });
  near(equinox.jdTT, 2451623.816885155, 2e-8);
  // Frozen global lunar model; independent DE441 checks are below.
  near(newMoon.jdTT, 2451550.2602140703, 2e-8);
  assert.ok(equinox.jdUT1 < equinox.jdTT);
  assert.ok(newMoon.jdUT1 < newMoon.jdTT);
  near((equinox.jdTT - equinox.jdUT1) * 86400, equinox.deltaTSeconds, 3e-5);
  near((newMoon.jdTT - newMoon.jdUT1) * 86400, newMoon.deltaTSeconds, 3e-5);
  assert.ok(Math.abs(wrap(solarLongitudeState(equinox.jdTT).value)) < 1e-9);
  assert.ok(Math.abs(elongationState(newMoon.jdTT, { moonLatitudeTerms: 10 }).value) < 1e-9);
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
  const roots = solar.map(([degrees, oracle]) => solveSolarLongitude(degrees * Math.PI / 180, oracle));
  const solarErrors = roots.map((root, i) => (root.jdTT - solar[i][1]) * 86400);
  // Frozen 911-term Earth: measured maximum 0.443 s against these DE441 roots.
  assert.ok(Math.max(...solarErrors.map(Math.abs)) < 0.5);
  assert.ok(solarErrors.reduce((sum, value) => sum + Math.abs(value), 0) / solarErrors.length < 0.2);
  // PMO minute table supplied separately from the raw DE441 TT fixtures.
  // Round the unrounded seconds directly, never round to seconds first.
  const published = '01-05 16:23,01-20 09:45,02-04 04:02,02-18 23:52,03-05 21:59,03-20 22:46,04-05 02:40,04-20 09:39,05-05 19:49,05-21 08:37,06-05 23:48,06-21 16:25,07-07 09:57,07-23 03:13,08-07 19:43,08-23 10:19,09-07 22:41,09-23 08:05,10-08 14:29,10-23 17:38,11-07 17:52,11-22 15:23,12-07 10:53,12-22 04:50'.split(',');
  roots.forEach((root, i) => {
    const t = calendarDateFromJulianDay(root.jdUT1 + 1 / 3);
    const rounded = new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute + (t.second >= 30 ? 1 : 0)));
    assert.equal(rounded.toISOString().slice(0, 16).replace('T', ' '), `2026-${published[i]}`);
  });
  // Guard the 2026 summer-solstice seconds regression: this used to land at
  // 16:24:29.xxx in China Standard Time despite the minute rounding correctly.
  const summerSolstice = roots[11].toZonedTime(480);
  assert.deepEqual([summerSolstice.month, summerSolstice.day, summerSolstice.hour, summerSolstice.minute], [6, 21, 16, 24]);
  assert.ok(summerSolstice.second >= 30 && summerSolstice.second < 31);
  const accurateSolar = solar.map(([degrees, oracle]) => solarLongitudeTimeAccurate(unwrappedEventAngle(degrees * Math.PI / 180, oracle)));
  assert.ok(Math.max(...accurateSolar.map((jd, i) => Math.abs(jd - solar[i][1]) * 86400)) < 0.5);
  accurateSolar.forEach((jd, i) => {
    const t = calendarDateFromJulianDay(ttToUt1(jd) + 1 / 3);
    const rounded = new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute + (t.second >= 30 ? 1 : 0)));
    assert.equal(rounded.toISOString().slice(0, 16).replace('T', ' '), `2026-${published[i]}`);
  });
  // Fast uses complete final longitude series but retains fixed-stage numerical
  // corrections and simplified physics. Protect its seconds budget separately.
  const fastSolar = solar.map(([degrees, oracle]) => solarLongitudeTimeFast(unwrappedEventAngle(degrees * Math.PI / 180, oracle)));
  assert.ok(Math.max(...fastSolar.map((jd, i) => Math.abs(jd - solar[i][1]) * 86400)) < 2);
  fastSolar.forEach((jd, i) => {
    const t = calendarDateFromJulianDay(ttToUt1(jd) + 1 / 3);
    const rounded = new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute + (t.second >= 30 ? 1 : 0)));
    assert.equal(rounded.toISOString().slice(0, 16).replace('T', ' '), `2026-${published[i]}`);
  });

  const newMoons = [
    2461059.328565991, 2461089.001600085, 2461118.558772093,
    2461147.995109024, 2461177.334860878, 2461206.621751109,
    2461235.906089245, 2461265.234654732, 2461294.644549851,
    2461324.160581602, 2461353.793936349, 2461383.536808932,
  ];
  const lunarErrors = newMoons.map(oracle => (solveNewMoon(oracle).jdTT - oracle) * 86400);
  assert.ok(Math.max(...lunarErrors.map(Math.abs)) < 0.7);
  assert.ok(lunarErrors.reduce((sum, value) => sum + Math.abs(value), 0) / lunarErrors.length < 0.2);
  const accurateMoonErrors = newMoons.map(oracle => (lunarPhaseTimeAccurate(unwrappedEventAngle(0, oracle, true)) - oracle) * 86400);
  assert.ok(Math.max(...accurateMoonErrors.map(Math.abs)) < 0.7);
  assert.ok(accurateMoonErrors.reduce((sum, value) => sum + Math.abs(value), 0) / accurateMoonErrors.length < 0.2);
  const fastMoonErrors = newMoons.map(oracle => (lunarPhaseTimeFast(unwrappedEventAngle(0, oracle, true)) - oracle) * 86400);
  assert.ok(Math.max(...fastMoonErrors.map(Math.abs)) < 1);
});

test('new-moon latitude budget is an explicit runtime switch', () => {
  const full = solveNewMoon(2451550, { moonLatitudeTerms: 'full' });
  assert.equal(DEFAULT_NEW_MOON_LATITUDE_TERMS, 10);
  assert.deepEqual(solveNewMoon(2451550), solveNewMoon(2451550, { moonLatitudeTerms: 10 }));
  for (const moonLatitudeTerms of [0, 5, 10, 20]) {
    const result = solveNewMoon(2451550, { moonLatitudeTerms });
    assert.ok(Number.isFinite(result.jdTT));
    assert.ok(Math.abs(result.jdTT - full.jdTT) < 1e-3);
  }
});

test('safeguarded event roots stay robust across -6000..10000', () => {
  const solarStep = Math.PI / 12;
  for (let year = -6000; year <= 10000; year += 500) {
    const nearJd = J2000 + (year - 2000) * 365.25 + 73.25;
    const target = Math.round(solarLongitudeState(nearJd).value / solarStep) * solarStep;
    const solar = solveSolarLongitude(target, nearJd, { solver: 'safeguarded' });
    const moon = solveNewMoon(nearJd);
    assert.ok(Number.isFinite(solar.jdTT));
    assert.ok(Number.isFinite(moon.jdTT));
    const sunState = solarLongitudeState(solar.jdTT);
    const moonState = elongationState(moon.jdTT, { moonLatitudeTerms: 10 });
    near(wrap(sunState.value - target) / sunState.rate * 86400, 0, 0.011);
    near(moonState.value / moonState.rate * 86400, 0, 0.011);
  }
});

test('fast solar roots preserve full-model convergence across dates and wrapped targets', () => {
  for (const year of [-6000, -2000, 0, 1000, 1600, 2000, 2026, 2200, 6000, 10000]) {
    for (let term = 0; term < 24; term += 1) {
      const target = term * Math.PI / 12 + (term % 3 - 1) * 2 * Math.PI;
      const jd = J2000 + (year - 2000) * 365.25 + term * 7.13;
      for (const toleranceSeconds of [0.01, 0.0001]) {
        const fast = solveSolarLongitude(target, jd, { toleranceSeconds });
        // Compare against a tighter reference: a 10 ms reference can itself
        // stop several milliseconds from the root even if auto is more accurate.
        const safeguarded = solveSolarLongitude(target, jd, {
          toleranceSeconds: Math.min(toleranceSeconds, 0.0001), solver: 'safeguarded',
        });
        near((fast.jdTT - safeguarded.jdTT) * 86400, 0, 0.001, `${year}/${term}`);
        const state = solarLongitudeState(fast.jdTT);
        const residual = wrap(state.value - wrap(target));
        const roundoffSeconds = 2 * Number.EPSILON * Math.abs(fast.jdTT) * 86400;
        assert.ok(Math.abs(residual / state.rate) * 86400 <= toleranceSeconds + roundoffSeconds);
      }
    }
  }
  assert.throws(() => solveSolarLongitude(0, J2000, { solver: 'unknown' }), /solver/);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.throws(() => solarLongitudeState(invalid), TypeError);
    assert.throws(() => solveSolarLongitude(invalid, J2000), TypeError);
    assert.throws(() => solveSolarLongitude(0, invalid), TypeError);
  }
});

test('solar fast iteration falls back when tolerance is below JD resolution', () => {
  const options = { toleranceSeconds: 1e-12 };
  const fast = solveSolarLongitude(0.731, 2461210, options);
  const safeguarded = solveSolarLongitude(0.731, 2461210, { ...options, solver: 'safeguarded' });
  assert.deepEqual(fast, safeguarded);
  const state = solarLongitudeState(fast.jdTT);
  const correctionSeconds = Math.abs(wrap(state.value - 0.731) / state.rate) * 86400;
  assert.ok(correctionSeconds > options.toleranceSeconds);
  assert.ok(correctionSeconds < 2 * Number.EPSILON * fast.jdTT * 86400);
});

test('fast lunar-phase roots track the safeguarded full model across the supported span', () => {
  const years = [...Array.from({ length: 65 }, (_, i) => -6000 + i * 250),
    1499, 1500, 1525, 1550, 1575, 1600, 1601, 2199, 2200, 2225, 2250, 2275, 2300, 2301];
  for (const year of years) {
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

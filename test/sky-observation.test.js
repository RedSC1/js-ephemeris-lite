import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bodyPhenomena, moonIllumination } from '../src/phenomena.js';
import { bodyHorizontalPosition, bodyRiseSetForDay } from '../src/body-visibility.js';
import { SKY_BODIES } from '../src/apparent.js';
import { solveNewMoon, solveLunarPhase } from '../src/calendar-events.js';

const nativeRows = JSON.parse(readFileSync(process.env.TAIYIN_SKY_ORACLE_JSON
  ?? new URL('./fixtures/observation-de441.json', import.meta.url))).rows;
const near = (a, b, tolerance, label) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance,
  `${label}: ${a} vs ${b}; tolerance ${tolerance}`);

test('physical illumination, elongation, diameter and parallax match native DE441 geometry', () => {
  const rows = nativeRows.filter(r => r.kind === 'phenomena');
  assert.equal(rows.length, 45);
  for (const r of rows) {
    const p = bodyPhenomena(r.body, r.jd), label = `${r.body} ${r.jd}`;
    // Native public phase uses an apparent triangle (columns 0/1); columns
    // 5/6 use its astrometric solution for the physical triangle exposed here.
    if (r.body !== 'sun') {
      near(p.phaseAngleDeg, r.expected[5], 0.0002, `${label} phase deg`);
      near(p.illuminatedFraction, r.expected[6], 1e-6, `${label} illumination`);
    }
    near(p.solarElongationDeg, r.expected[2], 0.001, `${label} elongation deg`);
    near(p.apparentDiameterArcsec, r.expected[3], 0.003, `${label} diameter arcsec`);
    near(p.horizontalParallaxDeg, r.expected[7], 2e-6, `${label} parallax deg`);
  }
});

test('topocentric coordinates match native DE441 at northern, southern and polar sites', () => {
  for (const r of nativeRows.filter(r => r.kind === 'horizontal')) {
    const p = bodyHorizontalPosition(r.body, r.jd, r.observer, r.options);
    const label = `${r.body} ${r.jd} ${r.observer.latitudeDeg}`;
    const azimuthError = ((p.azimuthDeg - r.expected[0] + 540) % 360) - 180;
    near(azimuthError, 0, 0.001, `${label} azimuth deg`);
    near(p.geometricAltitudeDeg, r.expected[1], 0.001, `${label} altitude deg`);
    near(p.apparentAltitudeDeg, r.expected[2], 0.001, `${label} refracted altitude deg`);
    const distanceTolerance = ['uranus', 'neptune'].includes(r.body) ? 5e-5 : r.body === 'moon' ? 1e-8 : 3e-6;
    near(p.distanceAu, r.expected[3], distanceTolerance, `${label} distance AU`);
  }
});

test('independent native interval searches match every rise, set and transit, including limb refraction', () => {
  for (const r of nativeRows.filter(r => r.kind === 'visibility')) {
    const p = bodyRiseSetForDay(r.body, r.jd, r.observer, r.options);
    const fields = ['rises', 'sets', 'upperTransits', 'lowerTransits'];
    for (const [i, key] of fields.entries()) {
      const label = `${r.body} ${r.jd} ${r.observer.latitudeDeg} ${JSON.stringify(r.options)} ${key}`;
      assert.equal(p[key].length, r.expected[i].length, `${label} count`);
      for (const [j, t] of p[key].entries()) near((t - r.expected[i][j]) * 86400, 0, 0.5, `${label} seconds`);
    }
  }
});

test('illumination, true angular elongation and phase angle have physical ranges', () => {
  for (const body of SKY_BODIES) {
    const p = bodyPhenomena(body, 2460409.25);
    assert.ok(p.distanceAu > 0 && p.apparentDiameterArcsec > 0);
    assert.ok(p.solarElongationDeg >= 0 && p.solarElongationDeg <= 180);
    if (body === 'sun') { assert.equal(p.illuminatedFraction, null); continue; }
    assert.ok(p.phaseAngleDeg >= 0 && p.phaseAngleDeg <= 180);
    assert.ok(p.illuminatedFraction >= 0 && p.illuminatedFraction <= 1);
    assert.ok(Math.abs(p.illuminatedFraction - (1 + Math.cos(p.phaseAngleDeg * Math.PI / 180)) / 2) < 1e-14);
  }
});

test('new/full moon geometry agrees with the independent calendar phase solver', () => {
  const newMoon = solveNewMoon(2460409).jdTT;
  const fullMoon = solveLunarPhase(Math.PI, 2460425).jdTT;
  const dark = moonIllumination(newMoon), full = moonIllumination(fullMoon);
  assert.ok(dark.illuminatedFraction < 0.003);
  assert.ok(full.illuminatedFraction > 0.997);
  assert.ok(dark.apparentDiameterArcsec > 1700 && dark.apparentDiameterArcsec < 2100);
  assert.equal(moonIllumination(newMoon + 3).waxing, true);
  assert.equal(moonIllumination(newMoon - 3).waxing, false);
  const fixed = moonIllumination(newMoon + 3, { frame: 'j2000' });
  const date = moonIllumination(newMoon + 3, { frame: 'true-of-date' });
  assert.ok(Math.abs(fixed.illuminatedFraction - date.illuminatedFraction) < 1e-12);
  assert.equal(fixed.phaseCycle, date.phaseCycle);
});

const observer = { longitudeDeg: 116.4, latitudeDeg: 39.9, heightMeters: 40 };
test('horizontal positions use topocentric geometry, refraction and explicit axes', () => {
  const raw = bodyHorizontalPosition('moon', 2460409.98, observer, { refraction: false });
  const refracted = bodyHorizontalPosition('moon', 2460409.98, observer);
  assert.ok(raw.azimuthDeg >= 0 && raw.azimuthDeg < 360);
  assert.ok(raw.distanceAu < 0.004 && raw.distanceAu > 0.002);
  assert.equal(raw.apparentAltitudeDeg, raw.geometricAltitudeDeg);
  assert.ok(refracted.apparentAltitudeDeg >= raw.geometricAltitudeDeg);
  assert.throws(() => bodyHorizontalPosition('moon', 2451545, observer, { apparent: { frame: 'j2000' } }), /true-of-date/);
  assert.throws(() => bodyHorizontalPosition('moon', 2451545, { latitudeDeg: 100, longitudeDeg: 0 }), /observer/);
  assert.throws(() => bodyHorizontalPosition('moon', 2451545, { ...observer, temperatureCelsius: -273 }), /atmosphere/);
});

test('rise/set and meridian transits lie inside the requested UT1 day', () => {
  const start = 2460409.5;
  for (const body of ['sun', 'moon', 'venus']) {
    const result = bodyRiseSetForDay(body, start, observer, { limb: 'center', refraction: false });
    assert.equal(result.altitudeState, 'crosses');
    assert.equal(result.rises.length, 1); assert.equal(result.sets.length, 1);
    assert.equal(result.upperTransits.length, 1); assert.equal(result.lowerTransits.length, 1);
    for (const t of [...result.rises, ...result.sets, ...result.upperTransits, ...result.lowerTransits]) {
      assert.ok(t >= start && t < start + 1);
    }
    for (const t of [...result.rises, ...result.sets]) {
      assert.ok(Math.abs(bodyHorizontalPosition(body, t, observer, { refraction: false }).geometricAltitudeDeg) < 1e-4);
    }
    const rising = result.rises[0], setting = result.sets[0];
    assert.ok(bodyHorizontalPosition(body, rising + 1e-3, observer, { refraction: false }).geometricAltitudeDeg > 0);
    assert.ok(bodyHorizontalPosition(body, setting + 1e-3, observer, { refraction: false }).geometricAltitudeDeg < 0);
    const transit = bodyHorizontalPosition(body, result.upperTransits[0], observer);
    assert.ok(Math.abs(transit.hourAngleDeg) < 1e-4);
  }
});

test('polar summer/winter report continuous visibility rather than inventing crossings', () => {
  const site = { longitudeDeg: 15, latitudeDeg: 78 };
  const summer = bodyRiseSetForDay('sun', 2460482.5, site);
  const winter = bodyRiseSetForDay('sun', 2460665.5, site);
  assert.equal(summer.altitudeState, 'always-above');
  assert.equal(winter.altitudeState, 'always-below');
  assert.deepEqual(summer.rises, []); assert.deepEqual(winter.sets, []);
});

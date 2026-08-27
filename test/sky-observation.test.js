import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyPhenomena, moonIllumination } from '../src/phenomena.js';
import { bodyHorizontalPosition, bodyRiseSetForDay } from '../src/body-visibility.js';
import { SKY_BODIES } from '../src/apparent.js';
import { solveNewMoon, solveLunarPhase } from '../src/calendar-events.js';

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

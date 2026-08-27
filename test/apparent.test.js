import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SKY_BODIES, SKY_FRAME, APPARENT_MODEL_INFO, LIGHT_TIME_DAYS_PER_AU,
  apparentBodyPosition, apparentBodyState, greenwichSiderealTime,
} from '../src/apparent.js';
import { AU_KM, moonGeocentricPosition, planetGeocentricPosition, sunGeocentricPosition } from '../src/ephemeris.js';
import { iau2000bNutation, meanEclipticOfDateMatrixState } from '../src/coordinates.js';
import { signedDeg, transform, RAD } from '../src/sky-math.js';

function near(a, b, tolerance, label = '') {
  assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b} (tolerance ${tolerance})`);
}
const geometric = { lightTime: false, aberration: false, solarDeflection: false };

test('fixed J2000, mean date and true date are distinct explicit frames', () => {
  for (const body of SKY_BODIES) {
    const t = 2469807.5;
    const fixed = apparentBodyPosition(body, t, { frame: SKY_FRAME.J2000 });
    const mean = apparentBodyPosition(body, t, { frame: SKY_FRAME.MEAN_OF_DATE });
    const apparent = apparentBodyPosition(body, t);
    const expected = transform(meanEclipticOfDateMatrixState(t).matrix, fixed.eclipticPositionAu);
    expected.forEach((x, i) => near(mean.eclipticPositionAu[i], x, 1e-13));
    near(signedDeg(apparent.longitudeDeg - mean.longitudeDeg), iau2000bNutation(t).dpsi * RAD, 1e-10);
    near(apparent.latitudeDeg, mean.latitudeDeg, 1e-10);
    near(fixed.distanceAu, mean.distanceAu, 1e-12);
    assert.ok(Math.abs(signedDeg(mean.longitudeDeg - fixed.longitudeDeg)) > 0.5);
    assert.equal(fixed.frame, 'j2000');
    assert.equal(apparent.frame, 'true-of-date');
  }
});

test('turning physical corrections off recovers native J2000 geometry, with Moon km converted to AU', () => {
  for (const corrections of [true, false]) for (const body of SKY_BODIES) {
    const p = apparentBodyPosition(body, 2451545, { ...geometric, frame: 'j2000', corrections });
    const raw = body === 'moon' ? moonGeocentricPosition(2451545, { corrections }).map(x => x / AU_KM)
      : body === 'sun' ? sunGeocentricPosition(2451545, { corrections })
      : planetGeocentricPosition(body, 2451545, { corrections });
    raw.forEach((x, i) => near(p.eclipticPositionAu[i], x, 2e-14, body));
    near(Math.hypot(...p.equatorialPositionAu), Math.hypot(...raw), 2e-13);
    assert.equal(p.lightTimeDays, 0);
  }
});

test('light-time stays finite for the solar origin and satisfies range/c', () => {
  for (const body of SKY_BODIES) {
    const p = apparentBodyPosition(body, 2460409.25);
    assert.ok(p.distanceAu > 0 && Number.isFinite(p.lightTimeDays));
    near(p.lightTimeDays, p.distanceAu * LIGHT_TIME_DAYS_PER_AU, 1e-11, body);
    assert.ok(p.rightAscensionDeg >= 0 && p.rightAscensionDeg < 360);
  }
  assert.equal(APPARENT_MODEL_INFO.shapiroDelay, false);
});

test('all apparent rates include the changing frame and survive longitude wrap', () => {
  const step = 0.002;
  for (const frame of Object.values(SKY_FRAME)) for (const body of ['sun', 'moon', 'mercury', 'neptune']) {
    const t = 2460390.629;
    const p = apparentBodyState(body, t, { frame });
    const before = apparentBodyPosition(body, t - step, { frame });
    const after = apparentBodyPosition(body, t + step, { frame });
    const dt = (t + step) - (t - step);
    near(p.longitudeSpeedDegPerDay, signedDeg(after.longitudeDeg - before.longitudeDeg) / dt, 2e-5, body);
    near(p.rightAscensionSpeedDegPerDay, signedDeg(after.rightAscensionDeg - before.rightAscensionDeg) / dt, 2e-5, body);
    for (let i = 0; i < 3; i++) near(p.eclipticVelocityAuPerDay[i],
      (after.eclipticPositionAu[i] - before.eclipticPositionAu[i]) / dt, 1e-7, body);
  }
});

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/sky-de441.json', import.meta.url), 'utf8'));
test('81 C++/DE441 reference states: nine bodies, three epochs, three reference frames', () => {
  // Regression envelopes for these samples, not advertised long-range precision.
  const limits = {
    sun: [0.2, 30], moon: [0.8, 2], mercury: [0.5, 100], venus: [0.5, 150],
    mars: [1.5, 250], jupiter: [1, 1000], saturn: [1, 1500], uranus: [8, 60000], neptune: [4, 30000],
  };
  assert.equal(fixtures.samples.length, 81);
  for (const row of fixtures.samples) {
    const p = apparentBodyState(row.body, row.jdTT, { frame: row.frame });
    const [angleTolerance, rangeTolerance] = limits[row.body];
    near(signedDeg(p.longitudeDeg - row.values[0]) * 3600, 0, angleTolerance, `${row.body}/${row.frame} longitude`);
    near((p.latitudeDeg - row.values[1]) * 3600, 0, angleTolerance, `${row.body}/${row.frame} latitude`);
    near((p.distanceAu - row.values[6]) * AU_KM, 0, rangeTolerance, `${row.body} range`);
    near(p.longitudeSpeedDegPerDay, row.values[3], row.body === 'moon' ? 0.001 : 0.0001, `${row.body} speed`);
  }
});

test('bad body, nonfinite time, invalid frame and sidereal input fail explicitly', () => {
  assert.throws(() => apparentBodyPosition('earth', 2451545), /unsupported/);
  assert.throws(() => apparentBodyPosition('pluto', 2451545), /unsupported/);
  assert.throws(() => apparentBodyPosition('mars', NaN), /finite/);
  assert.throws(() => apparentBodyPosition('mars', 2451545, { frame: 'ICRS' }), /frame/);
  assert.throws(() => greenwichSiderealTime(Infinity), /finite/);
  const sidereal = greenwichSiderealTime(2451545);
  assert.ok(sidereal > 280 && sidereal < 281);
});

test('new sky chain remains finite across the lite model span and correction bridges', () => {
  for (const year of [-6000, -1000, 1000, 1100, 1200, 2800, 2900, 3000, 10000]) {
    const jdTT = 2451545 + (year - 2000) * 365.25;
    for (const frame of Object.values(SKY_FRAME)) for (const body of SKY_BODIES) {
      const p = apparentBodyState(body, jdTT, { frame });
      for (const key of ['longitudeDeg', 'latitudeDeg', 'distanceAu', 'longitudeSpeedDegPerDay']) {
        assert.ok(Number.isFinite(p[key]), `${body}/${year}/${frame}/${key}`);
      }
      assert.ok(p.distanceAu > 0);
    }
  }
});

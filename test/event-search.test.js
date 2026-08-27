import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCrossings, searchAngleCrossings, searchLongitudeCrossings, searchRelativeLongitude,
  searchStations, searchIngresses } from '../src/event-search.js';
import { apparentBodyPosition, apparentBodyState } from '../src/apparent.js';
import { signedDeg } from '../src/sky-math.js';

test('scalar search is half-open, deduplicated, and rejects invalid scans', () => {
  assert.deepEqual(searchCrossings(t => t * (t - 1) * (t - 2), 0, 2).map(x => x.time), [0, 1]);
  const roots = searchCrossings(t => (t - 0.123) * (t - 0.756), 0, 1, { stepDays: 0.1 });
  assert.equal(roots.length, 2);
  assert.ok(Math.abs(roots[0].time - 0.123) < 1e-8);
  assert.ok(Math.abs(roots[1].time - 0.756) < 1e-8);
  assert.deepEqual(searchCrossings(() => 1, 2, 2), []);
  for (const options of [{ stepDays: 0 }, { toleranceDays: 0 }, { stepDays: NaN }]) {
    assert.throws(() => searchCrossings(t => t, 0, 1, options), /stepDays/);
  }
  assert.throws(() => searchCrossings(() => NaN, 0, 1), /finite/);
  assert.throws(() => searchCrossings(() => 0, 0, 1), /isolated/);
  assert.throws(() => searchCrossings(t => t, 2, 1), /precede/);
  assert.throws(() => searchCrossings(t => t, 0, 1e8), /200000/);
});

test('angular roots handle 359 -> 0 without mistaking the antipode for a root', () => {
  const angle = t => ((350 + 40 * t) % 360 + 360) % 360;
  const roots = searchAngleCrossings(angle, 0, 0, 10);
  assert.equal(roots.length, 2);
  assert.ok(Math.abs(roots[0].time - 0.25) < 1e-8);
  assert.ok(Math.abs(roots[1].time - 9.25) < 1e-8);
  assert.deepEqual(searchAngleCrossings(t => 180 + t, 0, -1, 1), []);
});

test('Mercury April 2024 stations change direction on both sides of each returned root', () => {
  const roots = searchStations('mercury', 2460401.5, 2460431.5);
  assert.equal(roots.length, 2);
  assert.deepEqual(roots.map(x => x.direction), ['retrograde', 'direct']);
  assert.ok(Math.abs(roots[0].jdTT - 2460402.4275) < 0.01);
  assert.ok(Math.abs(roots[1].jdTT - 2460426.0384) < 0.01);
  for (const root of roots) {
    const before = apparentBodyState('mercury', root.jdTT - 0.05).longitudeSpeedDegPerDay;
    const after = apparentBodyState('mercury', root.jdTT + 0.05).longitudeSpeedDegPerDay;
    assert.ok(before * after < 0);
    assert.ok(Math.abs(root.longitudeSpeedDegPerDay) < 1e-5);
  }
});

test('longitude searches respect the chosen axes and end exclusion', () => {
  const start = 2460401.5, end = start + 1;
  const target = apparentBodyPosition('sun', start, { frame: 'j2000' }).longitudeDeg;
  const options = { apparent: { frame: 'j2000' } };
  const roots = searchLongitudeCrossings('sun', target, start, end, options);
  assert.equal(roots.length, 1); assert.equal(roots[0].jdTT, start);
  assert.equal(roots[0].frame, 'j2000');
  assert.equal(searchLongitudeCrossings('sun', target, start - 1, start, options).length, 0);
  assert.equal(searchLongitudeCrossings('sun', target, start, end).length, 0);
});

test('new/full conjunction searches do not return the antipodal phase', () => {
  const newMoons = searchRelativeLongitude('moon', 'sun', 0, 2460401.5, 2460431.5);
  const fullMoons = searchRelativeLongitude('moon', 'sun', 180, 2460401.5, 2460431.5);
  assert.equal(newMoons.length, 1); assert.equal(fullMoons.length, 1);
  assert.ok(Math.abs(newMoons[0].jdTT - 2460409.2653) < 0.01);
  for (const root of [...newMoons, ...fullMoons]) {
    const delta = apparentBodyPosition('moon', root.jdTT).longitudeDeg
      - apparentBodyPosition('sun', root.jdTT).longitudeDeg - root.angleDeg;
    assert.ok(Math.abs(signedDeg(delta)) < 2e-6);
  }
  assert.throws(() => searchRelativeLongitude('mars', 'mars', 0, 0, 1), /different/);
});

test('ingresses retain reverse-direction re-entry and use zero-based sign indices', () => {
  const roots = searchIngresses('mercury', 2460310.5, 2460676.5);
  assert.ok(roots.some(x => x.direction === 'retrograde'));
  for (const root of roots) {
    const before = Math.floor(apparentBodyPosition('mercury', root.jdTT - 1e-3).longitudeDeg / 30);
    const after = Math.floor(apparentBodyPosition('mercury', root.jdTT + 1e-3).longitudeDeg / 30);
    assert.equal(root.fromSign, before); assert.equal(root.toSign, after);
    assert.ok(Math.abs(signedDeg(root.longitudeDeg - root.boundaryDeg)) < 1e-5);
  }
});

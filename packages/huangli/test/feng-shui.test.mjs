import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MOUNTAIN, MOUNTAINS, getMountain, oppositeMountain, mountainForAzimuth,
  createEarthPlate, createMountainPlate, createFacingPlate, createFengShuiChart,
  calculatePaiLong, getPaiLongFacingStar,
} from '../src/feng-shui.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/additions-dart.json', import.meta.url)));

test('all nine periods and 24 mountains match Dart mountain/facing plates', () => {
  assert.equal(fixture.plates.length, 216);
  for (const [period, mountain, earth, expectedMountain, expectedFacing] of fixture.plates) {
    const plate = createEarthPlate(period);
    assert.deepEqual(plate, earth);
    assert.deepEqual(createMountainPlate(plate, mountain), expectedMountain, `${period}/${mountain}`);
    assert.deepEqual(createFacingPlate(plate, mountain), expectedFacing, `${period}/${mountain}`);
    assert.deepEqual(plate, earth); // Input is reusable for another orientation.
    const chart = createFengShuiChart({ period, sitting: mountain });
    assert.deepEqual(chart.mountainPlate, expectedMountain);
    assert.deepEqual(chart.facingPlate, createFacingPlate(earth, oppositeMountain(mountain).key));
    assert.deepEqual(JSON.parse(JSON.stringify(chart)), chart);
  }
});

test('five-yellow borrows the original mountain polarity for each dragon', () => {
  for (const mountain of MOUNTAINS) {
    const row = fixture.plates.find(([period, key, earth]) => key === mountain.key
      && createMountainPlate(earth, key)[4] === 5);
    assert(row);
    assert.equal(createFengShuiChart({ period: row[0], sitting: mountain.key }).mountainForward, mountain.isYang);
  }
});

test('all 24 by 24 PaiLong orientations match Dart; the full ring agrees with facing lookup', () => {
  assert.equal(fixture.paiLong.length, 576);
  for (const [source, facing, star] of fixture.paiLong) {
    assert.equal(getPaiLongFacingStar(source, facing), star, `${source}/${facing}`);
    const result = calculatePaiLong(source, facing);
    assert.equal(result.facingStar, star);
    assert.equal(result.stars[Math.floor(getMountain(facing).azimuthDeg / 30)].star, star);
    assert.equal(result.stars[result.startBranch].star, '破军');
    assert.equal(result.stars.filter(s => s.star === '破军').length, 4);
  }
});

test('mountains use north-clockwise half-open 15-degree sectors and explicit opposites', () => {
  assert.equal(MOUNTAIN.ZI, 'zi');
  for (const m of MOUNTAINS) {
    assert.equal(getMountain(m.name), m);
    assert.equal(mountainForAzimuth(m.azimuthDeg), m);
    assert.equal(mountainForAzimuth(m.azimuthDeg - 7.5), m);
    assert.equal(mountainForAzimuth(m.azimuthDeg + 7.5 - 1e-8), m);
    assert.notEqual(mountainForAzimuth(m.azimuthDeg + 7.5), m);
    assert.equal(oppositeMountain(oppositeMountain(m.key).key), m);
    assert(Object.isFrozen(m));
  }
  assert.equal(mountainForAzimuth(360), getMountain('子'));
  assert.equal(mountainForAzimuth(-15), getMountain('壬'));
});

test('feng-shui input validation rejects malformed plates and unknown directions', () => {
  for (const bad of [0, 10, 1.5, NaN, '9']) assert.throws(() => createEarthPlate(bad));
  for (const bad of [[], [1,2,3,4,5,6,7,8,8], [0,1,2,3,4,5,6,7,8], new Array(9)]) {
    assert.throws(() => createMountainPlate(bad, 'zi'));
  }
  for (const bad of [undefined, 'north', {}, 0]) assert.throws(() => getMountain(bad));
  for (const bad of [NaN, Infinity, '0']) assert.throws(() => mountainForAzimuth(bad));
});

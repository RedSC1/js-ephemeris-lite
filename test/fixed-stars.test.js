import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TSC1_STAR_FLAGS, fixedStarIcrfState, fixedStarPosition, fixedStarState,
  normalizeTsc1Alias, parseTsc1Catalog,
} from '../src/fixed-stars.js';
import { J2000 } from '../src/coordinates.js';
import { signedDeg, spherical } from '../src/sky-math.js';

const catalogBytes = readFileSync(new URL(
  '../packages/star-catalog/data/stars-bright-v5.tsc1', import.meta.url,
));

test('TSC1 parser accepts a nonzero Uint8Array offset and preserves catalog metadata', () => {
  const wrapped = new Uint8Array(catalogBytes.length + 17);
  wrapped.set(catalogBytes, 11);
  const catalog = parseTsc1Catalog(wrapped.subarray(11, 11 + catalogBytes.length));
  assert.equal(catalog.starCount, 2057);
  assert.equal(catalog.aliasCount, 12242);
  assert.equal(catalog.version, 1);
  assert.equal(catalog.find('Sirius').canonicalId, 'sirius');
  assert.equal(catalog.find('HIP-32349').canonicalId, 'sirius');
  assert.equal(catalog.find('参宿一').canonicalId, 'hr_1948');
});

test('TSC1 alias folding matches ASCII separators and preserves Chinese text', () => {
  assert.equal(normalizeTsc1Alias('  HIP-91262  '), 'hip_91262');
  assert.equal(normalizeTsc1Alias('Alpha Lyr'), 'alpha_lyr');
  assert.equal(normalizeTsc1Alias('角宿一'), '角宿一');
});

test('reference-epoch state reconstructs catalog direction, distance and proper motion', () => {
  const catalog = parseTsc1Catalog(catalogBytes);
  const star = catalog.find('vega');
  const referenceJd = J2000 + (star.referenceEpoch - 2000) * 365.25;
  const state = fixedStarIcrfState(catalog, star, referenceJd);
  const direction = spherical(state.positionAu);
  assert.ok(Math.abs(signedDeg(direction.longitudeDeg - star.rightAscensionDeg)) < 1e-11);
  assert.ok(Math.abs(direction.latitudeDeg - star.declinationDeg) < 1e-11);
  assert.ok((star.flags & TSC1_STAR_FLAGS.HAS_PARALLAX) !== 0);
  assert.ok(Math.abs(direction.distanceAu - 648000000 / Math.PI / star.parallaxMas) < 1e-6);
  assert.ok(state.velocityAuPerDay.some(value => value !== 0));
});

test('space motion from every catalog source matches the independent C++ TSC1 implementation', () => {
  const catalog = parseTsc1Catalog(catalogBytes);
  const cases = [
    ['hr_98', 2300000.25,
      [337968.43797211692, 31205.480416221777, -1504733.3848034733],
      [0.0013480474142122346, 0.04587833500389292, 0.0014747838789123872]],
    ['vega', 2460000.5,
      [200162.27480390723, -1230884.8387992503, 1002138.6909854602],
      [0.0035998167742702426, 0.0044589846704233341, 0.0047584187912041208]],
    ['hr_4374', 2600000.75,
      [-1261526.7582218836, 234079.2790448227, 785118.82456031383],
      [0.0032900888380648701, 0.0081718772397114964, -0.014814289278047597]],
    ['galactic_center_j2000', 2451545,
      [-54657181.474787027, -872843977.39633393, -484928843.8896786],
      [0, 0, 0]],
  ];
  for (const [key, jd, expectedPosition, expectedVelocity] of cases) {
    const state = fixedStarIcrfState(catalog, key, jd);
    for (let i = 0; i < 3; i += 1) {
      assert.ok(Math.abs(state.positionAu[i] - expectedPosition[i]) < 1e-9);
      assert.ok(Math.abs(state.velocityAuPerDay[i] - expectedVelocity[i]) < 1e-17);
    }
  }
});

test('fixed-star apparent frames and complete rates remain finite', () => {
  const catalog = parseTsc1Catalog(catalogBytes);
  const jd = 2460000.5;
  const fixed = fixedStarPosition(catalog, '角宿一', jd, {
    frame: 'j2000', aberration: false, solarDeflection: false,
  });
  const mean = fixedStarPosition(catalog, '角宿一', jd, {
    frame: 'mean-of-date', aberration: false, solarDeflection: false,
  });
  const apparent = fixedStarState(catalog, '角宿一', jd);
  assert.ok(Math.abs(signedDeg(mean.longitudeDeg - fixed.longitudeDeg)) > 0.1);
  assert.ok(Math.abs(signedDeg(apparent.rightAscensionDeg - mean.rightAscensionDeg)) < 1);
  assert.ok([
    apparent.longitudeDeg, apparent.latitudeDeg, apparent.rightAscensionDeg,
    apparent.declinationDeg, apparent.longitudeSpeedDegPerDay,
    ...apparent.eclipticVelocityAuPerDay,
  ].every(Number.isFinite));
  assert.ok(Math.abs(apparent.declinationDeg - catalog.find('角宿一').declinationDeg) < 1);
});

test('malformed and unsupported TSC1 files fail before evaluation', () => {
  assert.throws(() => parseTsc1Catalog(new Uint8Array(132)), /not a TSC1/);
  const unsupported = new Uint8Array(catalogBytes);
  new DataView(unsupported.buffer).setUint32(4, 2, true);
  assert.throws(() => parseTsc1Catalog(unsupported), /unsupported TSC1 version/);
  const truncated = catalogBytes.subarray(0, catalogBytes.length - 1);
  assert.throws(() => parseTsc1Catalog(truncated), /outside the TSC1 file/);
});

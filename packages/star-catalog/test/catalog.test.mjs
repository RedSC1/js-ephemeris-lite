import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fixedStarIcrfState, fixedStarPosition } from 'js-ephemeris-lite/fixed-stars';
import {
  LITE_STAR_CATALOG_INFO, loadLiteStarCatalog, loadLiteStarCatalogBytes,
} from '../src/node.js';

test('packaged catalog is the complete checked TSC1 lite asset', async () => {
  const bytes = await loadLiteStarCatalogBytes();
  assert.equal(bytes.byteLength, LITE_STAR_CATALOG_INFO.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), LITE_STAR_CATALOG_INFO.sha256);
  const catalog = await loadLiteStarCatalog();
  assert.equal(catalog.starCount, 2114);
  assert.equal(catalog.aliasCount, 9621);
  assert.equal(catalog.catalogMinEpoch, 1991.25);
  assert.equal(catalog.catalogMaxEpoch, 2016);
});

test('aliases, Unicode names and full astrometry survive the package boundary', async () => {
  const catalog = await loadLiteStarCatalog();
  const vega = catalog.find('Vega');
  assert.equal(vega.canonicalId, 'vega');
  assert.equal(catalog.find('HIP 91262').index, vega.index);
  assert.equal(catalog.find('HR-7001').index, vega.index);
  assert.equal(catalog.find('角宿一').canonicalId, 'spica');
  assert.ok(vega.parallaxMas > 100);
  assert.ok(Number.isFinite(vega.referenceEpoch));
});

test('TSC1 space motion and apparent positions are finite', async () => {
  const catalog = await loadLiteStarCatalog();
  const state = fixedStarIcrfState(catalog, 'sirius', 2460000.5);
  assert.ok(state.positionAu.every(Number.isFinite));
  assert.ok(state.velocityAuPerDay.every(Number.isFinite));
  const apparent = fixedStarPosition(catalog, 'sirius', 2460000.5);
  assert.ok(apparent.rightAscensionDeg >= 0 && apparent.rightAscensionDeg < 360);
  assert.ok(apparent.declinationDeg > -30 && apparent.declinationDeg < -10);
});

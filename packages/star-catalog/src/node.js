import { readFile } from 'node:fs/promises';
import { parseTsc1Catalog } from 'js-ephemeris-lite/fixed-stars';
import { LITE_STAR_CATALOG_INFO, LITE_STAR_CATALOG_URL } from './catalog.js';

export { LITE_STAR_CATALOG_INFO, LITE_STAR_CATALOG_URL };

export async function loadLiteStarCatalogBytes() {
  return new Uint8Array(await readFile(LITE_STAR_CATALOG_URL));
}

export async function loadLiteStarCatalog() {
  return parseTsc1Catalog(await loadLiteStarCatalogBytes());
}

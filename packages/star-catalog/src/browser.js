import { parseTsc1Catalog } from 'js-ephemeris-lite/fixed-stars';
import { LITE_STAR_CATALOG_INFO, LITE_STAR_CATALOG_URL } from './catalog.js';

export { LITE_STAR_CATALOG_INFO, LITE_STAR_CATALOG_URL };

export async function loadLiteStarCatalogBytes() {
  const response = await fetch(LITE_STAR_CATALOG_URL);
  if (!response.ok) throw new Error(`unable to load lite TSC1 catalog: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadLiteStarCatalog() {
  return parseTsc1Catalog(await loadLiteStarCatalogBytes());
}

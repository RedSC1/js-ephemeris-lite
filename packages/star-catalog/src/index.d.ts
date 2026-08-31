import type { Tsc1Catalog } from 'js-ephemeris-lite/fixed-stars';

export const LITE_STAR_CATALOG_URL: URL;
export const LITE_STAR_CATALOG_INFO: Readonly<{
  format: 'TSC1';
  version: 1;
  stars: 2114;
  aliases: 9621;
  bytes: 486122;
  sha256: '93fac4f1bf6c8ea451bda488ef152c60f9e89912e0efa2cc17f4b47f3edc5101';
  magnitudeSelection: string;
}>;
export function loadLiteStarCatalogBytes(): Promise<Uint8Array>;
export function loadLiteStarCatalog(): Promise<Tsc1Catalog>;

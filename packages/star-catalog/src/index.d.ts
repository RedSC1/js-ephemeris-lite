import type { Tsc1Catalog } from 'js-ephemeris-lite/fixed-stars';

export const LITE_STAR_CATALOG_URL: URL;
export const LITE_STAR_CATALOG_INFO: Readonly<{
  format: 'TSC1';
  version: 1;
  stars: 2057;
  aliases: 12242;
  bytes: 559930;
  sha256: '91587ffc17edde9c0736c0df821a5a9a97adda8bfe82ddfdae0d79e4f3312f40';
  magnitudeSelection: string;
}>;
export function loadLiteStarCatalogBytes(): Promise<Uint8Array>;
export function loadLiteStarCatalog(): Promise<Tsc1Catalog>;

export * from './chart.js';
export * from './constants.js';
export * from './fortune.js';
export * from './pillar.js';
export * from './relations.js';
export * from './rules.js';

export const BAZI_LITE_INFO = Object.freeze({
  status: 'rule core available',
  corePackage: 'js-ephemeris-lite',
  pillarEncoding: 'uint8-compatible: high nibble=stem, low nibble=branch',
});

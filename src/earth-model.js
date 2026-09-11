import { EARTH_L, EARTH_B, EARTH_R } from './earth-series.js';
import { EARTH_L_PREFIX_COUNTS, EARTH_B_PREFIX_COUNTS, EARTH_R_PREFIX_COUNTS } from './earth-prefix-counts.js';
import { createDirectPlanetModel } from './direct-planet-model.js';

const EARTH_LIMITS = Object.freeze({
  fast: Object.freeze({ 0: 60, 2: 30 }),
  mid: Object.freeze({ 0: 129 }),
});

export const earthModel = createDirectPlanetModel(
  EARTH_L,
  EARTH_B,
  EARTH_R,
  {
    prefixCounts: [EARTH_L_PREFIX_COUNTS, EARTH_B_PREFIX_COUNTS, EARTH_R_PREFIX_COUNTS],
    accuracyLimits: EARTH_LIMITS,
  },
);

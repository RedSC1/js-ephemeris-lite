import { MERCURY_L, MERCURY_B, MERCURY_R } from './mercury-series.js';
import { VENUS_L, VENUS_B, VENUS_R } from './venus-series.js';
import { MARS_L, MARS_B, MARS_R } from './mars-series.js';
import { JUPITER_L, JUPITER_B, JUPITER_R } from './jupiter-series.js';
import { SATURN_L, SATURN_B, SATURN_R } from './saturn-series.js';
import { URANUS_L, URANUS_B, URANUS_R } from './uranus-series.js';
import { NEPTUNE_L, NEPTUNE_B, NEPTUNE_R } from './neptune-series.js';
import { earthModel } from './earth-model.js';
export { earthModel } from './earth-model.js';
import {
  MERCURY_PREFIX_COUNTS, VENUS_PREFIX_COUNTS, MARS_PREFIX_COUNTS,
  JUPITER_PREFIX_COUNTS, SATURN_PREFIX_COUNTS, URANUS_PREFIX_COUNTS,
  NEPTUNE_PREFIX_COUNTS,
} from './planet-prefix-counts.js';
import { createDirectPlanetModel } from './direct-planet-model.js';

const DIRECT_LIMITS = Object.freeze({
  fast: Object.freeze({ 0: 'fast', 1: 'fast', 2: 'fast' }),
  mid: Object.freeze({ 0: 'mid', 1: 'mid', 2: 'mid' }),
});

function directModel(L, B, R, prefixCounts) {
  return createDirectPlanetModel(L, B, R, { prefixCounts, accuracyLimits: DIRECT_LIMITS });
}

export const planetModels = {
  mercury: directModel(MERCURY_L, MERCURY_B, MERCURY_R, MERCURY_PREFIX_COUNTS),
  venus: directModel(VENUS_L, VENUS_B, VENUS_R, VENUS_PREFIX_COUNTS),
  earth: earthModel,
  mars: directModel(MARS_L, MARS_B, MARS_R, MARS_PREFIX_COUNTS),
  jupiter: directModel(JUPITER_L, JUPITER_B, JUPITER_R, JUPITER_PREFIX_COUNTS),
  saturn: directModel(SATURN_L, SATURN_B, SATURN_R, SATURN_PREFIX_COUNTS),
  uranus: directModel(URANUS_L, URANUS_B, URANUS_R, URANUS_PREFIX_COUNTS),
  neptune: directModel(NEPTUNE_L, NEPTUNE_B, NEPTUNE_R, NEPTUNE_PREFIX_COUNTS),
};

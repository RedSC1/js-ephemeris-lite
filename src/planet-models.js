import {
  MERCURY_L, MERCURY_B, MERCURY_R,
  VENUS_L, VENUS_B, VENUS_R,
  EARTH_L, EARTH_B, EARTH_R,
  MARS_L, MARS_B, MARS_R,
  JUPITER_L, JUPITER_B, JUPITER_R,
  SATURN_L, SATURN_B, SATURN_R,
  URANUS_L, URANUS_B, URANUS_R,
  NEPTUNE_L, NEPTUNE_B, NEPTUNE_R,
} from './planet-series.js';
import { EARTH_L_PREFIX_COUNTS, EARTH_B_PREFIX_COUNTS, EARTH_R_PREFIX_COUNTS } from './earth-prefix-counts.js';
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
const EARTH_LIMITS = Object.freeze({
  fast: Object.freeze({ 0: 60, 2: 30 }),
  mid: Object.freeze({ 0: 129 }),
});

function directModel(L, B, R, prefixCounts) {
  return createDirectPlanetModel(L, B, R, { prefixCounts, accuracyLimits: DIRECT_LIMITS });
}

export const earthModel = createDirectPlanetModel(
  EARTH_L,
  EARTH_B,
  EARTH_R,
  {
    prefixCounts: [EARTH_L_PREFIX_COUNTS, EARTH_B_PREFIX_COUNTS, EARTH_R_PREFIX_COUNTS],
    accuracyLimits: EARTH_LIMITS,
  },
);
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

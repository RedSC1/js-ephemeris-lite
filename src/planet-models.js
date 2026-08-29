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
import { createDirectPlanetModel, chebyshevBasis, anchoredChebyshevBasis } from './direct-planet-model.js';

export const earthModel = createDirectPlanetModel(EARTH_L, EARTH_B, EARTH_R, anchoredChebyshevBasis);
export const planetModels = {
  mercury: createDirectPlanetModel(MERCURY_L, MERCURY_B, MERCURY_R),
  venus: createDirectPlanetModel(VENUS_L, VENUS_B, VENUS_R),
  earth: earthModel,
  mars: createDirectPlanetModel(MARS_L, MARS_B, MARS_R),
  jupiter: createDirectPlanetModel(JUPITER_L, JUPITER_B, JUPITER_R),
  saturn: createDirectPlanetModel(SATURN_L, SATURN_B, SATURN_R),
  uranus: createDirectPlanetModel(URANUS_L, URANUS_B, URANUS_R, chebyshevBasis),
  neptune: createDirectPlanetModel(NEPTUNE_L, NEPTUNE_B, NEPTUNE_R),
};

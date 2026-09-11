import { earthHeliocentricState } from './sun-moon-ephemeris.js';
export * from './sun-moon-ephemeris.js';
import { planetModels } from './planet-models.js';
import { plutoModel } from './pluto-model.js';
export { PLUTO_MODEL_INFO } from './pluto-model.js';
import { checkedAccuracy } from './accuracy.js';
export const PLANET = Object.freeze({
  MERCURY: 'mercury',
  VENUS: 'venus',
  EARTH: 'earth',
  MARS: 'mars',
  JUPITER: 'jupiter',
  SATURN: 'saturn',
  URANUS: 'uranus',
  NEPTUNE: 'neptune',
  PLUTO: 'pluto',
});
const PLANET_NAMES = new Set(Object.values(PLANET));

function assertPlanet(planet) {
  if (!PLANET_NAMES.has(planet)) {
    throw new RangeError(`unknown planet: ${planet}`);
  }
}

/** Geometric heliocentric state, J2000 ecliptic/equinox, AU and AU/day.
 * WARNING: Pluto is recommended only for 1600..2200; other dates still compute
 * with low accuracy. See PLUTO_MODEL_INFO and README; do not assume event precision.
 */
export function planetHeliocentricState(planet, jdTT, accuracy = 'accurate') {
  assertPlanet(planet);
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  return (planet === PLANET.PLUTO ? plutoModel : planetModels[planet])
    .accuracyState(jdTT, checkedAccuracy(accuracy));
}

export function planetHeliocentricPosition(planet, jdTT, accuracy = 'accurate') {
  return planetHeliocentricState(planet, jdTT, accuracy).position;
}

/** Geometric geocentric planet state; light time and aberration are not applied. */
export function planetGeocentricState(planet, jdTT, accuracy = 'accurate') {
  const target = planetHeliocentricState(planet, jdTT, accuracy);
  const earth = earthHeliocentricState(jdTT, accuracy);
  return {
    position: target.position.map((value, index) => value - earth.position[index]),
    velocity: target.velocity.map((value, index) => value - earth.velocity[index]),
  };
}

export function planetGeocentricPosition(planet, jdTT, accuracy = 'accurate') {
  return planetGeocentricState(planet, jdTT, accuracy).position;
}

export const mercuryHeliocentricState = (jdTT, accuracy = 'accurate') => (
  planetHeliocentricState(PLANET.MERCURY, jdTT, accuracy)
);
export const mercuryHeliocentricPosition = (jdTT, accuracy = 'accurate') => (
  mercuryHeliocentricState(jdTT, accuracy).position
);
export const venusHeliocentricState = (jdTT, accuracy = 'accurate') => (
  planetHeliocentricState(PLANET.VENUS, jdTT, accuracy)
);
export const venusHeliocentricPosition = (jdTT, accuracy = 'accurate') => (
  venusHeliocentricState(jdTT, accuracy).position
);
export const marsHeliocentricState = (jdTT, accuracy = 'accurate') => (
  planetHeliocentricState(PLANET.MARS, jdTT, accuracy)
);
export const marsHeliocentricPosition = (jdTT, accuracy = 'accurate') => (
  marsHeliocentricState(jdTT, accuracy).position
);
export const jupiterHeliocentricState = (jdTT, accuracy = 'accurate') => (
  planetHeliocentricState(PLANET.JUPITER, jdTT, accuracy)
);
export const jupiterHeliocentricPosition = (jdTT, accuracy = 'accurate') => (
  jupiterHeliocentricState(jdTT, accuracy).position
);
export const saturnHeliocentricState = (jdTT, accuracy = 'accurate') => (
  planetHeliocentricState(PLANET.SATURN, jdTT, accuracy)
);
export const saturnHeliocentricPosition = (jdTT, accuracy = 'accurate') => (
  saturnHeliocentricState(jdTT, accuracy).position
);
export const uranusHeliocentricState = (jdTT, accuracy = 'accurate') => (
  planetHeliocentricState(PLANET.URANUS, jdTT, accuracy)
);
export const uranusHeliocentricPosition = (jdTT, accuracy = 'accurate') => (
  uranusHeliocentricState(jdTT, accuracy).position
);
export const neptuneHeliocentricState = (jdTT, accuracy = 'accurate') => (
  planetHeliocentricState(PLANET.NEPTUNE, jdTT, accuracy)
);
export const neptuneHeliocentricPosition = (jdTT, accuracy = 'accurate') => (
  neptuneHeliocentricState(jdTT, accuracy).position
);

/** WARNING: outside 1600..2200 Pluto uses a coarse fallback, not a precision ephemeris. */
export const plutoHeliocentricState = (jdTT, accuracy = 'accurate') => (
  planetHeliocentricState(PLANET.PLUTO, jdTT, accuracy)
);
/** WARNING: outside 1600..2200 Pluto remains computable but is low accuracy. */
export const plutoHeliocentricPosition = (jdTT, accuracy = 'accurate') => (
  plutoHeliocentricState(jdTT, accuracy).position
);

export const EPHEMERIS_FRAME_INFO = Object.freeze({
  frame: 'J2000 mean/dynamical ecliptic and equinox',
  geometric: true,
  lightTimeApplied: false,
  earthHeliocentricUnit: 'AU',
  planetHeliocentricUnit: 'AU',
  planetGeocentricUnit: 'AU',
  sunGeocentricUnit: 'AU',
  moonGeocentricUnit: 'km',
  moonHeliocentricUnit: 'AU',
  embHeliocentricUnit: 'AU',
  velocityTimeUnit: 'day',
});

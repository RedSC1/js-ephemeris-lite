import { moonState, moonPosition, moonDirectionState, moonElpLongitudeState } from './moon-model.js';
export { moonState, moonPosition, moonDirectionState, moonElpLongitudeState };
import { earthModel, planetModels } from './planet-models.js';
import { plutoModel } from './pluto-model.js';
import { checkedAccuracy } from './accuracy.js';
export { PLUTO_MODEL_INFO } from './pluto-model.js';
import {
  J2000,
  iau2000bNutation,
  vondrak2011PrecessionMatrix,
} from './coordinates.js';

export { J2000, iau2000bNutation, vondrak2011PrecessionMatrix };

export const AU_KM = 149597870.7;
export const EARTH_MOON_MASS_RATIO = 81.30056822149722;
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
/** Heliocentric physical Earth, mean J2000 ecliptic/equinox, AU. */
function positionAccuracy(accuracy) {
  return checkedAccuracy(accuracy);
}

export function earthPosition(jdTT, accuracy = 'accurate') {
  return earthState(jdTT, accuracy).position;
}

/** Heliocentric Earth position (AU) and analytic velocity (AU/day), J2000 ecliptic. */
export function earthState(jdTT, accuracy = 'accurate') {
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  return earthModel.accuracyState(jdTT, positionAccuracy(accuracy));
}

/** Heliocentric Earth unit direction and angular velocity; skips the radius series. */
export function earthDirectionState(jdTT, accuracy = 'accurate') {
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  return earthModel.accuracyDirection(jdTT, positionAccuracy(accuracy));
}

/** Heliocentric Earth-Moon barycentre, J2000 mean ecliptic/equinox, AU. */
export function embPosition(jdTT, accuracy = 'accurate') {
  return embState(jdTT, accuracy).position;
}

export function embState(jdTT, accuracy = 'accurate') {
  const earth = earthState(jdTT, accuracy);
  const moon = moonState(jdTT, accuracy);
  const factor = 1 / ((1 + EARTH_MOON_MASS_RATIO) * AU_KM);
  return {
    position: earth.position.map((value, index) => value + moon.position[index] * factor),
    velocity: earth.velocity.map((value, index) => value + moon.velocity[index] * factor),
  };
}

/** Explicit alias: heliocentric Earth, J2000 ecliptic, AU and AU/day. */
export function earthHeliocentricState(jdTT, accuracy = 'accurate') {
  return earthState(jdTT, accuracy);
}

export function earthHeliocentricPosition(jdTT, accuracy = 'accurate') {
  return earthHeliocentricState(jdTT, accuracy).position;
}

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
    .accuracyState(jdTT, positionAccuracy(accuracy));
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

/** Geometric geocentric Sun, J2000 ecliptic, AU and AU/day. */
export function sunGeocentricState(jdTT, accuracy = 'accurate') {
  const earth = earthState(jdTT, accuracy);
  return {
    position: earth.position.map(value => -value),
    velocity: earth.velocity.map(value => -value),
  };
}

export function sunGeocentricPosition(jdTT, accuracy = 'accurate') {
  return sunGeocentricState(jdTT, accuracy).position;
}

/** Explicit alias: geocentric Moon, J2000 ecliptic, km and km/day. */
export function moonGeocentricState(jdTT, accuracy = 'accurate') {
  return moonState(jdTT, accuracy);
}

export function moonGeocentricPosition(jdTT, accuracy = 'accurate') {
  return moonGeocentricState(jdTT, accuracy).position;
}

/** Heliocentric Moon, J2000 ecliptic, AU and AU/day. */
export function moonHeliocentricState(jdTT, accuracy = 'accurate') {
  const earth = earthState(jdTT, accuracy);
  const moon = moonState(jdTT, accuracy);
  return {
    position: earth.position.map((value, index) => value + moon.position[index] / AU_KM),
    velocity: earth.velocity.map((value, index) => value + moon.velocity[index] / AU_KM),
  };
}

export function moonHeliocentricPosition(jdTT, accuracy = 'accurate') {
  return moonHeliocentricState(jdTT, accuracy).position;
}

/** Explicit alias: heliocentric Earth-Moon barycentre, J2000 ecliptic, AU and AU/day. */
export function embHeliocentricState(jdTT, accuracy = 'accurate') {
  return embState(jdTT, accuracy);
}

export function embHeliocentricPosition(jdTT, accuracy = 'accurate') {
  return embHeliocentricState(jdTT, accuracy).position;
}

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

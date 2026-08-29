import { moonState, moonPosition, moonDirectionState, moonElpLongitudeState } from './moon-model.js';
export { moonState, moonPosition, moonDirectionState, moonElpLongitudeState };
import { earthModel, planetModels } from './planet-models.js';
import { plutoModel } from './pluto-model.js';
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
export function earthPosition(jdTT) {
  return earthState(jdTT).position;
}

/** Heliocentric Earth position (AU) and analytic velocity (AU/day), J2000 ecliptic. */
export function earthState(jdTT) {
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  return earthModel.state(jdTT);
}

/** Heliocentric Earth unit direction and angular velocity; skips the radius series. */
export function earthDirectionState(jdTT) {
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  return earthModel.direction(jdTT);
}

/** Heliocentric Earth-Moon barycentre, J2000 mean ecliptic/equinox, AU. */
export function embPosition(jdTT) {
  return embState(jdTT).position;
}

export function embState(jdTT) {
  const earth = earthState(jdTT);
  const moon = moonState(jdTT);
  const factor = 1 / ((1 + EARTH_MOON_MASS_RATIO) * AU_KM);
  return {
    position: earth.position.map((value, index) => value + moon.position[index] * factor),
    velocity: earth.velocity.map((value, index) => value + moon.velocity[index] * factor),
  };
}

/** Explicit alias: heliocentric Earth, J2000 ecliptic, AU and AU/day. */
export function earthHeliocentricState(jdTT) {
  return earthState(jdTT);
}

export function earthHeliocentricPosition(jdTT) {
  return earthHeliocentricState(jdTT).position;
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
export function planetHeliocentricState(planet, jdTT) {
  assertPlanet(planet);
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  return (planet === PLANET.PLUTO ? plutoModel : planetModels[planet]).state(jdTT);
}

export function planetHeliocentricPosition(planet, jdTT) {
  return planetHeliocentricState(planet, jdTT).position;
}

/** Geometric geocentric planet state; light time and aberration are not applied. */
export function planetGeocentricState(planet, jdTT) {
  const target = planetHeliocentricState(planet, jdTT);
  const earth = earthHeliocentricState(jdTT);
  return {
    position: target.position.map((value, index) => value - earth.position[index]),
    velocity: target.velocity.map((value, index) => value - earth.velocity[index]),
  };
}

export function planetGeocentricPosition(planet, jdTT) {
  return planetGeocentricState(planet, jdTT).position;
}

export const mercuryHeliocentricState = (jdTT) => (
  planetHeliocentricState(PLANET.MERCURY, jdTT)
);
export const mercuryHeliocentricPosition = (jdTT) => (
  mercuryHeliocentricState(jdTT).position
);
export const venusHeliocentricState = (jdTT) => (
  planetHeliocentricState(PLANET.VENUS, jdTT)
);
export const venusHeliocentricPosition = (jdTT) => (
  venusHeliocentricState(jdTT).position
);
export const marsHeliocentricState = (jdTT) => (
  planetHeliocentricState(PLANET.MARS, jdTT)
);
export const marsHeliocentricPosition = (jdTT) => (
  marsHeliocentricState(jdTT).position
);
export const jupiterHeliocentricState = (jdTT) => (
  planetHeliocentricState(PLANET.JUPITER, jdTT)
);
export const jupiterHeliocentricPosition = (jdTT) => (
  jupiterHeliocentricState(jdTT).position
);
export const saturnHeliocentricState = (jdTT) => (
  planetHeliocentricState(PLANET.SATURN, jdTT)
);
export const saturnHeliocentricPosition = (jdTT) => (
  saturnHeliocentricState(jdTT).position
);
export const uranusHeliocentricState = (jdTT) => (
  planetHeliocentricState(PLANET.URANUS, jdTT)
);
export const uranusHeliocentricPosition = (jdTT) => (
  uranusHeliocentricState(jdTT).position
);
export const neptuneHeliocentricState = (jdTT) => (
  planetHeliocentricState(PLANET.NEPTUNE, jdTT)
);
export const neptuneHeliocentricPosition = (jdTT) => (
  neptuneHeliocentricState(jdTT).position
);

/** WARNING: outside 1600..2200 Pluto uses a coarse fallback, not a precision ephemeris. */
export const plutoHeliocentricState = (jdTT) => (
  planetHeliocentricState(PLANET.PLUTO, jdTT)
);
/** WARNING: outside 1600..2200 Pluto remains computable but is low accuracy. */
export const plutoHeliocentricPosition = (jdTT) => (
  plutoHeliocentricState(jdTT).position
);

/** Geometric geocentric Sun, J2000 ecliptic, AU and AU/day. */
export function sunGeocentricState(jdTT) {
  const earth = earthState(jdTT);
  return {
    position: earth.position.map(value => -value),
    velocity: earth.velocity.map(value => -value),
  };
}

export function sunGeocentricPosition(jdTT) {
  return sunGeocentricState(jdTT).position;
}

/** Explicit alias: geocentric Moon, J2000 ecliptic, km and km/day. */
export function moonGeocentricState(jdTT) {
  return moonState(jdTT);
}

export function moonGeocentricPosition(jdTT) {
  return moonGeocentricState(jdTT).position;
}

/** Heliocentric Moon, J2000 ecliptic, AU and AU/day. */
export function moonHeliocentricState(jdTT) {
  const earth = earthState(jdTT);
  const moon = moonState(jdTT);
  return {
    position: earth.position.map((value, index) => value + moon.position[index] / AU_KM),
    velocity: earth.velocity.map((value, index) => value + moon.velocity[index] / AU_KM),
  };
}

export function moonHeliocentricPosition(jdTT) {
  return moonHeliocentricState(jdTT).position;
}

/** Explicit alias: heliocentric Earth-Moon barycentre, J2000 ecliptic, AU and AU/day. */
export function embHeliocentricState(jdTT) {
  return embState(jdTT);
}

export function embHeliocentricPosition(jdTT) {
  return embHeliocentricState(jdTT).position;
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

import { moonState, moonPosition, moonDirectionState, moonElpLongitudeState } from './moon-model.js';
export { moonState, moonPosition, moonDirectionState, moonElpLongitudeState };
import { earthModel } from './earth-model.js';
import { checkedAccuracy } from './accuracy.js';
import {
  J2000,
  iau2000bNutation,
  vondrak2011PrecessionMatrix,
} from './coordinates.js';

export { J2000, iau2000bNutation, vondrak2011PrecessionMatrix };

export const AU_KM = 149597870.7;
export const EARTH_MOON_MASS_RATIO = 81.30056822149722;
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


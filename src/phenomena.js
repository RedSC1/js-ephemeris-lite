import { AU_KM } from './ephemeris.js';
import { apparentBodyPosition, apparentGeometry } from './apparent.js';
import { RAD, clamp, dot, normDeg, unit } from './sky-math.js';

// Conventional apparent-disc radii, matching the C++ phenomena contract.
export const BODY_DISC_RADIUS_KM = Object.freeze({
  sun: 696000, moon: 1737.5, mercury: 2439.4, venus: 6051.8, mars: 3389.5,
  jupiter: 69911, saturn: 58232, uranus: 25362, neptune: 24622,
  // JPL mean radius: https://ssd.jpl.nasa.gov/planets/phys_par.html
  // Approximate disc only: the ephemeris follows the Pluto-system barycenter.
  pluto: 1188.3,
});

/** Geocentric physical geometry. No empirical magnitude model is implied. */
export function bodyPhenomena(body, jdTT, options = {}) {
  const geometry = apparentGeometry(body, jdTT, options);
  const position = apparentBodyPosition(body, jdTT, options);
  const sun = body === 'sun' ? position : apparentBodyPosition('sun', jdTT, options);
  const elongationDeg = body === 'sun' ? 0 : Math.acos(clamp(dot(
    unit(position.equatorialPositionAu), unit(sun.equatorialPositionAu),
  ))) * RAD;
  // At the target: target->Sun and target->observer. Negating both vectors
  // leaves the dot product unchanged; this is NOT simply 180 - elongation.
  const phaseCos = body === 'sun' ? null
    : clamp(dot(unit(geometry.target), unit(geometry.astrometric)));
  return {
    body, jdTT, distanceAu: position.distanceAu,
    phaseAngleDeg: phaseCos === null ? null : Math.acos(phaseCos) * RAD,
    illuminatedFraction: phaseCos === null ? null : (1 + phaseCos) / 2,
    solarElongationDeg: elongationDeg,
    apparentDiameterArcsec: 2 * Math.asin(clamp(
      BODY_DISC_RADIUS_KM[body] / AU_KM / position.distanceAu,
    )) * RAD * 3600,
    horizontalParallaxDeg: Math.asin(clamp(6378.137 / AU_KM / position.distanceAu)) * RAD,
  };
}

export function moonIllumination(jdTT, options = {}) {
  const result = bodyPhenomena('moon', jdTT, options);
  // Waxing/waning is a date-frame convention, independent of output axes.
  const dateOptions = { ...options, frame: 'true-of-date' };
  const moon = apparentBodyPosition('moon', jdTT, dateOptions);
  const sun = apparentBodyPosition('sun', jdTT, dateOptions);
  const phaseCycle = normDeg(moon.longitudeDeg - sun.longitudeDeg) / 360;
  return { ...result, phaseCycle, waxing: phaseCycle < 0.5 };
}

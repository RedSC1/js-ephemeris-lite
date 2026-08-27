import {
  AU_KM, earthHeliocentricState, moonGeocentricState, planetHeliocentricState,
} from './ephemeris.js';
import { ARCSEC_TO_RAD, iau2000bNutation, meanEclipticOfDateMatrixState } from './coordinates.js';
import { greenwichApparentSiderealTimeRadians } from './solar-core.js';
import { ut1ToTt } from './time.js';
import {
  RAD, add, cross, dot, finite, normDeg, rotateX, rotateZ, scale, signedDeg,
  spherical, sub, transform, unit,
} from './sky-math.js';

export const SKY_BODIES = Object.freeze([
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
]);
export const LIGHT_TIME_DAYS_PER_AU = AU_KM / 299792.458 / 86400;
const RATE_STEP_DAYS = 0.0005;
export const SKY_FRAME = Object.freeze({
  J2000: 'j2000', MEAN_OF_DATE: 'mean-of-date', TRUE_OF_DATE: 'true-of-date',
});

export function validateSkyBody(body) {
  if (!SKY_BODIES.includes(body)) throw new RangeError(`unsupported sky body: ${body}`);
}

// All states here are heliocentric J2000 ecliptic, AU and AU/day. Never feed
// the native km-valued geocentric lunar state into a planetary correction.
function heliocentricState(body, jdTT, options) {
  if (body === 'sun') return { position: [0, 0, 0], velocity: [0, 0, 0] };
  if (body === 'moon') {
    const earth = earthHeliocentricState(jdTT, options);
    const moon = moonGeocentricState(jdTT, options);
    return {
      position: add(earth.position, scale(moon.position, 1 / AU_KM)),
      velocity: add(earth.velocity, scale(moon.velocity, 1 / AU_KM)),
    };
  }
  return planetHeliocentricState(body, jdTT, options);
}

function aberrate(position, observerVelocity) {
  const distance = Math.hypot(...position);
  const p = scale(position, 1 / distance);
  const beta = scale(observerVelocity, LIGHT_TIME_DAYS_PER_AU);
  const inverseGamma = Math.sqrt(1 - dot(beta, beta));
  const product = dot(p, beta);
  const direction = add(scale(p, inverseGamma), scale(beta, 1 + product / (1 + inverseGamma)));
  return scale(unit(direction), distance);
}

function solarDeflection(position, earth, target) {
  const distance = Math.hypot(...position), em = Math.hypot(...earth);
  const p = unit(position), e = unit(earth), q = unit(target);
  // Finite-distance solar deflection, limited at the solar limb. No attempt
  // is made to model rays through the opaque Sun, or other deflecting bodies.
  const limb = 695700 / AU_KM / em;
  const denominator = Math.max(1 + dot(q, e), limb * limb / 2);
  const weight = 1.97412574336e-8 / em / denominator;
  return scale(unit(add(p, scale(cross(p, cross(e, q)), weight))), distance);
}

/** Low-level internal geometry also used for physical illumination. */
export function apparentGeometry(body, jdTT, options = {}) {
  validateSkyBody(body);
  finite(jdTT, 'jdTT');
  const frame = options.frame ?? SKY_FRAME.TRUE_OF_DATE;
  if (!Object.values(SKY_FRAME).includes(frame)) throw new RangeError(`unsupported sky frame: ${frame}`);
  const earth = earthHeliocentricState(jdTT, options);
  let target = heliocentricState(body, jdTT, options);
  let position = sub(target.position, earth.position);
  let lightTimeDays = 0;
  if (options.lightTime !== false) {
    let converged = false;
    for (let i = 0; i < 12; i++) {
      const next = Math.hypot(...position) * LIGHT_TIME_DAYS_PER_AU;
      const change = Math.abs(next - lightTimeDays);
      lightTimeDays = next;
      const emissionTime = jdTT - lightTimeDays;
      target = heliocentricState(body, emissionTime, options);
      // JD loses ~40 microseconds when a tiny light-time is subtracted from
      // a modern epoch. Restore the rounded-away fraction with the analytic
      // velocity. Otherwise lunar rates amplify Earth's quantized motion.
      const remainderDays = (jdTT - emissionTime) - lightTimeDays;
      target = { ...target, position: add(target.position, scale(target.velocity, remainderDays)) };
      position = sub(target.position, earth.position);
      if (change < 1e-11) { converged = true; break; }
    }
    if (!converged) throw new RangeError('light-time iteration did not converge');
  }
  const astrometric = position;
  if (body !== 'sun' && options.solarDeflection !== false) {
    position = solarDeflection(position, earth.position, target.position);
  }
  if (options.aberration !== false) position = aberrate(position, earth.velocity);
  const nutation = iau2000bNutation(jdTT);
  // Physical corrections above are independent of the requested reference
  // axes. J2000 means the fixed mean J2000 ecliptic/equinox, NOT ICRS axes.
  let ecliptic = position;
  let obliquity = 84381.406 * ARCSEC_TO_RAD;
  if (frame !== SKY_FRAME.J2000) {
    ecliptic = transform(meanEclipticOfDateMatrixState(jdTT).matrix, position);
    obliquity = nutation.meanObliquity;
    if (frame === SKY_FRAME.TRUE_OF_DATE) {
      ecliptic = rotateZ(ecliptic, nutation.dpsi);
      obliquity = nutation.trueObliquity;
    }
  }
  return {
    earth: earth.position, target: target.position, astrometric,
    ecliptic, equatorial: rotateX(ecliptic, obliquity), lightTimeDays, nutation, frame,
  };
}

/** Geocentric, explicitly selected axes (default true of date). Input JD(TT). */
export function apparentBodyPosition(body, jdTT, options = {}) {
  const g = apparentGeometry(body, jdTT, options);
  const eq = spherical(g.equatorial);
  return {
    body, jdTT, frame: g.frame, ...spherical(g.ecliptic), rightAscensionDeg: eq.longitudeDeg,
    declinationDeg: eq.latitudeDeg, lightTimeDays: g.lightTimeDays,
    eclipticPositionAu: g.ecliptic, equatorialPositionAu: g.equatorial,
  };
}

/** Rates differentiate the complete light-time + correction + frame chain. */
export function apparentBodyState(body, jdTT, options = {}) {
  const current = apparentBodyPosition(body, jdTT, options);
  const before = apparentBodyPosition(body, jdTT - RATE_STEP_DAYS, options);
  const after = apparentBodyPosition(body, jdTT + RATE_STEP_DAYS, options);
  const dt = (jdTT + RATE_STEP_DAYS) - (jdTT - RATE_STEP_DAYS);
  return {
    ...current,
    longitudeSpeedDegPerDay: signedDeg(after.longitudeDeg - before.longitudeDeg) / dt,
    latitudeSpeedDegPerDay: (after.latitudeDeg - before.latitudeDeg) / dt,
    rightAscensionSpeedDegPerDay: signedDeg(after.rightAscensionDeg - before.rightAscensionDeg) / dt,
    declinationSpeedDegPerDay: (after.declinationDeg - before.declinationDeg) / dt,
    distanceSpeedAuPerDay: (after.distanceAu - before.distanceAu) / dt,
    eclipticVelocityAuPerDay: scale(sub(after.eclipticPositionAu, before.eclipticPositionAu), 1 / dt),
    equatorialVelocityAuPerDay: scale(sub(after.equatorialPositionAu, before.equatorialPositionAu), 1 / dt),
  };
}

/** GAST, degrees. UT1 controls rotation; TT controls precession/nutation. */
export function greenwichSiderealTime(jdUT1, jdTT = ut1ToTt(jdUT1)) {
  finite(jdUT1, 'jdUT1'); finite(jdTT, 'jdTT');
  return normDeg(greenwichApparentSiderealTimeRadians(jdUT1, jdTT, iau2000bNutation(jdTT)) * RAD);
}

export const APPARENT_MODEL_INFO = Object.freeze({
  inputTimeScale: 'TT', angularUnit: 'degree', distanceUnit: 'AU',
  defaultFrame: 'true-of-date',
  frames: 'j2000 / mean-of-date / true-of-date; J2000 is mean, not ICRS',
  lightTime: 'iterated heliocentric, TT used as TDB approximation',
  aberration: 'special-relativistic, heliocentric Earth velocity',
  deflection: 'Sun only, finite-distance, solar-limb limited',
  shapiroDelay: false,
  rates: 'central difference of complete apparent position, 0.0005 day half-step',
  limitations: 'No barycentric solar reflex, EOP, multi-body deflection or planetary satellite photocentres; not a replacement for the full C++/DE441 pipeline.',
});

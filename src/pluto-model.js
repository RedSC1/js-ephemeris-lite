import { createDirectPlanetModel, legendreBasis } from './direct-planet-model.js';
import {
  PLUTO_FALLBACK_L, PLUTO_FALLBACK_B, PLUTO_FALLBACK_R,
  PLUTO_FALLBACK_SCALE_DAYS,
  PLUTO_NEAR_L, PLUTO_NEAR_B, PLUTO_NEAR_R,
  PLUTO_NEAR_EPOCH_JD, PLUTO_NEAR_SCALE_DAYS, PLUTO_NEAR_MOTION, PLUTO_NEAR_PHASE,
} from './planet-series.js';
import { planetTheoryToJ2000 } from './planet-frame.js';

const fallback = createDirectPlanetModel(PLUTO_FALLBACK_L, PLUTO_FALLBACK_B, PLUTO_FALLBACK_R, {
  evaluateBasis: legendreBasis,
  scaleDays: PLUTO_FALLBACK_SCALE_DAYS,
});
const YEAR_DAYS = 365.25;

/** Pluto is a separate approximate model, not another TOP2013 giant planet.
 * WARNING: only 1600..2200 is recommended. Other dates still return a coarse
 * fallback; neither broad-range position nor event accuracy is guaranteed.
 * Do not extrapolate the padded near polynomial: it can overflow at remote dates.
 */
export const PLUTO_MODEL_INFO = Object.freeze({
  recommendedIntervalYears: Object.freeze([1600, 2200]),
  modelIntervalYears: Object.freeze([-6000, 10000]),
  transitionIntervalsYears: Object.freeze([Object.freeze([1590, 1600]), Object.freeze([2200, 2210])]),
  positionTarget: 'Pluto-system barycenter',
  warning: 'Outside 1600..2200 results remain computable but are low accuracy, including event times. No accuracy claim outside -6000..10000.',
});

function chebyshev(coefficients, x) {
  let b1 = 0, b2 = 0, d1 = 0, d2 = 0;
  for (let i = coefficients.length - 1; i > 0; i--) {
    const b = 2 * x * b1 - b2 + coefficients[i];
    const d = 2 * b1 + 2 * x * d1 - d2;
    b2 = b1; b1 = b; d2 = d1; d1 = d;
  }
  return [x * b1 - b2 + coefficients[0], (b1 + x * d1 - d2) / PLUTO_NEAR_SCALE_DAYS];
}

function nearState(jd) {
  const x = (jd - PLUTO_NEAR_EPOCH_JD) / PLUTO_NEAR_SCALE_DAYS;
  const [[residual, dl0], [b, db], [r, dr]] = [PLUTO_NEAR_L, PLUTO_NEAR_B, PLUTO_NEAR_R].map(c => chebyshev(c, x));
  const l = residual + PLUTO_NEAR_PHASE + PLUTO_NEAR_MOTION * (jd - 2451545) / 365250;
  const dl = dl0 + PLUTO_NEAR_MOTION / 365250;
  const cl = Math.cos(l), sl = Math.sin(l), cb = Math.cos(b), sb = Math.sin(b);
  const p = [r * cb * cl, r * cb * sl, r * sb];
  const v = [dr * cb * cl - r * sb * db * cl - r * cb * sl * dl,
    dr * cb * sl - r * sb * db * sl + r * cb * cl * dl, dr * sb + r * cb * db];
  return { position: planetTheoryToJ2000(p), velocity: planetTheoryToJ2000(v) };
}

function state(jd) {
  const year = 2000 + (jd - 2451545) / YEAR_DAYS;
  if (year >= 1600 && year <= 2200) return nearState(jd);
  if (year <= 1590 || year >= 2210) return fallback.state(jd);
  const near = nearState(jd), far = fallback.state(jd);
  const x = year < 1600 ? (year - 1590) / 10 : (2210 - year) / 10;
  const weight = x ** 3 * (10 - 15 * x + 6 * x * x);
  const rate = 30 * x * x * (1 - x) ** 2 * (year < 1600 ? 1 : -1) / (10 * YEAR_DAYS);
  return {
    position: far.position.map((p, k) => p + weight * (near.position[k] - p)),
    velocity: far.velocity.map((v, k) => v + weight * (near.velocity[k] - v)
      + rate * (near.position[k] - far.position[k])),
  };
}

export const plutoModel = { state };

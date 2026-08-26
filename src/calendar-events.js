import { MODEL_DATA } from './generated/model-data.js';
import {
  J2000,
  ARCSEC_TO_RAD,
  iau2000bNutationState,
  meanEclipticOfDateMatrixState,
} from './coordinates.js';
import {
  earthState,
  earthDirectionState,
  moonDirectionState,
  earthLongitudeCorrectionState,
  moonCorrectionState,
} from './ephemeris.js';
import { deltaTSecondsFromTt, ttToUt1 } from './time.js';

const TWO_PI = 2 * Math.PI;
const DAYS_PER_CENTURY = 36525;
const DAYS_PER_MILLENNIUM = 365250;
const SOLAR_ABERRATION_RAD = 20.4898 * ARCSEC_TO_RAD;
const LOW_INTERVAL_YEARS = 8000;
export const DEFAULT_NEW_MOON_LATITUDE_TERMS = 10;

// Degree-4 fits of (our full truncated event model - our ten-term estimator)
// over -6000..10000.  They correct only the smooth remainder; periodic error
// is deliberately left for the safeguarded high-model Newton step.
const LOW_SOLAR_DRIFT = [
  -4.821607924844411e-6,
  -1.4864157602346088e-5,
  -3.390496493952741e-6,
  -5.854334434187643e-6,
  -2.8218888064892575e-6,
];
const LOW_ELONGATION_DRIFT = [
  0.015509180385391341,
  1.9506927374030383,
  0.014964740879427018,
  0.00008789228081861969,
  -0.0005320835337382689,
];

function wrapRadians(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function polynomialState(coefficients, x, xRate) {
  let value = 0, derivative = 0;
  for (let i = coefficients.length - 1; i >= 0; i -= 1) {
    derivative = derivative * x + value;
    value = value * x + coefficients[i];
  }
  return { value, rate: derivative * xRate };
}

function chebyshevState(coefficients, x, xRate) {
  if (coefficients.length === 0) return { value: 0, rate: 0 };
  if (coefficients.length === 1) return { value: coefficients[0], rate: 0 };
  let t0 = 1, t1 = x, d0 = 0, d1 = 1;
  let value = coefficients[0] + coefficients[1] * t1;
  let derivative = coefficients[1];
  for (let n = 2; n < coefficients.length; n += 1) {
    const tn = 2 * x * t1 - t0;
    const dn = 2 * t1 + 2 * x * d1 - d0;
    value += coefficients[n] * tn;
    derivative += coefficients[n] * dn;
    t0 = t1; t1 = tn; d0 = d1; d1 = dn;
  }
  return { value, rate: derivative * xRate };
}

function phaseState(term, time, timeRate) {
  let value = term[5];
  let derivative = 0;
  for (let index = 4; index >= 1; index -= 1) {
    derivative = derivative * time + value;
    value = value * time + term[index];
  }
  return { value, rate: derivative * timeRate };
}

function applyMatrix(matrix, vector) {
  return matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
}

function transformState(frame, state) {
  const position = applyMatrix(frame.matrix, state.position);
  const frameVelocity = applyMatrix(frame.rate, state.position);
  const velocity = applyMatrix(frame.matrix, state.velocity).map((value, index) => value + frameVelocity[index]);
  return { position, velocity };
}

function longitudeState(state) {
  const [x, y] = state.position;
  const [vx, vy] = state.velocity;
  return { value: Math.atan2(y, x), rate: (x * vy - y * vx) / (x * x + y * y) };
}

function normState(state) {
  const radius = Math.hypot(...state.position);
  return {
    value: radius,
    rate: state.position.reduce((sum, value, index) => sum + value * state.velocity[index], 0) / radius,
  };
}

function rankEnvelopeTerms(blocks, maximumTime) {
  return blocks.flatMap((terms, power) => terms.map((term, serial) => ({
    term,
    power,
    serial,
    score: Math.abs(term[0]) * maximumTime ** power,
  }))).sort((a, b) => b.score - a.score || a.power - b.power || a.serial - b.serial);
}

// Counts are our own low-model choice. Selection uses the maximum contribution
// over -6000..10000, so high-order Poisson terms are not silently discarded.
const LOW_EARTH_LONGITUDE_CANDIDATES = rankEnvelopeTerms(MODEL_DATA.vsopEarth[0], 8);
const LOW_MOON_LONGITUDE_CANDIDATES = rankEnvelopeTerms(MODEL_DATA.elp.terms[0], 80);
const LOW_EARTH_RADIUS_TERMS = rankEnvelopeTerms(MODEL_DATA.vsopEarth[2], 8).slice(0, 3);
const FAST_EARTH_RADIUS_TERMS = rankEnvelopeTerms(MODEL_DATA.vsopEarth[2], 8).slice(0, 30);

function lowVsopCoordinateState(terms, tau, tauRate) {
  let value = 0, rate = 0;
  for (const { term: [amplitude, phase, frequency], power } of terms) {
    const argument = phase + frequency * tau;
    const envelope = tau ** power;
    const envelopeRate = power === 0 ? 0 : power * tau ** (power - 1) * tauRate;
    value += amplitude * envelope * Math.cos(argument);
    rate += amplitude * (envelopeRate * Math.cos(argument) - envelope * Math.sin(argument) * frequency * tauRate);
  }
  return { value, rate };
}

function lowElpLongitudeState(jdTT, termCount) {
  const t = (jdTT - J2000) / DAYS_PER_CENTURY;
  const tRate = 1 / DAYS_PER_CENTURY;
  const mean = polynomialState(MODEL_DATA.elp.w1, t, tRate);
  const correction = moonCorrectionState(jdTT);
  let periodic = 0, periodicRate = 0;
  for (const { term, power } of LOW_MOON_LONGITUDE_CANDIDATES.slice(0, termCount)) {
    const argument = phaseState(term, t, tRate);
    for (let index = 0; index < 4; index += 1) {
      argument.value += term[6 + index] * correction.shifts[index].value;
      argument.rate += term[6 + index] * correction.shifts[index].rate;
    }
    const envelope = t ** power;
    const envelopeRate = power === 0 ? 0 : power * t ** (power - 1) * tRate;
    periodic += term[0] * envelope * Math.sin(argument.value);
    periodicRate += term[0] * (envelopeRate * Math.sin(argument.value)
      + envelope * Math.cos(argument.value) * argument.rate);
  }
  return {
    value: mean.value + periodic * ARCSEC_TO_RAD + correction.rotation.value,
    rate: mean.rate + periodicRate * ARCSEC_TO_RAD + correction.rotation.rate,
  };
}

function lowDriftState(coefficients, jdTT) {
  const x = (jdTT - J2000) / (LOW_INTERVAL_YEARS * 365.25);
  return chebyshevState(coefficients, x, 1 / (LOW_INTERVAL_YEARS * 365.25));
}

/** Full truncated-model apparent geocentric solar longitude and analytic rate. */
export function solarLongitudeState(jdTT) {
  const earth = earthState(jdTT);
  const sun = {
    position: earth.position.map(value => -value),
    velocity: earth.velocity.map(value => -value),
  };
  const date = transformState(meanEclipticOfDateMatrixState(jdTT), sun);
  const longitude = longitudeState(date);
  const nutation = iau2000bNutationState(jdTT);
  const radius = normState(earth);
  return {
    value: longitude.value + nutation.dpsi - SOLAR_ABERRATION_RAD / radius.value,
    rate: longitude.rate + nutation.dpsiRate + SOLAR_ABERRATION_RAD * radius.rate / (radius.value * radius.value),
  };
}

/** Full truncated-model apparent lunar longitude and analytic rate. */
export function moonLongitudeState(jdTT, { latitudeTerms = 'full' } = {}) {
  const date = transformState(
    meanEclipticOfDateMatrixState(jdTT),
    moonDirectionState(jdTT, { latitudeTerms }),
  );
  const longitude = longitudeState(date);
  const nutation = iau2000bNutationState(jdTT);
  return { value: longitude.value + nutation.dpsi, rate: longitude.rate + nutation.dpsiRate };
}

export function elongationState(jdTT, { moonLatitudeTerms = 'full' } = {}) {
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  const frame = meanEclipticOfDateMatrixState(jdTT);
  const moon = longitudeState(transformState(
    frame,
    moonDirectionState(jdTT, { latitudeTerms: moonLatitudeTerms }),
  ));
  const earth = earthState(jdTT);
  const sun = longitudeState(transformState(frame, {
    position: earth.position.map(value => -value),
    velocity: earth.velocity.map(value => -value),
  }));
  const radius = normState(earth);
  // Nutation in longitude is common to the apparent Moon and Sun and cancels
  // exactly in their elongation.  Computing it twice was pure event-path work.
  const aberration = SOLAR_ABERRATION_RAD / radius.value;
  return {
    value: wrapRadians(moon.value - sun.value + aberration),
    rate: moon.rate - sun.rate - SOLAR_ABERRATION_RAD * radius.rate / (radius.value * radius.value),
  };
}

function fastElongationState(jdTT, moonLatitudeTerms) {
  const frame = meanEclipticOfDateMatrixState(jdTT);
  const moon = longitudeState(transformState(
    frame,
    moonDirectionState(jdTT, { latitudeTerms: moonLatitudeTerms }),
  ));
  const earth = earthDirectionState(jdTT);
  const sun = longitudeState(transformState(frame, {
    position: earth.position.map(value => -value),
    velocity: earth.velocity.map(value => -value),
  }));
  const tau = (jdTT - J2000) / DAYS_PER_MILLENNIUM;
  const radius = lowVsopCoordinateState(FAST_EARTH_RADIUS_TERMS, tau, 1 / DAYS_PER_MILLENNIUM);
  return {
    value: wrapRadians(moon.value - sun.value + SOLAR_ABERRATION_RAD / radius.value),
    rate: moon.rate - sun.rate - SOLAR_ABERRATION_RAD * radius.rate / (radius.value * radius.value),
  };
}

/** Independent ten-term solar estimator; intended only to locate a root. */
export function lowSolarLongitudeState(jdTT, { withDrift = true, termCount = 10 } = {}) {
  const tau = (jdTT - J2000) / DAYS_PER_MILLENNIUM;
  const tauRate = 1 / DAYS_PER_MILLENNIUM;
  const longitude = lowVsopCoordinateState(LOW_EARTH_LONGITUDE_CANDIDATES.slice(0, termCount), tau, tauRate);
  const correction = earthLongitudeCorrectionState(jdTT);
  longitude.value += correction.value + Math.PI;
  longitude.rate += correction.rate;
  const unit = {
    position: [Math.cos(longitude.value), Math.sin(longitude.value), 0],
    velocity: [-Math.sin(longitude.value) * longitude.rate, Math.cos(longitude.value) * longitude.rate, 0],
  };
  const date = longitudeState(transformState(meanEclipticOfDateMatrixState(jdTT), unit));
  const nutation = iau2000bNutationState(jdTT, 10);
  const radius = lowVsopCoordinateState(LOW_EARTH_RADIUS_TERMS, tau, tauRate);
  const drift = withDrift ? lowDriftState(LOW_SOLAR_DRIFT, jdTT) : { value: 0, rate: 0 };
  return {
    value: date.value + nutation.dpsi - SOLAR_ABERRATION_RAD / radius.value + drift.value,
    rate: date.rate + nutation.dpsiRate + SOLAR_ABERRATION_RAD * radius.rate / (radius.value ** 2) + drift.rate,
  };
}

/** Independent ten-term lunar-solar elongation estimator. */
export function lowElongationState(jdTT, { withDrift = true, moonTermCount = 10, earthTermCount = 10 } = {}) {
  const moon = lowElpLongitudeState(jdTT, moonTermCount);
  // The elongation fit was trained against the complete no-drift low
  // elongation, so do not also inject the separate solar-only fit here.
  const sun = lowSolarLongitudeState(jdTT, { withDrift: false, termCount: earthTermCount });
  const drift = withDrift ? lowDriftState(LOW_ELONGATION_DRIFT, jdTT) : { value: 0, rate: 0 };
  return { value: wrapRadians(moon.value - sun.value + drift.value), rate: moon.rate - sun.rate + drift.rate };
}

function estimateRoot(evaluator, target, nearJdTT, iterations = 2) {
  let jd = nearJdTT;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const state = evaluator(jd);
    jd -= wrapRadians(state.value - target) / state.rate;
  }
  return jd;
}

function solveSafeguarded(evaluator, target, estimate, initialHalfWidth, toleranceSeconds) {
  let halfWidth = initialHalfWidth;
  let left, right, fLeft, fRight;
  for (let expansion = 0; expansion < 6; expansion += 1) {
    left = estimate - halfWidth;
    right = estimate + halfWidth;
    fLeft = wrapRadians(evaluator(left).value - target);
    fRight = wrapRadians(evaluator(right).value - target);
    if (fLeft <= 0 && fRight >= 0) break;
    halfWidth *= 1.8;
  }
  if (!(fLeft <= 0 && fRight >= 0)) throw new RangeError('could not bracket the requested event');

  let jd = Math.max(left, Math.min(right, estimate));
  let usedBisection = false;
  for (let iteration = 1; iteration <= 40; iteration += 1) {
    const state = evaluator(jd);
    const residual = wrapRadians(state.value - target);
    if (Math.abs(residual / state.rate) * 86400 <= toleranceSeconds) {
      return {
        jdTT: jd,
        iterations: iteration,
        usedBisection,
        residualRadians: residual,
        correctionSeconds: (jd - estimate) * 86400,
      };
    }
    if (residual < 0) left = jd; else right = jd;
    const newton = jd - residual / state.rate;
    const next = Number.isFinite(newton) && newton > left && newton < right
      ? newton
      : (usedBisection = true, 0.5 * (left + right));
    if (Math.abs(next - jd) * 86400 <= toleranceSeconds) {
      const finalState = evaluator(next);
      return {
        jdTT: next,
        iterations: iteration,
        usedBisection,
        residualRadians: wrapRadians(finalState.value - target),
        correctionSeconds: (next - estimate) * 86400,
      };
    }
    jd = next;
  }
  throw new RangeError('event root did not converge');
}

function solveFastNewton(evaluator, target, estimate, initialHalfWidth, toleranceSeconds) {
  const left = estimate - initialHalfWidth;
  const right = estimate + initialHalfWidth;
  let jd = estimate;
  for (let iteration = 1; iteration <= 4; iteration += 1) {
    const state = evaluator(jd);
    const residual = wrapRadians(state.value - target);
    const correction = residual / state.rate;
    if (!Number.isFinite(correction) || state.rate <= 0) return null;
    if (Math.abs(correction) * 86400 <= toleranceSeconds) {
      return {
        jdTT: jd,
        iterations: iteration,
        usedBisection: false,
        residualRadians: residual,
        correctionSeconds: (jd - estimate) * 86400,
      };
    }
    const next = jd - correction;
    if (!(next > left && next < right)) return null;
    jd = next;
  }
  return null;
}

function addUt1(result) {
  const deltaTSeconds = deltaTSecondsFromTt(result.jdTT);
  return { ...result, jdUT1: ttToUt1(result.jdTT, deltaTSeconds), deltaTSeconds };
}

/** Nearest occurrence of the requested apparent solar longitude. */
export function solveSolarLongitude(targetLongitude, nearJdTT, { toleranceSeconds = 0.01 } = {}) {
  const target = wrapRadians(targetLongitude);
  const estimate = estimateRoot(lowSolarLongitudeState, target, nearJdTT);
  return addUt1({ estimateJdTT: estimate, ...solveSafeguarded(solarLongitudeState, target, estimate, 3, toleranceSeconds) });
}

/** Nearest occurrence of the requested apparent lunar-solar elongation. */
export function solveLunarPhase(targetElongation, nearJdTT, {
  toleranceSeconds = 0.01,
  moonLatitudeTerms = DEFAULT_NEW_MOON_LATITUDE_TERMS,
  solver = 'auto',
} = {}) {
  if (!Number.isFinite(targetElongation)) throw new TypeError('targetElongation must be finite');
  if (solver !== 'auto' && solver !== 'safeguarded') {
    throw new RangeError("solver must be 'auto' or 'safeguarded'");
  }
  const target = wrapRadians(targetElongation);
  // From an arbitrary date the lunar phase can start almost half a synodic
  // month from its target; a third cheap low-model step removes that curvature.
  const estimate = estimateRoot(lowElongationState, target, nearJdTT, 3);
  const evaluator = jdTT => elongationState(jdTT, { moonLatitudeTerms });
  const fastEvaluator = jdTT => fastElongationState(jdTT, moonLatitudeTerms);
  const root = solver === 'auto'
    ? solveFastNewton(fastEvaluator, target, estimate, 2, toleranceSeconds)
    : null;
  return addUt1({
    estimateJdTT: estimate,
    moonLatitudeTerms,
    ...(root ?? solveSafeguarded(evaluator, target, estimate, 2, toleranceSeconds)),
  });
}

/** Nearest astronomical new moon to nearJdTT. */
export function solveNewMoon(nearJdTT, options = {}) {
  return solveLunarPhase(0, nearJdTT, options);
}

export const LOW_MODEL_INFO = Object.freeze({
  earthLongitudeTerms: LOW_EARTH_LONGITUDE_CANDIDATES.slice(0, 10).map(({ power, serial }) => ({ power, serial })),
  moonLongitudeTerms: LOW_MOON_LONGITUDE_CANDIDATES.slice(0, 10).map(({ power, serial }) => ({ power, serial })),
  earthRadiusTerms: LOW_EARTH_RADIUS_TERMS.map(({ power, serial }) => ({ power, serial })),
  nutationTerms: 10,
});

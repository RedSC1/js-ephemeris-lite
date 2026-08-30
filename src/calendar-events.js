import { earthModel } from './planet-models.js';
import { LOW_SOLAR_DRIFT, LOW_ELONGATION_DRIFT, FAST_EARTH_RADIUS_TERMS } from './event-series.js';
import { MOON_L } from './moon-series.js';
import { moonSeriesLongitudeState } from './moon-model.js';
import {
  J2000,
  ARCSEC_TO_RAD,
  iau2000bNutationState,
  meanEclipticOfDateMatrixState,
} from './coordinates.js';
import {
  earthState,
  moonDirectionState,
} from './ephemeris.js';
import { JulianTime } from './time.js';
import { solarLongitude as solarValue, elongation as phaseValue, lowSolarValue, lowPhaseValue, mediumElongation } from './event-values.js';
import { fastSolarLongitude, fastElongation, wrap as fastWrap } from './event-fast-values.js';
import { apparentBodyState } from './apparent.js';
import { solarRate2, elongationRate2, elongationRefineRate } from './event-rates.js';

const SOLAR_ABERRATION_RAD = 20.4898 * ARCSEC_TO_RAD;
// Geocentric lunar light-time longitude correction.  Its residual variation
// is below about 0.07 arcsecond for calendar work; keeping the conventional
// constant avoids a radius evaluation in every phase-solver iteration.
const LUNAR_LIGHT_TIME_LONGITUDE_RAD = -3.4e-6;
const LOW_INTERVAL_YEARS = 8000;
export const DEFAULT_NEW_MOON_LATITUDE_TERMS = 10;

function checkedEventAccuracy(accuracy) {
  if (accuracy !== 'fast' && accuracy !== 'mid' && accuracy !== 'accurate')
    throw new RangeError("accuracy must be 'fast', 'mid', or 'accurate'");
  return accuracy;
}
// Low-estimator fits include the difference between the native lunar frame
// and the explicit frame-of-date event model. They are not geometric corrections.

function wrapRadians(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
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

function rankEnvelopeTerms(blocks) {
  return blocks.flatMap((terms, power) => Array.from({ length: terms.length / 3 }, (_, serial) => ({
    power, serial, score: Math.hypot(terms[serial * 3], terms[serial * 3 + 1]),
  }))).sort((a, b) => b.score - a.score || a.power - b.power || a.serial - b.serial);
}

// Counts are our own low-model choice. Lunar amplitudes already use x in [-1,1],
// so ranking their envelopes retains the contribution of high-order terms.
const LOW_EARTH_LONGITUDE_CANDIDATES = earthModel.ranked[0];
const LOW_MOON_LONGITUDE_CANDIDATES = rankEnvelopeTerms(MOON_L);
const LOW_EARTH_RADIUS_TERMS = earthModel.ranked[2].slice(0, 3);

function lowDriftState(coefficients, jdTT) {
  const x = (jdTT - J2000) / (LOW_INTERVAL_YEARS * 365.25);
  return chebyshevState(coefficients, x, 1 / (LOW_INTERVAL_YEARS * 365.25));
}

/** Apparent solar longitude and analytic rate; full L/B, 30-term R for aberration. */
export function solarLongitudeState(jdTT) {
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  const earth = earthModel.state(jdTT, { 2: FAST_EARTH_RADIUS_TERMS });
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
  return {
    value: longitude.value + nutation.dpsi + LUNAR_LIGHT_TIME_LONGITUDE_RAD,
    rate: longitude.rate + nutation.dpsiRate,
  };
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
    value: wrapRadians(moon.value - sun.value + LUNAR_LIGHT_TIME_LONGITUDE_RAD + aberration),
    rate: moon.rate - sun.rate - SOLAR_ABERRATION_RAD * radius.rate / (radius.value * radius.value),
  };
}

function fastElongationState(jdTT, moonLatitudeTerms) {
  const frame = meanEclipticOfDateMatrixState(jdTT);
  const moon = longitudeState(transformState(
    frame,
    moonDirectionState(jdTT, { latitudeTerms: moonLatitudeTerms }),
  ));
  // Share the folded basis evaluation while restricting only the radius.
  const earth = earthModel.state(jdTT, { 2: FAST_EARTH_RADIUS_TERMS });
  const sun = longitudeState(transformState(frame, {
    position: earth.position.map(value => -value),
    velocity: earth.velocity.map(value => -value),
  }));
  const radius = normState(earth);
  return {
    value: wrapRadians(moon.value - sun.value
      + LUNAR_LIGHT_TIME_LONGITUDE_RAD + SOLAR_ABERRATION_RAD / radius.value),
    rate: moon.rate - sun.rate - SOLAR_ABERRATION_RAD * radius.rate / (radius.value * radius.value),
  };
}

/** Independent ten-term solar estimator; intended only to locate a root. */
export function lowSolarLongitudeState(jdTT, { withDrift = true, termCount = 10 } = {}) {
  const earth = earthModel.state(jdTT, { 0: termCount, 1: 0, 2: LOW_EARTH_RADIUS_TERMS.length });
  const unit = {
    position: earth.position.map(value => -value),
    velocity: earth.velocity.map(value => -value),
  };
  const date = longitudeState(transformState(meanEclipticOfDateMatrixState(jdTT), unit));
  const nutation = iau2000bNutationState(jdTT, 10);
  const radius = normState(earth);
  const drift = withDrift ? lowDriftState(LOW_SOLAR_DRIFT, jdTT) : { value: 0, rate: 0 };
  return {
    value: date.value + nutation.dpsi - SOLAR_ABERRATION_RAD / radius.value + drift.value,
    rate: date.rate + nutation.dpsiRate + SOLAR_ABERRATION_RAD * radius.rate / (radius.value ** 2) + drift.rate,
  };
}

/** Independent ten-term lunar-solar elongation estimator. */
export function lowElongationState(jdTT, { withDrift = true, moonTermCount = 10, earthTermCount = 10 } = {}) {
  const moon = moonSeriesLongitudeState(jdTT, moonTermCount);
  // The elongation fit was trained against the complete no-drift low
  // elongation, so do not also inject the separate solar-only fit here.
  const sun = lowSolarLongitudeState(jdTT, { withDrift: false, termCount: earthTermCount });
  const drift = withDrift ? lowDriftState(LOW_ELONGATION_DRIFT, jdTT) : { value: 0, rate: 0 };
  return {
    value: wrapRadians(moon.value - sun.value + LUNAR_LIGHT_TIME_LONGITUDE_RAD + drift.value),
    rate: moon.rate - sun.rate + drift.rate,
  };
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
  for (let iteration = 1; iteration <= 40; iteration += 1) {
    const state = evaluator(jd);
    const residual = wrapRadians(state.value - target);
    if (Math.abs(residual / state.rate) * 86400 <= toleranceSeconds) {
      return { jdTT: jd };
    }
    if (residual < 0) left = jd; else right = jd;
    const newton = jd - residual / state.rate;
    const next = Number.isFinite(newton) && newton > left && newton < right
      ? newton
      : 0.5 * (left + right);
    if (Math.abs(next - jd) * 86400 <= toleranceSeconds) {
      return { jdTT: next };
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
      return { jdTT: jd };
    }
    const next = jd - correction;
    if (!(next > left && next < right)) return null;
    jd = next;
  }
  return null;
}

function addUt1(result) {
  return JulianTime.fromTT(result.jdTT);
}

// Position-only iterations. The low analytic rates propose Newton steps and
// the returned point is evaluated again; it is never an unchecked correction.
// Use a 2x margin for the empirically validated approximate rates; this is not
// a formal global rate bound. Solar roots use a tighter convergence threshold,
// including on the exact-state fallback.
// Outside the fitted interval, at cycle boundaries, and below JD resolution,
// retain the original exact-state solver. Public state APIs stay analytic.
function trySimpleEvent(target, nearJdTT, toleranceSeconds, lunar, moonLatitudeTerms) {
  if (!Number.isFinite(nearJdTT) || !(toleranceSeconds > 0) || !Number.isFinite(toleranceSeconds)
    || Math.abs(nearJdTT - J2000) > 2922000
    || toleranceSeconds < 2 * Number.EPSILON * Math.abs(nearJdTT) * 86400) return null;
  if (lunar && moonLatitudeTerms !== 'full'
    && (!Number.isInteger(moonLatitudeTerms) || moonLatitudeTerms < 0 || moonLatitudeTerms > 277)) return null;
  const rate = lunar ? elongationRate2 : solarRate2;
  const low = lunar ? lowPhaseValue : lowSolarValue;
  let jd = nearJdTT;
  for (let i = 0; i < 2; i++) {
    if (!Number.isFinite(jd) || Math.abs(jd - J2000) > 2922000) return null;
    const residual = wrapRadians(low(jd) - target);
    if (i === 0 && Math.abs(residual) > Math.PI - 0.1) return null;
    jd -= residual / rate(jd);
  }
  const estimateJdTT = jd, halfWidth = lunar ? 2 : 3;
  let phaseVelocity;
  if (lunar) {
    if (!Number.isFinite(jd) || Math.abs(jd - J2000) > 2922000) return null;
    const middle = mediumElongation(jd, moonLatitudeTerms, 60, 60);
    jd -= wrapRadians(middle - target) / rate(jd);
    if (!Number.isFinite(jd) || Math.abs(jd - J2000) > 2922000) return null;
    // Reuse a better approximate slope only for this local correction loop.
    // Acceptance still evaluates the full event longitude at the returned JD.
    phaseVelocity = elongationRefineRate(jd);
  }
  for (let iteration = 1; iteration <= 5; iteration++) {
    if (!Number.isFinite(jd) || Math.abs(jd - estimateJdTT) > halfWidth
      || Math.abs(jd - J2000) > 2922000) return null;
    const value = lunar ? phaseValue(jd, moonLatitudeTerms, true) : solarValue(jd, true);
    const residual = wrapRadians(value - target), velocity = phaseVelocity ?? rate(jd), step = residual / velocity;
    if (!Number.isFinite(step) || velocity <= 0) return null;
    if (Math.abs(step) * 86400 <= toleranceSeconds * 0.5) {
      return { jdTT: jd };
    }
    const next = jd - step;
    if (next === jd) return null;
    jd = next;
  }
  return null;
}

/** Nearest occurrence of the requested apparent solar longitude. */
function solveSolarLongitudeMid(targetLongitude, nearJdTT, {
  toleranceSeconds = 0.01,
  solver = 'auto',
} = {}) {
  if (!Number.isFinite(targetLongitude)) throw new TypeError('targetLongitude must be finite');
  if (solver !== 'auto' && solver !== 'safeguarded') {
    throw new RangeError("solver must be 'auto' or 'safeguarded'");
  }
  const target = wrapRadians(targetLongitude);
  const convergenceSeconds = solver === 'auto' ? Math.min(toleranceSeconds, 0.001) : toleranceSeconds;
  const simple = solver === 'auto' ? trySimpleEvent(target, nearJdTT, convergenceSeconds, false, undefined) : null;
  if (simple) return addUt1(simple);
  const estimate = estimateRoot(lowSolarLongitudeState, target, nearJdTT);
  // The same event longitude and rate also verify convergence. Only bracket setup
  // is skipped on the fast path; the physical model and tolerance are unchanged.
  const root = solver === 'auto'
    ? solveFastNewton(solarLongitudeState, target, estimate, 3, convergenceSeconds)
    : null;
  return addUt1(root ?? solveSafeguarded(solarLongitudeState, target, estimate, 3, convergenceSeconds));
}

/** Nearest occurrence of the requested apparent lunar-solar elongation. */
function solveLunarPhaseMid(targetElongation, nearJdTT, {
  toleranceSeconds = 0.01,
  moonLatitudeTerms = DEFAULT_NEW_MOON_LATITUDE_TERMS,
  solver = 'auto',
} = {}) {
  if (!Number.isFinite(targetElongation)) throw new TypeError('targetElongation must be finite');
  if (solver !== 'auto' && solver !== 'safeguarded') {
    throw new RangeError("solver must be 'auto' or 'safeguarded'");
  }
  const target = wrapRadians(targetElongation);
  const simple = solver === 'auto' ? trySimpleEvent(target, nearJdTT, toleranceSeconds, true, moonLatitudeTerms) : null;
  if (simple) return addUt1(simple);
  // From an arbitrary date the lunar phase can start almost half a synodic
  // month from its target; a third cheap low-model step removes that curvature.
  const estimate = estimateRoot(lowElongationState, target, nearJdTT, 3);
  const evaluator = jdTT => elongationState(jdTT, { moonLatitudeTerms });
  const fastEvaluator = jdTT => fastElongationState(jdTT, moonLatitudeTerms);
  const root = solver === 'auto'
    ? solveFastNewton(fastEvaluator, target, estimate, 2, toleranceSeconds)
    : null;
  const result = root ?? solveSafeguarded(evaluator, target, estimate, 2, toleranceSeconds);
  return addUt1(result);
}

/** Nearest event; a per-call accuracy overrides the module default. */
export function solveSolarLongitude(targetLongitude, nearJdTT, options = {}) {
  return routeEvent(targetLongitude, nearJdTT, false, options);
}

export function solveLunarPhase(targetElongation, nearJdTT, options = {}) {
  return routeEvent(targetElongation, nearJdTT, true, options);
}

/** Nearest astronomical new moon to nearJdTT, using the selected event accuracy. */
export function solveNewMoon(nearJdTT, options = {}) {
  return solveLunarPhase(0, nearJdTT, options);
}

function routeEvent(target, nearJdTT, lunar, options) {
  const accuracy = checkedEventAccuracy(options.accuracy === undefined ? 'mid' : options.accuracy);
  if (accuracy === 'mid') return (lunar ? solveLunarPhaseMid : solveSolarLongitudeMid)(target, nearJdTT, options);
  return solveTierEvent(target, nearJdTT, lunar, accuracy, options);
}

// Unwrapped angles identify the revolution; all four entry points return JD(TT).
function eventAngleSeed(angle, lunar) {
  if (!Number.isFinite(angle)) throw new TypeError('angle must be finite radians');
  return checkedEventDate(J2000 + (lunar ? (angle + 1.08472) / 7771.37714500204
    : (angle - 1.75347 - Math.PI) / 628.3319653318) * 36525);
}
function checkedEventDate(jd) {
  if (!Number.isFinite(jd) || Math.abs(jd - J2000) > 2922000)
    throw new RangeError('Event must lie within J2000 ± 2922000 days');
  return jd;
}
/** SX-style fixed-stage event route; unwrapped solar longitude → JD(TT). */
export function solarLongitudeTimeFast(longitude) {
  let jd = eventAngleSeed(longitude, false);
  jd = checkedEventDate(jd - fastWrap(fastSolarLongitude(jd, 28, 10, 0, 3) - longitude) / solarRate2(jd));
  return checkedEventDate(jd - fastWrap(fastSolarLongitude(jd) - longitude) / solarRate2(jd));
}
/** SX-style fixed-stage route; unwrapped elongation → JD(TT); 2*pi*k selects new moons. */
export function lunarPhaseTimeFast(elongation) {
  let jd = eventAngleSeed(elongation, true);
  jd = checkedEventDate(jd - fastWrap(fastElongation(jd, 8, 11, 0, 0, 3) - elongation) / (7771.37714500204 / 36525));
  const velocity = elongationRate2(jd);
  jd = checkedEventDate(jd - fastWrap(fastElongation(jd, 33, 48, 10, 0, 3) - elongation) / velocity);
  return checkedEventDate(jd - fastWrap(fastElongation(jd) - elongation) / velocity);
}
const ACCURATE_EVENT_OPTIONS = Object.freeze({
  frame: 'true-of-date', lightTime: true, aberration: true, solarDeflection: true,
});
function physicalEventState(jd, lunar) {
  checkedEventDate(jd);
  const sun = apparentBodyState('sun', jd, ACCURATE_EVENT_OPTIONS);
  const radians = Math.PI / 180;
  if (!lunar) return { value: sun.longitudeDeg * radians, rate: sun.longitudeSpeedDegPerDay * radians };
  const moon = apparentBodyState('moon', jd, ACCURATE_EVENT_OPTIONS);
  return { value: wrapRadians((moon.longitudeDeg - sun.longitudeDeg) * radians),
    rate: (moon.longitudeSpeedDegPerDay - sun.longitudeSpeedDegPerDay) * radians };
}
function physicalEventRoot(angle, lunar, toleranceSeconds, solver = 'auto', target = wrapRadians(angle)) {
  const seed = eventAngleSeed(angle, lunar);
  if (!(toleranceSeconds > 0) || !Number.isFinite(toleranceSeconds))
    throw new RangeError('toleranceSeconds must be positive and finite');
  if (toleranceSeconds < 2 * Number.EPSILON * Math.abs(seed) * 86400)
    throw new RangeError('toleranceSeconds is below Julian Day resolution');
  const estimate = lunar ? lunarPhaseTimeFast(angle) : solarLongitudeTimeFast(angle);
  const evaluate = jd => physicalEventState(jd, lunar);
  const root = solver === 'auto' ? solveFastNewton(evaluate, target, estimate, lunar ? 2 : 3, toleranceSeconds) : null;
  if (root) { checkedEventDate(root.jdTT); return root; }
  const fallback = solveSafeguarded(evaluate, target, estimate, lunar ? 2 : 3, toleranceSeconds);
  const state = evaluate(fallback.jdTT);
  const roundingSeconds = 2 * Number.EPSILON * Math.abs(fallback.jdTT) * 86400;
  if (Math.abs(wrapRadians(state.value - target) / state.rate) * 86400 > toleranceSeconds + roundingSeconds)
    throw new RangeError('apparent event root did not converge');
  checkedEventDate(fallback.jdTT);
  return fallback;
}
/** Iterated light time, relativistic aberration and full date-frame transformations. */
export function solarLongitudeTimeAccurate(longitude, { toleranceSeconds = 0.01 } = {}) {
  return physicalEventRoot(longitude, false, toleranceSeconds).jdTT;
}
/** Same apparent-position chain for both bodies, including full lunar latitude and distance. */
export function lunarPhaseTimeAccurate(elongation, { toleranceSeconds = 0.01 } = {}) {
  return physicalEventRoot(elongation, true, toleranceSeconds).jdTT;
}

function solveTierEvent(targetAngle, nearJdTT, lunar, accuracy, options) {
  if (!Number.isFinite(targetAngle) || !Number.isFinite(nearJdTT))
    throw new TypeError('target angle and nearJdTT must be finite');
  checkedEventDate(nearJdTT);
  const { solver = 'auto', toleranceSeconds = 0.01 } = options;
  if (solver !== 'auto' && solver !== 'safeguarded')
    throw new RangeError("solver must be 'auto' or 'safeguarded'");
  if (accuracy === 'fast' && (options.toleranceSeconds !== undefined || solver !== 'auto'))
    throw new RangeError('fast accuracy has no tolerance or safeguarded solver; use mid or accurate');
  const latitudeTerms = accuracy === 'fast' ? 10 : 'full';
  if (lunar && options.moonLatitudeTerms !== undefined && options.moonLatitudeTerms !== latitudeTerms)
    throw new RangeError(`moonLatitudeTerms must be ${latitudeTerms} for ${accuracy} accuracy; use mid for custom budgets`);
  const target = wrapRadians(targetAngle), tau = 2 * Math.PI, t = (nearJdTT - J2000) / 36525;
  const mean = lunar ? 7771.37714500204 * t - 1.08472 : 1.75347 + Math.PI + 628.3319653318 * t;
  const angle = target + tau * Math.round((mean - target) / tau);
  const evaluate = W => {
    // Keep the original normalized target for residuals; reducing a many-cycle
    // W back to radians loses extra bits at remote dates.
    if (accuracy === 'accurate') return physicalEventRoot(W, lunar, toleranceSeconds, solver, target);
    const jdTT = lunar ? lunarPhaseTimeFast(W) : solarLongitudeTimeFast(W);
    return { jdTT };
  };
  let result = evaluate(angle);
  // Mean-cycle rounding need not select the nearest physical occurrence near
  // a half-cycle boundary. Compare the neighbor toward the requested date there.
  // These conservative guards are well below half the shortest supported cycle.
  const distance = nearJdTT - result.jdTT;
  if (Math.abs(distance) > (lunar ? 12 : 170)) {
    const adjacent = evaluate(angle + Math.sign(distance) * tau);
    if (Math.abs(adjacent.jdTT - nearJdTT) < Math.abs(distance)) result = adjacent;
  }
  return addUt1(result);
}

export const LOW_MODEL_INFO = Object.freeze({
  earthLongitudeTerms: LOW_EARTH_LONGITUDE_CANDIDATES.slice(0, 10).map(({ degree, serial }) => ({ power: degree, serial })),
  moonLongitudeTerms: LOW_MOON_LONGITUDE_CANDIDATES.slice(0, 10).map(({ power, serial }) => ({ power, serial })),
  earthRadiusTerms: LOW_EARTH_RADIUS_TERMS.map(({ degree, serial }) => ({ power: degree, serial })),
  nutationTerms: 10,
});

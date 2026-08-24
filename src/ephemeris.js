import { pathToFileURL } from 'node:url';
import { MODEL_DATA } from './generated/model-data.js';
import {
  J2000,
  ARCSEC_TO_RAD,
  iau2000bNutation,
  vondrak2011PrecessionMatrix,
} from './coordinates.js';

export { J2000, iau2000bNutation, vondrak2011PrecessionMatrix };

export const AU_KM = 149597870.7;
export const EARTH_MOON_MASS_RATIO = 81.30056822149722;
const DAYS_PER_CENTURY = 36525;
const DAYS_PER_MILLENNIUM = 365250;
const MAX_LITE_CENTURIES = 80;

const MOON_DRIFT_ARCSEC = [
  -1270.2497678680234, -9073.055981916283, -1695.800937794303,
  -2967.3021471558664, -450.8770167918551, 43.366226687291054,
  -31.278065224014263, 5.346486045541207, -5.777412403326654,
];
const MOON_PHASE = [
  [0.006232254281670179, 0.043992736750363026, 0.008294045947153562, 0.01439327062713528, 0.002180547545552178, -0.0001960758039461124, 0.00014132668308641815, -0.00001235463968320285, 0.000014921800663338193],
  [0.005051840125395046, 0.06531435895947252, 0.006692711774786636, 0.022022197225593548, 0.0016357448953074854, 0.00012567174197924435, -0.00003124901077382534, 0.000008315481101326347, -0.000005483781605034945],
  [0.004855702589840564, 0.008969529333088592, 0.006929742544286491, -0.00032049572838479504, 0.0027699297580660014, -0.0022843564117912434, 0.0008808382152113649, -0.0002070389528907684, 0.00016224605809589838],
  [-0.00004572774781248838, -0.010079218627773256, -0.0002246486436592161, -0.005126786255685112, -0.0004431929810297535, -0.0010972884817857264, -0.00038945444390232296, -0.00003107324236768442, -0.00016674970242531022],
];
const EARTH_DRIFT = [-2.03998648051909e-6, 2.4739693773706224e-5, -2.501192724744634e-7, 8.931553872785951e-6];
const EARTH_PHASE = [
  [5.868938565364685e-5, 1.7310944140748013e-4, 8.021097160450445e-5, 6.593359661874999e-5, 2.6093601301708897e-5],
  [1.8303230099815508e-5, -4.8478765286447665e-4, 5.788376093248166e-5, -5.987918330833764e-5, -3.162714061090479e-5],
];
const EARTH_PHASE_TERMS = [
  [0, 0.03341656453, 4.66925680415, 6283.0758499914],
  [1, 0.00206058863, 2.67823455808, 6283.0758499914],
];

function polynomial(coefficients, x) {
  let result = 0;
  for (let i = coefficients.length - 1; i >= 0; i -= 1) result = result * x + coefficients[i];
  return result;
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

function phasePolynomialState(phase, t, tRate) {
  return polynomialState(phase, t, tRate);
}

function smoothstep01(x) {
  const value = Math.max(0, Math.min(1, x));
  return value * value * (3 - 2 * value);
}

/** Weight for empirical DE441 corrections: exactly zero within 200 years of J2000. */
export function correctionWeight(jdTT) {
  const distanceYears = Math.abs(jdTT - J2000) / 365.25;
  return smoothstep01((distanceYears - 200) / 800);
}

function correctionWeightState(jdTT) {
  const delta = jdTT - J2000;
  const distanceYears = Math.abs(delta) / 365.25;
  const x = (distanceYears - 200) / 800;
  if (x <= 0) return { value: 0, rate: 0 };
  if (x >= 1) return { value: 1, rate: 0 };
  return {
    value: x * x * (3 - 2 * x),
    rate: 6 * x * (1 - x) * Math.sign(delta) / (800 * 365.25),
  };
}

function rotateLongitudeState(position, velocity, angle, angleRate) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const [x, y, z] = position;
  const [vx, vy, vz] = velocity;
  return {
    position: [c * x - s * y, s * x + c * y, z],
    velocity: [
      c * vx - s * vy - angleRate * (s * x + c * y),
      s * vx + c * vy + angleRate * (c * x - s * y),
      vz,
    ],
  };
}

function evaluateElpCoordinateState(coordinate, t, tRate, shifts) {
  let value = 0, rate = 0;
  const blocks = MODEL_DATA.elp.terms[coordinate];
  for (let order = 0; order < blocks.length; order += 1) {
    let subtotal = 0, subtotalRate = 0;
    for (const term of blocks[order]) {
      const argument = phasePolynomialState(term.slice(1, 6), t, tRate);
      if (coordinate === 0 && shifts) {
        for (let index = 0; index < 4; index += 1) {
          argument.value += term[6 + index] * shifts[index].value;
          argument.rate += term[6 + index] * shifts[index].rate;
        }
      }
      subtotal += term[0] * Math.sin(argument.value);
      subtotalRate += term[0] * Math.cos(argument.value) * argument.rate;
    }
    const envelope = t ** order;
    const envelopeRate = order === 0 ? 0 : order * t ** (order - 1) * tRate;
    value += subtotal * envelope;
    rate += subtotalRate * envelope + subtotal * envelopeRate;
  }
  return { value, rate };
}

const MOON_LATITUDE_CANDIDATES = MODEL_DATA.elp.terms[1]
  .flatMap((terms, power) => terms.map((term, serial) => ({
    term,
    power,
    serial,
    score: Math.abs(term[0]) * MAX_LITE_CENTURIES ** power,
  })))
  .sort((a, b) => b.score - a.score || a.power - b.power || a.serial - b.serial);

function evaluateSelectedLatitudeState(t, tRate, termCount) {
  if (termCount === 'full') return evaluateElpCoordinateState(1, t, tRate, null);
  if (!Number.isInteger(termCount) || termCount < 0 || termCount > MOON_LATITUDE_CANDIDATES.length) {
    throw new RangeError(`latitudeTerms must be 'full' or an integer from 0 to ${MOON_LATITUDE_CANDIDATES.length}`);
  }
  let value = 0;
  let rate = 0;
  for (const { term, power } of MOON_LATITUDE_CANDIDATES.slice(0, termCount)) {
    const argument = phasePolynomialState(term.slice(1, 6), t, tRate);
    const envelope = t ** power;
    const envelopeRate = power === 0 ? 0 : power * t ** (power - 1) * tRate;
    const sine = Math.sin(argument.value);
    value += term[0] * envelope * sine;
    rate += term[0] * (envelopeRate * sine + envelope * Math.cos(argument.value) * argument.rate);
  }
  return { value, rate };
}

function moonParityResidualState(t, tRate, u, uRate) {
  const phases = MODEL_DATA.elp.correctionPhases.map(phase => phasePolynomialState(phase, t, tRate));
  const power = exponent => ({
    value: u ** exponent,
    rate: exponent === 0 ? 0 : exponent * u ** (exponent - 1) * uRate,
  });
  const coefficient = terms => terms.reduce((state, [amplitude, exponent]) => {
    const p = power(exponent);
    return { value: state.value + amplitude * p.value, rate: state.rate + amplitude * p.rate };
  }, { value: 0, rate: 0 });
  const channels = [
    [coefficient([[-0.7755603348942103, 1], [25.849877553047694, 3]]), phases[0], 'sin'],
    [coefficient([[5.65296331655521, 1], [-62.24135532119237, 3], [48.72806599863715, 5]]), phases[1], 'sin'],
    [coefficient([[-11.960846824872082, 2], [43.02963996947579, 4], [13.305646311970706, 6]]), phases[1], 'cos'],
  ];
  let value = 0, rate = 0;
  for (const [amplitude, phase, trig] of channels) {
    const functionValue = trig === 'sin' ? Math.sin(phase.value) : Math.cos(phase.value);
    const functionRate = (trig === 'sin' ? Math.cos(phase.value) : -Math.sin(phase.value)) * phase.rate;
    value += amplitude.value * functionValue;
    rate += amplitude.rate * functionValue + amplitude.value * functionRate;
  }
  return { value, rate };
}

/** Internal model correction parameters, exposed for the independently truncated event estimator. */
export function moonCorrectionState(jdTT, corrections = true) {
  const t = (jdTT - J2000) / DAYS_PER_CENTURY;
  const tRate = 1 / DAYS_PER_CENTURY;
  const year = 2000 + t * 100;
  const weight = corrections ? correctionWeightState(jdTT) : { value: 0, rate: 0 };
  const fitX = (year - 1995.75) / 15195.05;
  const fitXRate = 100 * tRate / 15195.05;
  const shifts = MOON_PHASE.map(row => {
    const base = chebyshevState(row, fitX, fitXRate);
    return { value: base.value * weight.value, rate: base.rate * weight.value + base.value * weight.rate };
  });
  const drift = chebyshevState(MOON_DRIFT_ARCSEC, fitX, fitXRate);
  const parityX = (year - 2000) / 15199.3;
  const parity = moonParityResidualState(t, tRate, parityX, 100 * tRate / 15199.3);
  const correction = { value: drift.value + parity.value, rate: drift.rate + parity.rate };
  return {
    shifts,
    rotation: {
      value: -correction.value * weight.value * ARCSEC_TO_RAD,
      rate: -(correction.rate * weight.value + correction.value * weight.rate) * ARCSEC_TO_RAD,
    },
  };
}

function sphericalState(longitude, latitude, radius) {
  const cl = Math.cos(longitude.value), sl = Math.sin(longitude.value);
  const cb = Math.cos(latitude.value), sb = Math.sin(latitude.value);
  const rc = radius.value * cb;
  const rcRate = radius.rate * cb - radius.value * sb * latitude.rate;
  return {
    position: [rc * cl, rc * sl, radius.value * sb],
    velocity: [
      rcRate * cl - rc * sl * longitude.rate,
      rcRate * sl + rc * cl * longitude.rate,
      radius.rate * sb + radius.value * cb * latitude.rate,
    ],
  };
}

function applyMatrix(matrix, vector) {
  return matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
}

function transformState(frame, state) {
  const position = applyMatrix(frame.matrix, state.position);
  const frameVelocity = applyMatrix(frame.rate, state.position);
  const velocity = applyMatrix(frame.matrix, state.velocity)
    .map((value, index) => value + frameVelocity[index]);
  return { position, velocity };
}

function elpPrecessionState(t, tRate) {
  const pPolynomial = polynomialState(MODEL_DATA.elp.precP, t, tRate);
  const qPolynomial = polynomialState(MODEL_DATA.elp.precQ, t, tRate);
  const p = { value: pPolynomial.value * t, rate: pPolynomial.rate * t + pPolynomial.value * tRate };
  const q = { value: qPolynomial.value * t, rate: qPolynomial.rate * t + qPolynomial.value * tRate };
  const radicand = 1 - p.value * p.value - q.value * q.value;
  if (radicand < 0) throw new RangeError('ELP P/Q rotation is outside its real-valued domain');
  const r = {
    value: 2 * Math.sqrt(radicand),
    rate: -2 * (p.value * p.rate + q.value * q.rate) / Math.sqrt(radicand),
  };
  return {
    matrix: [
      [1 - 2 * p.value ** 2, 2 * p.value * q.value, p.value * r.value],
      [2 * p.value * q.value, 1 - 2 * q.value ** 2, -q.value * r.value],
      [-p.value * r.value, q.value * r.value, 1 - 2 * p.value ** 2 - 2 * q.value ** 2],
    ],
    rate: [
      [-4 * p.value * p.rate, 2 * (p.rate * q.value + p.value * q.rate), p.rate * r.value + p.value * r.rate],
      [2 * (p.rate * q.value + p.value * q.rate), -4 * q.value * q.rate, -(q.rate * r.value + q.value * r.rate)],
      [-(p.rate * r.value + p.value * r.rate), q.rate * r.value + q.value * r.rate, -4 * p.value * p.rate - 4 * q.value * q.rate],
    ],
  };
}

function moonAngularState(jdTT, corrections, latitudeTerms = 'full') {
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  const t = (jdTT - J2000) / DAYS_PER_CENTURY;
  const tRate = 1 / DAYS_PER_CENTURY;
  const correction = moonCorrectionState(jdTT, corrections);
  const shifts = correction.shifts.every(shift => shift.value === 0 && shift.rate === 0)
    ? null
    : correction.shifts;
  const longitudeMean = polynomialState(MODEL_DATA.elp.w1, t, tRate);
  const longitudePeriodic = evaluateElpCoordinateState(0, t, tRate, shifts);
  const latitudePeriodic = evaluateSelectedLatitudeState(t, tRate, latitudeTerms);
  return {
    t,
    tRate,
    correction,
    longitude: {
      value: longitudeMean.value + longitudePeriodic.value * ARCSEC_TO_RAD,
      rate: longitudeMean.rate + longitudePeriodic.rate * ARCSEC_TO_RAD,
    },
    latitude: {
      value: latitudePeriodic.value * ARCSEC_TO_RAD,
      rate: latitudePeriodic.rate * ARCSEC_TO_RAD,
    },
  };
}

function finishMoonFrame(state, angular) {
  let result = transformState(elpPrecessionState(angular.t, angular.tRate), state);
  const rotation = angular.correction.rotation;
  if (rotation.value !== 0 || rotation.rate !== 0) {
    result = rotateLongitudeState(result.position, result.velocity, rotation.value, rotation.rate);
  }
  return result;
}

/** Geocentric Moon, J2000 mean ecliptic/equinox, kilometres. */
export function moonPosition(jdTT, { corrections = true } = {}) {
  return moonState(jdTT, { corrections }).position;
}

/** Raw ELP longitude series. No P/Q, date-frame precession or final Z rotation. */
export function moonElpLongitudeState(jdTT, { corrections = true } = {}) {
  const angular = moonAngularState(jdTT, corrections, 0);
  return { ...angular.longitude };
}

/** Unit Moon direction and analytic direction rate; radius series is skipped. */
export function moonDirectionState(jdTT, { corrections = true, latitudeTerms = 'full' } = {}) {
  const angular = moonAngularState(jdTT, corrections, latitudeTerms);
  return finishMoonFrame(
    sphericalState(angular.longitude, angular.latitude, { value: 1, rate: 0 }),
    angular,
  );
}

/** Geocentric Moon position (km) and analytic velocity (km/day), J2000 ecliptic. */
export function moonState(jdTT, { corrections = true } = {}) {
  const angular = moonAngularState(jdTT, corrections, 'full');
  const radiusPeriodic = evaluateElpCoordinateState(2, angular.t, angular.tRate, null);
  const radiusScale = MODEL_DATA.elp.a405 / MODEL_DATA.elp.aelp;
  const radius = { value: radiusPeriodic.value * radiusScale, rate: radiusPeriodic.rate * radiusScale };
  return finishMoonFrame(sphericalState(angular.longitude, angular.latitude, radius), angular);
}

export const MOON_MODEL_INFO = Object.freeze({
  longitudeTerms: MODEL_DATA.elp.terms[0].reduce((sum, block) => sum + block.length, 0),
  latitudeTerms: MODEL_DATA.elp.terms[1].reduce((sum, block) => sum + block.length, 0),
  radiusTerms: MODEL_DATA.elp.terms[2].reduce((sum, block) => sum + block.length, 0),
  eventDirectionSkipsRadius: true,
  directionLatitudeTerms: Object.freeze([0, 5, 10, 20, 'full']),
});

function evaluateVsopEarthState(jdTT) {
  const tau = (jdTT - J2000) / DAYS_PER_MILLENNIUM;
  const tauRate = 1 / DAYS_PER_MILLENNIUM;
  const lbr = Array.from({ length: 3 }, () => ({ value: 0, rate: 0 }));
  for (let coordinate = 0; coordinate < 3; coordinate += 1) {
    for (let power = 0; power < MODEL_DATA.vsopEarth[coordinate].length; power += 1) {
      let subtotal = 0, subtotalRate = 0;
      for (const [amplitude, phase, frequency] of MODEL_DATA.vsopEarth[coordinate][power]) {
        const argument = phase + frequency * tau;
        subtotal += amplitude * Math.cos(argument);
        subtotalRate -= amplitude * frequency * Math.sin(argument) * tauRate;
      }
      const envelope = tau ** power;
      const envelopeRate = power === 0 ? 0 : power * tau ** (power - 1) * tauRate;
      lbr[coordinate].value += subtotal * envelope;
      lbr[coordinate].rate += subtotalRate * envelope + subtotal * envelopeRate;
    }
  }
  return { tau, tauRate, lbr };
}

export function earthLongitudeCorrectionState(jdTT, corrections = true) {
  const tau = (jdTT - J2000) / DAYS_PER_MILLENNIUM;
  const tauRate = 1 / DAYS_PER_MILLENNIUM;
  const year = 2000 + tau * 1000;
  const weight = corrections ? correctionWeightState(jdTT) : { value: 0, rate: 0 };
  if (weight.value === 0 && weight.rate === 0) return { value: 0, rate: 0 };
  const x = (year - 2643.5) / 7355.5;
  const xRate = 1000 * tauRate / 7355.5;
  const drift = chebyshevState(EARTH_DRIFT, x, xRate);
  const result = {
    value: drift.value * weight.value,
    rate: drift.rate * weight.value + drift.value * weight.rate,
  };
  for (let index = 0; index < EARTH_PHASE_TERMS.length; index += 1) {
    const [power, amplitude, phase, frequency] = EARTH_PHASE_TERMS[index];
    const baseShift = chebyshevState(EARTH_PHASE[index], x, xRate);
    const shift = {
      value: baseShift.value * weight.value,
      rate: baseShift.rate * weight.value + baseShift.value * weight.rate,
    };
    const argument = phase + frequency * tau;
    const argumentRate = frequency * tauRate;
    const trig = Math.cos(argument + shift.value) - Math.cos(argument);
    const trigRate = -Math.sin(argument + shift.value) * (argumentRate + shift.rate) + Math.sin(argument) * argumentRate;
    const envelope = tau ** power;
    const envelopeRate = power === 0 ? 0 : power * tau ** (power - 1) * tauRate;
    result.value += amplitude * envelope * trig;
    result.rate += amplitude * (envelopeRate * trig + envelope * trigRate);
  }
  return result;
}

/** Heliocentric physical Earth, J2000 dynamical ecliptic/equinox, AU. */
export function earthPosition(jdTT, { corrections = true } = {}) {
  return earthState(jdTT, { corrections }).position;
}

/** Heliocentric Earth position (AU) and analytic velocity (AU/day), J2000 ecliptic. */
export function earthState(jdTT, { corrections = true } = {}) {
  if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
  const { tau, tauRate, lbr } = evaluateVsopEarthState(jdTT);
  const correction = earthLongitudeCorrectionState(jdTT, corrections);
  lbr[0].value += correction.value;
  lbr[0].rate += correction.rate;
  return sphericalState(lbr[0], lbr[1], lbr[2]);
}

/** Heliocentric Earth-Moon barycentre, J2000 mean ecliptic/equinox, AU. */
export function embPosition(jdTT, options = {}) {
  return embState(jdTT, options).position;
}

export function embState(jdTT, options = {}) {
  const earth = earthState(jdTT, options);
  const moon = moonState(jdTT, options);
  const factor = 1 / ((1 + EARTH_MOON_MASS_RATIO) * AU_KM);
  return {
    position: earth.position.map((value, index) => value + moon.position[index] * factor),
    velocity: earth.velocity.map((value, index) => value + moon.velocity[index] * factor),
  };
}

/** Explicit alias: heliocentric Earth, J2000 ecliptic, AU and AU/day. */
export function earthHeliocentricState(jdTT, options = {}) {
  return earthState(jdTT, options);
}

export function earthHeliocentricPosition(jdTT, options = {}) {
  return earthHeliocentricState(jdTT, options).position;
}

/** Geometric geocentric Sun, J2000 ecliptic, AU and AU/day. */
export function sunGeocentricState(jdTT, options = {}) {
  const earth = earthState(jdTT, options);
  return {
    position: earth.position.map(value => -value),
    velocity: earth.velocity.map(value => -value),
  };
}

export function sunGeocentricPosition(jdTT, options = {}) {
  return sunGeocentricState(jdTT, options).position;
}

/** Explicit alias: geocentric Moon, J2000 ecliptic, km and km/day. */
export function moonGeocentricState(jdTT, options = {}) {
  return moonState(jdTT, options);
}

export function moonGeocentricPosition(jdTT, options = {}) {
  return moonGeocentricState(jdTT, options).position;
}

/** Heliocentric Moon, J2000 ecliptic, AU and AU/day. */
export function moonHeliocentricState(jdTT, options = {}) {
  const earth = earthState(jdTT, options);
  const moon = moonState(jdTT, options);
  return {
    position: earth.position.map((value, index) => value + moon.position[index] / AU_KM),
    velocity: earth.velocity.map((value, index) => value + moon.velocity[index] / AU_KM),
  };
}

export function moonHeliocentricPosition(jdTT, options = {}) {
  return moonHeliocentricState(jdTT, options).position;
}

/** Explicit alias: heliocentric Earth-Moon barycentre, J2000 ecliptic, AU and AU/day. */
export function embHeliocentricState(jdTT, options = {}) {
  return embState(jdTT, options);
}

export function embHeliocentricPosition(jdTT, options = {}) {
  return embHeliocentricState(jdTT, options).position;
}

export const EPHEMERIS_FRAME_INFO = Object.freeze({
  frame: 'J2000 mean/dynamical ecliptic and equinox',
  geometric: true,
  lightTimeApplied: false,
  earthHeliocentricUnit: 'AU',
  sunGeocentricUnit: 'AU',
  moonGeocentricUnit: 'km',
  moonHeliocentricUnit: 'AU',
  embHeliocentricUnit: 'AU',
  velocityTimeUnit: 'day',
});

function vectorSummary(vector, unit) {
  return { x: vector[0], y: vector[1], z: vector[2], unit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argument = process.argv[2];
  const jdTT = argument === undefined ? J2000 : Number(argument);
  if (!Number.isFinite(jdTT)) {
    console.error('Usage: node src/ephemeris.js [jdTT]');
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify({
      jdTT,
      correctionWeight: correctionWeight(jdTT),
      earth: vectorSummary(earthPosition(jdTT), 'AU'),
      moon: vectorSummary(moonPosition(jdTT), 'km'),
      emb: vectorSummary(embPosition(jdTT), 'AU'),
      iau2000b: iau2000bNutation(jdTT),
      vondrak2011: vondrak2011PrecessionMatrix(jdTT),
    }, null, 2));
  }
}

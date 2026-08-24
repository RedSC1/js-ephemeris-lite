import { MODEL_DATA } from './generated/model-data.js';

export const J2000 = 2451545.0;
export const ARCSEC_TO_RAD = Math.PI / 648000;
const TWO_PI = 2 * Math.PI;
const DAYS_PER_CENTURY = 36525;
const EPS0 = 84381.406 * ARCSEC_TO_RAD;

const ECLIPTIC_PERIODIC = [
  [708.15, -5486.751211, -684.66156, 667.66673, -5523.863691],
  [2309, -17.127623, 2446.28388, -2354.886252, -549.74745],
  [1620, -617.517403, 399.671049, -428.152441, -310.998056],
  [492.2, 413.44294, -356.652376, 376.202861, 421.535876],
  [1183, 78.614193, -186.387003, 184.778874, -36.776172],
  [622, -180.732815, -316.80007, 335.321713, -145.278396],
  [882, -87.676083, 198.296701, -185.138669, -34.74445],
  [547, 46.140315, 101.135679, -120.97283, 22.885731],
];
const EQUATOR_PERIODIC = [
  [256.75, -819.940624, 75004.344875, 81491.287984, 1558.515853],
  [708.15, -8444.676815, 624.033993, 787.163481, 7774.939698],
  [274.2, 2600.009459, 1251.136893, 1251.296102, -2219.534038],
  [241.45, 2755.17563, -1102.212834, -1257.950837, -2523.969396],
  [2309, -167.659835, -2660.66498, -2966.79973, 247.850422],
  [492.2, 871.855056, 699.291817, 639.744522, -846.485643],
  [396.1, 44.769698, 153.16722, 131.600209, -1393.124055],
  [288.9, -512.313065, -950.865637, -445.040117, 368.526116],
  [231.1, -819.415595, 499.754645, 584.522874, 749.045012],
  [1610, -538.071099, -145.18821, -89.756563, 444.704518],
  [620, -189.793622, 558.116553, 524.42963, 235.934465],
  [157.87, -402.922932, -23.923029, -13.549067, 374.049623],
  [220.3, 179.516345, -165.405086, -210.157124, -171.33018],
  [1200, -9.814756, 9.344131, -44.919798, -22.899655],
];

const PA = [5851.607687, -0.1189, -0.00028913, 1.01e-7];
const QA = [-1600.8863, 1.1689818, -2e-7, -4.37e-7];
const XA = [5453.282155, 0.4252841, -0.00037173, -1.52e-7];
const YA = [-73750.93035, -0.7675452, -0.00018725, 2.31e-7];

function polynomial(coefficients, x) {
  let result = 0;
  for (let i = coefficients.length - 1; i >= 0; i -= 1) result = result * x + coefficients[i];
  return result;
}

function polynomialDerivative(coefficients, x) {
  let result = 0;
  for (let i = coefficients.length - 1; i >= 1; i -= 1) result = result * x + i * coefficients[i];
  return result;
}

function multiply(a, b) {
  return a.map(row => b[0].map((_, column) => row.reduce(
    (sum, value, index) => sum + value * b[index][column], 0)));
}

function addMatrices(a, b) {
  return a.map((row, i) => row.map((value, j) => value + b[i][j]));
}

function transpose(matrix) {
  return matrix[0].map((_, column) => matrix.map(row => row[column]));
}

function rotationX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[1, 0, 0], [0, c, s], [0, -s, c]];
}

function rotationXRate(angle, angleRate) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[0, 0, 0], [0, -s * angleRate, c * angleRate], [0, -c * angleRate, -s * angleRate]];
}

function rotationY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
}

function rotationZ(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[c, s, 0], [-s, c, 0], [0, 0, 1]];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function addVectors(a, b) {
  return a.map((value, index) => value + b[index]);
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map(value => value / length);
}


function normalizeState(vector, rate) {
  const length = Math.hypot(...vector);
  const unit = vector.map(value => value / length);
  const projection = unit.reduce((sum, value, index) => sum + value * rate[index], 0);
  return {
    value: unit,
    rate: rate.map((value, index) => (value - unit[index] * projection) / length),
  };
}

function crossState(a, aRate, b, bRate) {
  return {
    value: cross(a, b),
    rate: addVectors(cross(aRate, b), cross(a, bRate)),
  };
}

export function meanObliquityIau2006(jdTT) {
  const t = (jdTT - J2000) / DAYS_PER_CENTURY;
  return (((((-0.0000000434 * t - 0.000000576) * t + 0.00200340) * t
    - 0.0001831) * t - 46.836769) * t + 84381.406) * ARCSEC_TO_RAD;
}

export function meanObliquityIau2006State(jdTT) {
  const coefficients = [84381.406, -46.836769, -0.0001831, 0.00200340, -0.000000576, -0.0000000434];
  const t = (jdTT - J2000) / DAYS_PER_CENTURY;
  return {
    value: polynomial(coefficients, t) * ARCSEC_TO_RAD,
    rate: polynomialDerivative(coefficients, t) * ARCSEC_TO_RAD / DAYS_PER_CENTURY,
  };
}

export function iau2000bNutation(jdTT) {
  const state = iau2000bNutationState(jdTT);
  return {
    dpsi: state.dpsi,
    deps: state.deps,
    meanObliquity: state.meanObliquity,
    trueObliquity: state.trueObliquity,
  };
}

/** IAU 2000B angles and analytic rates per TT day. */
export function iau2000bNutationState(jdTT, termCount = MODEL_DATA.iau2000b.length) {
  const t = (jdTT - J2000) / DAYS_PER_CENTURY;
  const arcsecArgument = value => (value % 1296000) * ARCSEC_TO_RAD;
  const definitions = [
    [485868.249036, 1717915923.2178],
    [1287104.79305, 129596581.0481],
    [335779.526232, 1739527262.8478],
    [1072260.70369, 1602961601.2090],
    [450160.398036, -6962890.5431],
  ];
  const fa = definitions.map(([offset, speed]) => arcsecArgument(offset + t * speed));
  const faRate = definitions.map(([, speed]) => speed * ARCSEC_TO_RAD / DAYS_PER_CENTURY);
  let dp = 0, de = 0, dpRate = 0, deRate = 0;
  const count = Math.max(0, Math.min(termCount, MODEL_DATA.iau2000b.length));
  for (let i = count - 1; i >= 0; i -= 1) {
    const [l, lp, f, d, om, ps, pst, pc, ec, ect, es] = MODEL_DATA.iau2000b[i];
    const argument = l * fa[0] + lp * fa[1] + f * fa[2] + d * fa[3] + om * fa[4];
    const argumentRate = l * faRate[0] + lp * faRate[1] + f * faRate[2] + d * faRate[3] + om * faRate[4];
    const s = Math.sin(argument), c = Math.cos(argument);
    const psiAmplitude = ps + pst * t;
    const epsAmplitude = ec + ect * t;
    dp += psiAmplitude * s + pc * c;
    de += epsAmplitude * c + es * s;
    dpRate += pst / DAYS_PER_CENTURY * s + psiAmplitude * c * argumentRate - pc * s * argumentRate;
    deRate += ect / DAYS_PER_CENTURY * c - epsAmplitude * s * argumentRate + es * c * argumentRate;
  }
  const dpsi = (-0.000135 + dp * 1e-7) * ARCSEC_TO_RAD;
  const deps = (0.000388 + de * 1e-7) * ARCSEC_TO_RAD;
  const obliquity = meanObliquityIau2006State(jdTT);
  const dpsiRate = dpRate * 1e-7 * ARCSEC_TO_RAD;
  const depsRate = deRate * 1e-7 * ARCSEC_TO_RAD;
  return {
    dpsi,
    deps,
    dpsiRate,
    depsRate,
    meanObliquity: obliquity.value,
    meanObliquityRate: obliquity.rate,
    trueObliquity: obliquity.value + deps,
    trueObliquityRate: obliquity.rate + depsRate,
  };
}

export function vondrak2011PrecessionMatrix(jdTT) {
  return vondrak2011PrecessionMatrixState(jdTT).matrix;
}

/** Vondrak 2011 precession matrix and analytic matrix rate per TT day. */
export function vondrak2011PrecessionMatrixState(jdTT) {
  const t = (jdTT - J2000) / DAYS_PER_CENTURY;
  let p = 0, q = 0, pRate = 0, qRate = 0;
  for (const [period, c0, c1, s0, s1] of ECLIPTIC_PERIODIC) {
    const argument = TWO_PI * t / period;
    const argumentRate = TWO_PI / period;
    p += Math.cos(argument) * c0 + Math.sin(argument) * s0;
    q += Math.cos(argument) * c1 + Math.sin(argument) * s1;
    pRate += argumentRate * (-Math.sin(argument) * c0 + Math.cos(argument) * s0);
    qRate += argumentRate * (-Math.sin(argument) * c1 + Math.cos(argument) * s1);
  }
  p = (p + polynomial(PA, t)) * ARCSEC_TO_RAD;
  q = (q + polynomial(QA, t)) * ARCSEC_TO_RAD;
  pRate = (pRate + polynomialDerivative(PA, t)) * ARCSEC_TO_RAD / DAYS_PER_CENTURY;
  qRate = (qRate + polynomialDerivative(QA, t)) * ARCSEC_TO_RAD / DAYS_PER_CENTURY;
  const zEcliptic = Math.sqrt(Math.max(1 - p * p - q * q, 0));
  const zEclipticRate = zEcliptic === 0 ? 0 : -(p * pRate + q * qRate) / zEcliptic;
  const eclipticPole = [
    p,
    -q * Math.cos(EPS0) - zEcliptic * Math.sin(EPS0),
    -q * Math.sin(EPS0) + zEcliptic * Math.cos(EPS0),
  ];
  const eclipticPoleRate = [
    pRate,
    -qRate * Math.cos(EPS0) - zEclipticRate * Math.sin(EPS0),
    -qRate * Math.sin(EPS0) + zEclipticRate * Math.cos(EPS0),
  ];

  let x = 0, y = 0, xRate = 0, yRate = 0;
  for (const [period, c0, c1, s0, s1] of EQUATOR_PERIODIC) {
    const argument = TWO_PI * t / period;
    const argumentRate = TWO_PI / period;
    x += Math.cos(argument) * c0 + Math.sin(argument) * s0;
    y += Math.cos(argument) * c1 + Math.sin(argument) * s1;
    xRate += argumentRate * (-Math.sin(argument) * c0 + Math.cos(argument) * s0);
    yRate += argumentRate * (-Math.sin(argument) * c1 + Math.cos(argument) * s1);
  }
  x = (x + polynomial(XA, t)) * ARCSEC_TO_RAD;
  y = (y + polynomial(YA, t)) * ARCSEC_TO_RAD;
  xRate = (xRate + polynomialDerivative(XA, t)) * ARCSEC_TO_RAD / DAYS_PER_CENTURY;
  yRate = (yRate + polynomialDerivative(YA, t)) * ARCSEC_TO_RAD / DAYS_PER_CENTURY;
  const equatorZ = Math.sqrt(Math.max(1 - x * x - y * y, 0));
  const equatorZRate = equatorZ === 0 ? 0 : -(x * xRate + y * yRate) / equatorZ;
  const equatorPole = [x, y, equatorZ];
  const equatorPoleRate = [xRate, yRate, equatorZRate];
  const equinoxCross = crossState(equatorPole, equatorPoleRate, eclipticPole, eclipticPoleRate);
  const equinoxXState = normalizeState(equinoxCross.value, equinoxCross.rate);
  const equinoxYState = crossState(equatorPole, equatorPoleRate, equinoxXState.value, equinoxXState.rate);
  const frameBias = multiply(
    multiply(rotationX(0.0068192 * ARCSEC_TO_RAD), rotationY(-0.016617 * ARCSEC_TO_RAD)),
    rotationZ(-0.0146 * ARCSEC_TO_RAD),
  );
  return {
    matrix: multiply([equinoxXState.value, equinoxYState.value, equatorPole], frameBias),
    rate: multiply([equinoxXState.rate, equinoxYState.rate, equatorPoleRate], frameBias),
  };
}

const J2000_ECLIPTIC_STATE = (() => {
  const precession = vondrak2011PrecessionMatrixState(J2000);
  const obliquity = meanObliquityIau2006State(J2000);
  return multiply(rotationX(obliquity.value), precession.matrix);
})();

/** J2000 mean ecliptic vector -> mean ecliptic/equinox of date. */
export function meanEclipticOfDateMatrixState(jdTT) {
  const precession = vondrak2011PrecessionMatrixState(jdTT);
  const obliquity = meanObliquityIau2006State(jdTT);
  const rx = rotationX(obliquity.value);
  const rxRate = rotationXRate(obliquity.value, obliquity.rate);
  const fixedInverse = transpose(J2000_ECLIPTIC_STATE);
  return {
    matrix: multiply(multiply(rx, precession.matrix), fixedInverse),
    rate: multiply(addMatrices(multiply(rxRate, precession.matrix), multiply(rx, precession.rate)), fixedInverse),
  };
}

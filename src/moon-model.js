import { MOON_L, MOON_B, MOON_R, MOON_W1, MOON_PRECESSION_P, MOON_PRECESSION_Q, MOON_SCALE_DAYS, MOON_ARGUMENTS } from './moon-series.js';
const SERIES = [MOON_L, MOON_B, MOON_R];
const ranked = SERIES.map(blocks => blocks.flatMap((rows, power) => Array.from({ length: rows.length / 3 }, (_, i) => ({ rows, index: i * 3, power, score: Math.hypot(rows[i * 3], rows[i * 3 + 1]) }))).sort((a, b) => b.score - a.score));
// Synchronous evaluator scratch storage, refreshed per call. No date memoization.
const sine = new Float64Array(MOON_ARGUMENTS.length), cosine = new Float64Array(MOON_ARGUMENTS.length), speed = new Float64Array(MOON_ARGUMENTS.length), stamps = new Uint32Array(MOON_ARGUMENTS.length);
let serial = 0;
function begin() { serial = (serial + 1) >>> 0; if (serial === 0) {
    stamps.fill(0);
    serial = 1;
} }
function polynomialState(coefficients, x, xRate) {
    let value = 0, rate = 0;
    for (let i = coefficients.length - 1; i >= 0; --i) {
        rate = rate * x + value;
        value = value * x + coefficients[i];
    }
    return { value, rate: rate * xRate };
}
function argument(k, x) {
    if (stamps[k] === serial)
        return;
    const p = MOON_ARGUMENTS[k];
    let a = p[7], d = a;
    a = a * x + p[6];
    d = d * x + a;
    a = a * x + p[5];
    d = d * x + a;
    a = a * x + p[4];
    d = d * x + a;
    a = a * x + p[3];
    d = d * x + a;
    a = a * x + p[2];
    d = d * x + a;
    a = a * x + p[1];
    d = d * x + a;
    a = a * x + p[0];
    d = d * x + a;
    a *= x;
    sine[k] = Math.sin(a);
    cosine[k] = Math.cos(a);
    speed[k] = d / MOON_SCALE_DAYS;
    stamps[k] = serial;
}
function coordinate(c, x, limit = 'full') {
    let value = 0, rate = 0;
    if (limit === 'full') {
        for (let power = 0; power < SERIES[c].length; ++power) {
            const rows = SERIES[c][power];
            let sum = 0, derivative = 0;
            for (let i = 0; i < rows.length; i += 3) {
                const k = rows[i + 2];
                argument(k, x);
                sum += rows[i] * sine[k] + rows[i + 1] * cosine[k];
                derivative += (rows[i] * cosine[k] - rows[i + 1] * sine[k]) * speed[k];
            }
            const env = x ** power, dr = power === 0 ? 0 : power * x ** (power - 1) / MOON_SCALE_DAYS;
            value += sum * env;
            rate += derivative * env + sum * dr;
        }
    }
    else {
        if (!Number.isInteger(limit) || limit < 0 || limit > ranked[c].length)
            throw new RangeError('Invalid lunar term limit');
        for (let i = 0; i < limit; ++i) {
            const { rows, index, power } = ranked[c][i], k = rows[index + 2];
            argument(k, x);
            const v = rows[index] * sine[k] + rows[index + 1] * cosine[k], dv = (rows[index] * cosine[k] - rows[index + 1] * sine[k]) * speed[k];
            const env = x ** power, dr = power === 0 ? 0 : power * x ** (power - 1) / MOON_SCALE_DAYS;
            value += v * env;
            rate += dv * env + v * dr;
        }
    }
    if (c === 0) {
        const m = polynomialState(MOON_W1, x, 1 / MOON_SCALE_DAYS);
        value += m.value;
        rate += m.rate;
    }
    return { value, rate };
}
export function moonSeriesLongitudeState(jd, termCount = 'full') {
    if (!Number.isFinite(jd))
        throw new TypeError('jdTT must be finite');
    begin();
    return coordinate(0, (jd - 2451545) / MOON_SCALE_DAYS, termCount);
}
function precession(t) {
    const tRate = 1 / 36525, pp = polynomialState(MOON_PRECESSION_P, t, tRate), qq = polynomialState(MOON_PRECESSION_Q, t, tRate);
    const p = pp.value * t, q = qq.value * t, dp = pp.rate * t + pp.value * tRate, dq = qq.rate * t + qq.value * tRate;
    const s = 1 - p * p - q * q;
    if (s < 0)
        throw new RangeError('ELP P/Q rotation is outside its real-valued domain');
    const r = 2 * Math.sqrt(s), dr = -2 * (p * dp + q * dq) / Math.sqrt(s);
    return { matrix: [[1 - 2 * p * p, 2 * p * q, p * r], [2 * p * q, 1 - 2 * q * q, -q * r], [-p * r, q * r, 1 - 2 * p * p - 2 * q * q]],
        rate: [[-4 * p * dp, 2 * (dp * q + p * dq), dp * r + p * dr], [2 * (dp * q + p * dq), -4 * q * dq, -dq * r - q * dr], [-dp * r - p * dr, dq * r + q * dr, -4 * p * dp - 4 * q * dq]] };
}
function state(jd, latitudeTerms, direction) {
    if (!Number.isFinite(jd))
        throw new TypeError('jdTT must be finite');
    begin();
    const x = (jd - 2451545) / MOON_SCALE_DAYS;
    const l = coordinate(0, x), b = coordinate(1, x, latitudeTerms), r = direction ? { value: 1, rate: 0 } : coordinate(2, x);
    const cl = Math.cos(l.value), sl = Math.sin(l.value), cb = Math.cos(b.value), sb = Math.sin(b.value), rc = r.value * cb;
    const drc = r.rate * cb - r.value * sb * b.rate;
    const p = [rc * cl, rc * sl, r.value * sb], v = [drc * cl - rc * sl * l.rate, drc * sl + rc * cl * l.rate, r.rate * sb + r.value * cb * b.rate];
    const frame = precession(x * 80);
    const apply = (m, v) => m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
    const position = apply(frame.matrix, p), sv = apply(frame.matrix, v), fv = apply(frame.rate, p);
    return { position, velocity: sv.map((v, i) => v + fv[i]) };
}
export function moonState(jd) { return state(jd, 'full', false); }
export function moonDirectionState(jd, { latitudeTerms = 'full' } = {}) { return state(jd, latitudeTerms, true); }
export function moonPosition(jd) { return moonState(jd).position; }
/** Native ELP-frame longitude and rate; global calibration is part of the table. */
export function moonElpLongitudeState(jd) { return moonSeriesLongitudeState(jd); }

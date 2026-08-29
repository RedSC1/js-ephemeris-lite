// Value-only calendar evaluators. Coefficients and frames match the state APIs;
// derivative accumulation and lunar distance are deliberately skipped.
import { meanEclipticOfDateMatrix, iau2000bNutationLongitude as nutationLongitude } from './coordinates.js';
import { LOW_SOLAR_DRIFT, LOW_ELONGATION_DRIFT, FAST_EARTH_RADIUS_TERMS } from './event-series.js';
import { EARTH_L, EARTH_B, EARTH_R } from './planet-series.js';
import { earthModel } from './planet-models.js';
import { planetTheoryToJ2000 } from './planet-frame.js';
import { MOON_L, MOON_B, MOON_W1, MOON_ARGUMENTS, MOON_PRECESSION_P, MOON_PRECESSION_Q } from './moon-series.js';
const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
const apply = (m, v) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
function polynomial(a, x) { let v = 0; for (let i = a.length - 1; i >= 0; i--)
    v = v * x + a[i]; return v; }
const earthDegree = Math.max(EARTH_L.length, EARTH_B.length, EARTH_R.length) - 1;
const earthGroups = [EARTH_L, EARTH_B, EARTH_R].flatMap((blocks, c) => blocks.map((a, n) => ({ c, n, a })));
function earthNativeValue(jd, limits, coordinates = [0, 1, 2]) {
    const x = (jd - 2451545) / 2922000, tau = (jd - 2451545) / 365250;
    const degree = earthDegree;
    const b = new Float64Array(degree + 1);
    b[0] = 1;
    b[1] = x;
    for (let n = 2; n <= degree; n++)
        b[n] = 2 * x * b[n - 1] - b[n - 2];
    for (let n = 2; n <= degree; n += 2)
        b[n] -= (-1) ** (n / 2);
    const values = [0, 0, 0];
    for (const { c, n, a } of earthGroups) {
        if (!coordinates.includes(c) || limits?.[c] !== undefined)
            continue;
        let sum = 0;
        for (let i = 0; i < a.length; i += 3)
            sum += a[i] * Math.cos(a[i + 1] + a[i + 2] * tau);
        values[c] += b[n] * sum;
    }
    if (limits)
        for (const c of coordinates) {
            if (limits[c] === undefined)
                continue;
            for (const { degree: n, index: i, coefficients: a } of earthModel.ranked[c].slice(0, limits[c] ?? Infinity))
                values[c] += b[n] * (a[i] * Math.cos(a[i + 1] + a[i + 2] * tau));
        }
    values[0] = wrap(values[0]);
    return values;
}
function earthPosition(jd, limits) { const [l, b, r] = earthNativeValue(jd, limits); const cl = Math.cos(l), sl = Math.sin(l), cb = Math.cos(b), sb = Math.sin(b); return planetTheoryToJ2000([r * cb * cl, r * cb * sl, r * sb]); }
const moonSeries = [MOON_L, MOON_B];
const ranked = moonSeries.map(blocks => blocks.flatMap((rows, power) => Array.from({ length: rows.length / 3 }, (_, i) => ({ rows, index: i * 3, power, score: Math.hypot(rows[i * 3], rows[i * 3 + 1]) }))).sort((a, b) => b.score - a.score));
// Synchronous per-call scratch space; no date/result memoization.
const sine = new Float64Array(MOON_ARGUMENTS.length), cosine = new Float64Array(MOON_ARGUMENTS.length), stamps = new Uint32Array(MOON_ARGUMENTS.length);
let serial = 0;
function begin() { serial = (serial + 1) >>> 0; if (!serial) {
    stamps.fill(0);
    serial = 1;
} }
function argument(k, x) { if (stamps[k] === serial)
    return; const p = MOON_ARGUMENTS[k]; let a = p[7]; a = a * x + p[6]; a = a * x + p[5]; a = a * x + p[4]; a = a * x + p[3]; a = a * x + p[2]; a = a * x + p[1]; a = a * x + p[0]; a *= x; sine[k] = Math.sin(a); cosine[k] = Math.cos(a); stamps[k] = serial; }
function coordinate(c, x, limit = 'full') {
    let value = 0;
    if (limit === 'full') {
        for (let power = 0; power < moonSeries[c].length; power++) {
            const rows = moonSeries[c][power];
            let sum = 0;
            for (let i = 0; i < rows.length; i += 3) {
                const k = rows[i + 2];
                argument(k, x);
                sum += rows[i] * sine[k] + rows[i + 1] * cosine[k];
            }
            value += sum * x ** power;
        }
    }
    else {
        if (!Number.isInteger(limit) || limit < 0 || limit > ranked[c].length)
            throw new RangeError('Invalid lunar term limit');
        for (let i = 0; i < limit; i++) {
            const { rows, index, power } = ranked[c][i], k = rows[index + 2];
            argument(k, x);
            value += (rows[index] * sine[k] + rows[index + 1] * cosine[k]) * x ** power;
        }
    }
    if (c === 0)
        value += polynomial(MOON_W1, x);
    return value;
}
function moonNativeLongitude(jd, terms = 'full') { begin(); return coordinate(0, (jd - 2451545) / 2922000, terms); }
function moonDirection(jd, latitudeTerms = 'full', longitudeTerms = 'full') {
    begin();
    const x = (jd - 2451545) / 2922000, l = coordinate(0, x, longitudeTerms), b = coordinate(1, x, latitudeTerms), cb = Math.cos(b), p0 = [cb * Math.cos(l), cb * Math.sin(l), Math.sin(b)];
    const t = x * 80, p = polynomial(MOON_PRECESSION_P, t) * t, q = polynomial(MOON_PRECESSION_Q, t) * t, r = 2 * Math.sqrt(1 - p * p - q * q);
    return apply([[1 - 2 * p * p, 2 * p * q, p * r], [2 * p * q, 1 - 2 * q * q, -q * r], [-p * r, q * r, 1 - 2 * p * p - 2 * q * q]], p0);
}
const aberration = 20.4898 * Math.PI / 648000;
export function solarLongitude(jd, fast = false) { const earth = earthPosition(jd, fast ? { 2: FAST_EARTH_RADIUS_TERMS } : undefined), v = apply(meanEclipticOfDateMatrix(jd), earth.map(x => -x)); return Math.atan2(v[1], v[0]) + nutationLongitude(jd) - aberration / Math.hypot(...earth); }
export function elongation(jd, latitudeTerms = 'full', fast = false) {
    const frame = meanEclipticOfDateMatrix(jd), m = apply(frame, moonDirection(jd, latitudeTerms)), earth = earthPosition(jd, fast ? { 2: FAST_EARTH_RADIUS_TERMS } : undefined), s = apply(frame, earth.map(x => -x));
    return wrap(Math.atan2(m[1], m[0]) - Math.atan2(s[1], s[0]) - 3.4e-6 + aberration / Math.hypot(...earth));
}
// Intermediate correction only: Earth B0/R3. Main values retain full L/B/R30.
export function mediumElongation(jd, latitudeTerms, earthTerms, moonTerms) {
    const frame = meanEclipticOfDateMatrix(jd), m = apply(frame, moonDirection(jd, latitudeTerms, moonTerms)), earth = earthPosition(jd, { 0: earthTerms, 1: 0, 2: 3 }), s = apply(frame, earth.map(x => -x));
    return wrap(Math.atan2(m[1], m[0]) - Math.atan2(s[1], s[0]) - 3.4e-6 + aberration / Math.hypot(...earth));
}
function drift(a, jd) { const x = (jd - 2451545) / 2922000; let t0 = 1, t1 = x, v = a[0] ?? 0; if (a.length > 1)
    v += a[1] * x; for (let i = 2; i < a.length; i++) {
    const t = 2 * x * t1 - t0;
    v += a[i] * t;
    t0 = t1;
    t1 = t;
} return v; }
export function lowSolarValue(jd, withDrift = true) {
    const earth = earthPosition(jd, { 0: 10, 1: 0, 2: 3 });
    const p = meanEclipticOfDateMatrix(jd).map(r => -(r[0] * earth[0] + r[1] * earth[1] + r[2] * earth[2]));
    return Math.atan2(p[1], p[0]) + nutationLongitude(jd, 10) - 20.4898 * Math.PI / 648000 / Math.hypot(...earth) + (withDrift ? drift(LOW_SOLAR_DRIFT, jd) : 0);
}
export function lowPhaseValue(jd) { return wrap(moonNativeLongitude(jd, 10) - lowSolarValue(jd, false) - 3.4e-6 + drift(LOW_ELONGATION_DRIFT, jd)); }

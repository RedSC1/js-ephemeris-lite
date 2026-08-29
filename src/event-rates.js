// Approximate Newton slopes in rad/day, never public physical state velocities.
// Earth: secular + two native frequency groups; date-frame spin: degree-12
// compression of Vondrak 2011; nutation: four IAU 2000B terms. Moon: ten L terms
// initially, then forty L terms and eight Earth frequency groups near the root.
import { IAU2000B_TERMS } from './nutation-series.js';
import { MOON_L, MOON_W1, MOON_ARGUMENTS } from './moon-series.js';
import { LOW_SOLAR_RATE_SECULAR, LOW_SOLAR_RATE_HARMONICS, LOW_PRECESSION_RATE } from './event-series.js';
import { REFINE_EARTH_RATE_SECULAR, REFINE_EARTH_RATE_HARMONICS } from './event-series.js';
const scale = 2922000, arc = Math.PI / 648000;
function polynomial(a, x) { let value = 0, rate = 0; for (let i = a.length - 1; i >= 0; i--) {
    rate = rate * x + value;
    value = value * x + a[i];
} return { value, rate: rate / scale }; }
const definitions = [[485868.249036, 1717915923.2178], [1287104.79305, 129596581.0481], [335779.526232, 1739527262.8478], [1072260.70369, 1602961601.2090], [450160.398036, -6962890.5431]];
const nutation = IAU2000B_TERMS.slice(0, 4).map(row => {
    let phase = 0, speed = 0;
    for (let i = 0; i < 5; i++) {
        phase += row[i] * definitions[i][0];
        speed += row[i] * definitions[i][1];
    }
    return [phase * arc, speed * arc, row[5] * 1e-7 * arc, row[6] * 1e-7 * arc, row[7] * 1e-7 * arc];
});
function nutationRate4(jd) {
    const t = (jd - 2451545) / 36525;
    let rate = 0;
    for (const [p, f, a, b, c] of nutation) {
        const arg = p + f * t;
        rate += (b * Math.sin(arg) + (a + b * t) * f * Math.cos(arg) - c * f * Math.sin(arg)) / 36525;
    }
    return rate;
}
function precessionRate(jd) { return polynomial(LOW_PRECESSION_RATE, (jd - 2451545) / scale).value; }
function earthNativeRate(jd, harmonics = 2) {
    const x = (jd - 2451545) / scale, tau = (jd - 2451545) / 365250;
    let rate = polynomial(LOW_SOLAR_RATE_SECULAR, x).rate;
    for (let i = 0; i < harmonics; i++) {
        const [frequency, cos, sin] = LOW_SOLAR_RATE_HARMONICS[i], c = polynomial(cos, x), s = polynomial(sin, x), p = frequency * tau, cp = Math.cos(p), sp = Math.sin(p);
        rate += c.rate * cp + s.rate * sp + frequency / 365250 * (s.value * cp - c.value * sp);
    }
    return rate;
}
export const solarRate2 = jd => earthNativeRate(jd, 2) + precessionRate(jd) + nutationRate4(jd);
const moon = MOON_L.flatMap((rows, n) => Array.from({ length: rows.length / 3 }, (_, i) => [n, ...rows.slice(i * 3, i * 3 + 3)])).sort((a, b) => Math.hypot(b[1], b[2]) - Math.hypot(a[1], a[2])).slice(0, 40);
function moonNativeRate(jd, termCount = 10) {
    const x = (jd - 2451545) / scale;
    let rate = polynomial(MOON_W1, x).rate;
    for (let i = 0; i < termCount; i++) {
        const [n, s, c, k] = moon[i];
        const p = MOON_ARGUMENTS[k];
        let a = p[7], d = a;
        for (let i = 6; i >= 0; i--) {
            a = a * x + p[i];
            d = d * x + a;
        }
        a *= x;
        const sn = Math.sin(a), cs = Math.cos(a);
        rate += (s * cs - c * sn) * d / scale * x ** n + (n === 0 ? 0 : n * x ** (n - 1) / scale * (s * sn + c * cs));
    }
    return rate;
}
// Common precession spin and nutation cancel in the elongation estimate.
// Frame tilt and small periodic rate terms remain omitted approximations.
export const elongationRate2 = jd => moonNativeRate(jd) - earthNativeRate(jd, 2);

// Evaluated once near the root, after the intermediate position correction.
// These remain approximate slopes, not public physical angular velocities.
function earthRefineRate(jd, count) {
    const x = (jd - 2451545) / scale;
    let rate = polynomial(REFINE_EARTH_RATE_SECULAR, x).rate;
    for (let i = 0; i < count; i++) {
        const [f, cos, sin] = REFINE_EARTH_RATE_HARMONICS[i];
        const c = polynomial(cos, x), s = polynomial(sin, x), p = f * x * 8;
        const cp = Math.cos(p), sp = Math.sin(p);
        rate += c.rate * cp + s.rate * sp + f / 365250 * (s.value * cp - c.value * sp);
    }
    return rate;
}
export const elongationRefineRate = jd => moonNativeRate(jd, 40) - earthRefineRate(jd, 8);

// Compact value-only evaluators for the fixed-stage fast event solvers.
import { EARTH_L, EARTH_B, EARTH_R } from './planet-series.js';
import { EARTH_L_PREFIX_COUNTS, EARTH_B_PREFIX_COUNTS, EARTH_R_PREFIX_COUNTS } from './earth-prefix-counts.js';
import { MOON_L, MOON_B, MOON_W1, MOON_ARGUMENTS } from './moon-series.js';
import { iau2000bNutationLongitude } from './coordinates.js';
import { FAST_EVENT_FRAME_PROJECTION as FRAMES } from './event-series.js';

function selectMoonTerms(blocks, limits) {
  const ranked = blocks.flatMap((rows, power) =>
    Array.from({ length: rows.length / 3 }, (_, term) => ({
      power,
      index: term * 3,
      score: Math.hypot(rows[term * 3], rows[term * 3 + 1]),
    }))).sort((a, b) => b.score - a.score);

  return Object.fromEntries(limits.map(limit => {
    const chosen = new Set(ranked.slice(0, limit === 'full' ? Infinity : limit)
      .map(({ power, index }) => `${power}:${index}`));
    return [limit, blocks.map((rows, power) => {
      const packed = [];
      for (let index = 0; index < rows.length; index += 3) {
        if (!chosen.has(`${power}:${index}`)) continue;
        const amplitude = Math.hypot(rows[index], rows[index + 1]);
        packed.push(amplitude, -Math.atan2(rows[index], rows[index + 1]), ...MOON_ARGUMENTS[rows[index + 2]]);
      }
      return packed;
    })];
  }));
}

const EARTH = [EARTH_L, EARTH_B, EARTH_R];
const EARTH_PREFIX_COUNTS = [EARTH_L_PREFIX_COUNTS, EARTH_B_PREFIX_COUNTS, EARTH_R_PREFIX_COUNTS];
const MOON = [MOON_L, MOON_B].map((blocks, coordinate) =>
  selectMoonTerms(blocks, coordinate === 0 ? [8, 33, 'full'] : [0, 10]));
const EARTH_DEGREE = Math.max(EARTH_L.length, EARTH_B.length, EARTH_R.length) - 1;
const J2000 = 2451545;
const SCALE_DAYS = 2922000;
const ABERRATION = 20.4898 * Math.PI / 648000;

export const wrap = angle => angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));

function polynomial(coefficients, x) {
  let value = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) value = value * x + coefficients[i];
  return value;
}

function earthValues(jd, longitudeTerms, latitudeTerms, radiusTerms) {
  const tau = (jd - J2000) / 365250;
  const basis = new Float64Array(EARTH_DEGREE + 1);
  basis[0] = 1;
  for (let power = 1; power < basis.length; power++) basis[power] = basis[power - 1] * tau;

  const limits = [longitudeTerms, latitudeTerms, radiusTerms];
  const values = [0, 0, 0];
  for (let coordinate = 0; coordinate < 3; coordinate++) {
    const blocks = EARTH[coordinate];
    const counts = limits[coordinate] === 'full' ? null : EARTH_PREFIX_COUNTS[coordinate][limits[coordinate]];
    if (limits[coordinate] !== 'full' && !counts)
      throw new RangeError(`Unsupported Earth prefix ${limits[coordinate]} for coordinate ${coordinate}`);

    for (let power = 0; power < blocks.length; power++) {
      const rows = blocks[power];
      const end = counts ? Math.min((counts[power] ?? 0) * 3, rows.length) : rows.length;
      let sum = 0;
      for (let i = 0; i < end; i += 3)
        sum += rows[i] * Math.cos(rows[i + 1] + rows[i + 2] * tau);
      values[coordinate] += sum * basis[power];
    }
  }
  return values;
}

function moonValues(jd, longitudeTerms, latitudeTerms) {
  const x = (jd - J2000) / SCALE_DAYS;
  const powers = new Float64Array(9);
  powers[0] = 1;
  for (let i = 1; i < powers.length; i++) powers[i] = powers[i - 1] * x;

  const values = [0, 0];
  for (let coordinate = 0; coordinate < 2; coordinate++) {
    const blocks = MOON[coordinate][coordinate === 0 ? longitudeTerms : latitudeTerms];
    for (let power = 0; power < blocks.length; power++) {
      const rows = blocks[power];
      let sum = 0;
      for (let i = 0; i < rows.length; i += 10) {
        let argument = rows[i + 9];
        for (let coefficient = i + 8; coefficient >= i + 2; coefficient--)
          argument = argument * x + rows[coefficient];
        argument *= x;
        sum += rows[i] * Math.cos(argument + rows[i + 1]);
      }
      values[coordinate] += sum * powers[power];
    }
  }
  values[0] += polynomial(MOON_W1, x);
  return values;
}

// Offline polynomial projection of the same native-to-date rotations. Both
// latitude columns remain present; the common cos(B) cancels in atan2(Y, X).
function longitude(values, x, offset) {
  const cosLongitude = Math.cos(values[0]);
  const sinLongitude = Math.sin(values[0]);
  const tanLatitude = Math.tan(values[1]);
  const component = row => polynomial(FRAMES[offset + row], x);
  return Math.atan2(
    component(3) * cosLongitude + component(4) * sinLongitude + component(5) * tanLatitude,
    component(0) * cosLongitude + component(1) * sinLongitude + component(2) * tanLatitude,
  );
}

export function fastSolarLongitude(jd, longitudeTerms = 'full', nutationTerms = 10,
  latitudeTerms = 'full', radiusTerms = 30) {
  const earth = earthValues(jd, longitudeTerms, latitudeTerms, radiusTerms);
  return wrap(longitude(earth, (jd - J2000) / SCALE_DAYS, 0) + Math.PI)
    + iau2000bNutationLongitude(jd, nutationTerms) - ABERRATION / earth[2];
}

export function fastElongation(jd, moonLongitudeTerms = 'full', earthLongitudeTerms = 129,
  moonLatitudeTerms = 10, earthLatitudeTerms = 'full', earthRadiusTerms = 30) {
  const earth = earthValues(jd, earthLongitudeTerms, earthLatitudeTerms, earthRadiusTerms);
  const moon = moonValues(jd, moonLongitudeTerms, moonLatitudeTerms);
  const x = (jd - J2000) / SCALE_DAYS;
  return wrap(longitude(moon, x, 6) - longitude(earth, x, 0) - Math.PI - 3.4e-6 + ABERRATION / earth[2]);
}

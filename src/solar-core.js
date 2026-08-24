import {
  ARCSEC_TO_RAD,
  J2000,
  iau2000bNutation,
  meanEclipticOfDateMatrixState,
} from './coordinates.js';
import { earthState } from './ephemeris.js';

const TWO_PI = 2 * Math.PI;

export function normalizeRadians(value) {
  return ((value % TWO_PI) + TWO_PI) % TWO_PI;
}

export function normalizeSignedRadians(value) {
  const normalized = normalizeRadians(value + Math.PI) - Math.PI;
  return normalized === -Math.PI ? Math.PI : normalized;
}

function transform(matrix, vector) {
  return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

export function greenwichMeanSiderealTimeRadians(jdUT1, jdTT) {
  const era = TWO_PI * (0.7790572732640 + 1.00273781191135448 * (jdUT1 - J2000));
  const t = (jdTT - J2000) / 36525;
  const gmstMinusEraArcsec = 0.014506
    + 4612.156534 * t
    + 1.3915817 * t ** 2
    - 0.00000044 * t ** 3
    - 0.000029956 * t ** 4
    - 0.0000000368 * t ** 5;
  return normalizeRadians(era + gmstMinusEraArcsec * ARCSEC_TO_RAD);
}

export function greenwichApparentSiderealTimeRadians(jdUT1, jdTT, nutation) {
  return normalizeRadians(greenwichMeanSiderealTimeRadians(jdUT1, jdTT)
    + nutation.dpsi * Math.cos(nutation.trueObliquity));
}

/** Shared apparent geocentric Sun used by solar time and visibility. */
export function apparentSunEquatorial(jdTT) {
  const earth = earthState(jdTT);
  const meanDate = transform(
    meanEclipticOfDateMatrixState(jdTT).matrix,
    earth.position.map(value => -value),
  );
  const distance = Math.hypot(...meanDate);
  const latitude = Math.asin(Math.max(-1, Math.min(1, meanDate[2] / distance)));
  const geometricLongitude = Math.atan2(meanDate[1], meanDate[0]);
  const nutation = iau2000bNutation(jdTT);
  const longitude = geometricLongitude - 20.4898 * ARCSEC_TO_RAD / distance + nutation.dpsi;
  const cosLat = Math.cos(latitude);
  const cosLon = Math.cos(longitude);
  const sinLon = Math.sin(longitude);
  const cosEps = Math.cos(nutation.trueObliquity);
  const sinEps = Math.sin(nutation.trueObliquity);
  return {
    position: [
      distance * cosLat * cosLon,
      distance * (cosLat * sinLon * cosEps - Math.sin(latitude) * sinEps),
      distance * (cosLat * sinLon * sinEps + Math.sin(latitude) * cosEps),
    ],
    nutation,
  };
}

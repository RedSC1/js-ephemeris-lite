import { AU_KM } from './ephemeris.js';
import { apparentBodyPosition, greenwichSiderealTime, validateSkyBody } from './apparent.js';
import { BODY_DISC_RADIUS_KM } from './phenomena.js';
import { hybridAtmosphericRefraction } from './solar-visibility.js';
import { searchCrossings } from './event-search.js';
import { ut1ToTt } from './time.js';
import { DEG, RAD, clamp, finite, normDeg, signedDeg, spherical, sub } from './sky-math.js';

function observerSettings(observer) {
  if (!observer || !Number.isFinite(observer.longitudeDeg) || Math.abs(observer.longitudeDeg) > 180
    || !Number.isFinite(observer.latitudeDeg) || Math.abs(observer.latitudeDeg) > 90) {
    throw new RangeError('observer requires longitudeDeg ±180 and latitudeDeg ±90');
  }
  const heightMeters = observer.heightMeters ?? 0;
  const pressureMbar = observer.pressureMbar ?? 1013.25;
  const temperatureCelsius = observer.temperatureCelsius ?? 15;
  finite(heightMeters, 'heightMeters'); finite(pressureMbar, 'pressureMbar');
  finite(temperatureCelsius, 'temperatureCelsius');
  if (heightMeters <= -6370000 || pressureMbar < 0 || temperatureCelsius <= -273) {
    throw new RangeError('invalid height or atmosphere');
  }
  return { ...observer, heightMeters, pressureMbar, temperatureCelsius };
}

/** Topocentric true equatorial coordinates and north-through-east azimuth.
 * No polar motion, diurnal aberration, terrain or horizon-dip model. */
export function bodyHorizontalPosition(body, jdUT1, rawObserver, options = {}) {
  finite(jdUT1, 'jdUT1');
  const observer = observerSettings(rawObserver);
  if (options.apparent?.frame && options.apparent.frame !== 'true-of-date') {
    throw new RangeError('horizontal coordinates require true-of-date axes');
  }
  const jdTT = ut1ToTt(jdUT1);
  const position = apparentBodyPosition(body, jdTT, { ...options.apparent, frame: 'true-of-date' });
  const sidereal = (greenwichSiderealTime(jdUT1, jdTT) + observer.longitudeDeg) * DEG;
  const latitude = observer.latitudeDeg * DEG;
  const sinLat = Math.sin(latitude), cosLat = Math.cos(latitude);
  const n = 6378137 / Math.sqrt(1 - 6.69437999014e-3 * sinLat * sinLat);
  const rho = (n + observer.heightMeters) * cosLat / (AU_KM * 1000);
  const z = (n * (1 - 6.69437999014e-3) + observer.heightMeters) * sinLat / (AU_KM * 1000);
  // Site and target use the SAME true equator/equinox (GAST, not GMST).
  const site = [rho * Math.cos(sidereal), rho * Math.sin(sidereal), z];
  const topocentric = spherical(sub(position.equatorialPositionAu, site));
  const hourAngleDeg = signedDeg(sidereal * RAD - topocentric.longitudeDeg);
  const h = hourAngleDeg * DEG, dec = topocentric.latitudeDeg * DEG;
  const altitude = Math.asin(clamp(sinLat * Math.sin(dec) + cosLat * Math.cos(dec) * Math.cos(h)));
  const azimuth = Math.atan2(-Math.cos(dec) * Math.sin(h),
    Math.sin(dec) * cosLat - Math.cos(dec) * sinLat * Math.cos(h));
  const refraction = options.refraction === false ? 0 : hybridAtmosphericRefraction(altitude, observer);
  return {
    body, jdUT1, jdTT, azimuthDeg: normDeg(azimuth * RAD),
    geometricAltitudeDeg: altitude * RAD, apparentAltitudeDeg: (altitude + refraction) * RAD,
    rightAscensionDeg: topocentric.longitudeDeg, declinationDeg: topocentric.latitudeDeg,
    distanceAu: topocentric.distanceAu, hourAngleDeg,
  };
}

/** Exact input interval is [dayStartUT1,dayStartUT1+1), not an implicit
 * timezone or longitude-derived day. Returns all crossings in that interval. */
export function bodyRiseSetForDay(body, dayStartUT1, observer, options = {}) {
  validateSkyBody(body); finite(dayStartUT1, 'dayStartUT1');
  const atmosphere = observerSettings(observer);
  const end = dayStartUT1 + 1;
  const horizon = options.horizonDegrees ?? 0;
  finite(horizon, 'horizonDegrees');
  if (Math.abs(horizon) > 90) throw new RangeError('horizonDegrees must be within ±90');
  const limb = options.limb ?? 'upper';
  if (!['upper', 'center', 'lower'].includes(limb)) throw new RangeError('invalid limb');
  const limbSign = limb === 'upper' ? 1 : limb === 'lower' ? -1 : 0;
  const cache = new Map();
  const at = t => {
    if (!cache.has(t)) cache.set(t, bodyHorizontalPosition(body, t, observer, options));
    return cache.get(t);
  };
  const altitude = t => {
    const p = at(t);
    const radius = Math.asin(clamp(BODY_DISC_RADIUS_KM[body] / AU_KM / p.distanceAu)) * RAD;
    // The ray at the selected limb has its own refraction, especially near
    // the horizon; refracting the centre first shifts solar/lunar events.
    const geometricLimb = p.geometricAltitudeDeg + limbSign * radius;
    const refraction = options.refraction === false ? 0
      : hybridAtmosphericRefraction(geometricLimb * DEG, atmosphere) * RAD;
    return geometricLimb + refraction - horizon;
  };
  // Add refined local extrema to the scan grid. This catches two crossings
  // near a grazing rise/set that can both fit between ordinary samples.
  const samples = Array.from({ length: 145 }, (_, i) => ({ time: dayStartUT1 + i / 144, value: 0 }));
  for (const p of samples) p.value = altitude(p.time);
  const extrema = [];
  for (let i = 1; i < 144; i++) {
    const a = samples[i - 1], b = samples[i], c = samples[i + 1];
    if ((b.value - a.value) * (c.value - b.value) >= 0) continue;
    const sign = b.value > a.value ? 1 : -1;
    let left = a.time, right = c.time;
    for (let j = 0; j < 40 && right - left > 1e-8; j++) {
      const x = left + (right - left) / 3, y = right - (right - left) / 3;
      if (altitude(x) * sign < altitude(y) * sign) left = x; else right = y;
    }
    const time = (left + right) / 2;
    extrema.push({ time, value: altitude(time) });
  }
  const grid = [...samples, ...extrema].sort((a, b) => a.time - b.time);
  const rises = [], sets = [];
  for (let i = 0; i < grid.length - 1; i++) {
    if (grid[i + 1].time - grid[i].time <= 1e-8) continue;
    const roots = searchCrossings(altitude, grid[i].time, grid[i + 1].time, { stepDays: 1 / 144 });
    for (const root of roots) {
      // Reject discontinuities (e.g. the refraction model's low-altitude cutoff).
      if (Math.abs(root.residual) > 1e-4) continue;
      const list = altitude(root.time + 1e-5) > altitude(root.time - 1e-5) ? rises : sets;
      if (!list.length || root.time - list.at(-1) > 1e-7) list.push(root.time);
    }
  }
  const transits = searchCrossings(t => Math.sin(at(t).hourAngleDeg * DEG), dayStartUT1, end, { stepDays: 1 / 24 });
  const min = Math.min(...grid.map(p => p.value)), max = Math.max(...grid.map(p => p.value));
  const altitudeState = rises.length || sets.length ? 'crosses'
    : extrema.some(p => Math.abs(p.value) < 1e-5) ? 'tangent'
    : min > 0 ? 'always-above' : max < 0 ? 'always-below' : 'not-found';
  return {
    body, dayStartUT1, dayEndUT1: end, altitudeState, rises, sets,
    upperTransits: transits.filter(p => Math.cos(at(p.time).hourAngleDeg * DEG) > 0).map(p => p.time),
    lowerTransits: transits.filter(p => Math.cos(at(p.time).hourAngleDeg * DEG) < 0).map(p => p.time),
    limb, refraction: options.refraction !== false,
  };
}

import { PLANET_EPOCH_JD, PLANET_PHASE_DAYS } from './planet-series.js';
import { planetTheoryToJ2000 } from './planet-frame.js';

export function legendreBasis(x, degree, scaleDays) {
  const basis = new Float64Array(degree + 1);
  const derivative = new Float64Array(degree + 1);
  basis[0] = 1;
  if (degree > 0) {
    basis[1] = x;
    derivative[1] = 1 / scaleDays;
  }
  for (let n = 2; n <= degree; n++) {
    basis[n] = ((2 * n - 1) * x * basis[n - 1] - (n - 1) * basis[n - 2]) / n;
    derivative[n] = ((2 * n - 1) * (basis[n - 1] / scaleDays + x * derivative[n - 1])
      - (n - 1) * derivative[n - 2]) / n;
  }
  return { basis, derivative };
}

export function monomialBasis(x, degree, scaleDays) {
  const basis = new Float64Array(degree + 1);
  const derivative = new Float64Array(degree + 1);
  basis[0] = 1;
  for (let n = 1; n <= degree; n++) {
    basis[n] = basis[n - 1] * x;
    derivative[n] = n * basis[n - 1] / scaleDays;
  }
  return { basis, derivative };
}

/** Bare Fourier/polynomial LBR arrays; basis and time scale are fixed by the caller. */
export function createDirectPlanetModel(L, B, R, {
  evaluateBasis = monomialBasis,
  prefixCounts,
  accuracyLimits,
  scaleDays = PLANET_PHASE_DAYS,
} = {}) {
  const coordinateGroups = [L, B, R].map((axis, coordinate) =>
    axis.map((coefficients, degree) => ({ coordinate, degree, coefficients })));
  const groups = coordinateGroups.flat();
  const degree = Math.max(L.length, B.length, R.length) - 1;
  const MILLENNIUM_DAYS = PLANET_PHASE_DAYS;

  /** Direct LBR series, without orbital-element conversion at runtime. */
  function nativeState(jd, coordinates, limits) {
    const tau = (jd - PLANET_EPOCH_JD) / MILLENNIUM_DAYS;
    const x = (jd - PLANET_EPOCH_JD) / scaleDays;
    const { basis, derivative } = evaluateBasis(x, degree, scaleDays);
    const values = [0, 0, 0];
    const rates = [0, 0, 0];
    for (const group of groups) {
      if (!coordinates.includes(group.coordinate) || limits?.[group.coordinate] !== undefined) continue;
      let value = 0;
      let rate = 0;
      const coefficients = group.coefficients;
      for (let i = 0; i < coefficients.length; i += 3) {
        const amplitude = coefficients[i];
        const frequency = coefficients[i + 2];
        const argument = coefficients[i + 1] + frequency * tau;
        value += amplitude * Math.cos(argument);
        rate -= amplitude * frequency * Math.sin(argument) / MILLENNIUM_DAYS;
      }
      values[group.coordinate] += basis[group.degree] * value;
      rates[group.coordinate] += derivative[group.degree] * value + basis[group.degree] * rate;
    }
    if (limits) {
      for (const coordinate of coordinates) {
        if (limits[coordinate] === undefined) continue;
        const counts = prefixCounts?.[coordinate]?.[limits[coordinate]];
        if (!counts) throw new RangeError(`Unsupported coordinate ${coordinate} prefix ${limits[coordinate]}`);
        for (const { degree, coefficients } of coordinateGroups[coordinate]) {
          const end = Math.min((counts[degree] ?? 0) * 3, coefficients.length);
          for (let index = 0; index < end; index += 3) {
            const amplitude = coefficients[index];
            const frequency = coefficients[index + 2];
            const argument = coefficients[index + 1] + frequency * tau;
            const value = amplitude * Math.cos(argument);
            values[coordinate] += basis[degree] * value;
            rates[coordinate] += derivative[degree] * value
              - basis[degree] * amplitude * frequency * Math.sin(argument) / MILLENNIUM_DAYS;
          }
        }
      }
    }
    values[0] = Math.atan2(Math.sin(values[0]), Math.cos(values[0]));
    return { values, rates };
  }

  function cartesian(values, rates) {
    const [longitude, latitude, radius] = values;
    const [dl, db, dr] = rates;
    const cl = Math.cos(longitude);
    const sl = Math.sin(longitude);
    const cb = Math.cos(latitude);
    const sb = Math.sin(latitude);
    const position = [radius * cb * cl, radius * cb * sl, radius * sb];
    const velocity = [
      dr * cb * cl - radius * sb * db * cl - radius * cb * sl * dl,
      dr * cb * sl - radius * sb * db * sl + radius * cb * cl * dl,
      dr * sb + radius * cb * db,
    ];
    // Convert native theory axes to the library's mean J2000 ecliptic frame.
    return { position: planetTheoryToJ2000(position), velocity: planetTheoryToJ2000(velocity) };
  }

  function state(jd, limits) {
    const { values, rates } = nativeState(jd, [0, 1, 2], limits);
    return cartesian(values, rates);
  }

  function direction(jd, limits) {
    const { values, rates } = nativeState(jd, [0, 1], limits);
    values[2] = 1;
    const result = cartesian(values, rates);
    // Normalize after the finite-precision fixed-frame conversion too.
    const radius = Math.hypot(...result.position);
    const radialRate = result.position.reduce((sum, v, k) => sum + v * result.velocity[k], 0) / radius;
    return {
      position: result.position.map(v => v / radius),
      velocity: result.velocity.map((v, k) => v / radius - result.position[k] * radialRate / (radius * radius)),
    };
  }

  function accuracyState(jd, accuracy) {
    return state(jd, accuracy === 'accurate' ? undefined : accuracyLimits?.[accuracy]);
  }

  function accuracyDirection(jd, accuracy) {
    return direction(jd, accuracy === 'accurate' ? undefined : accuracyLimits?.[accuracy]);
  }

  return { state, direction, accuracyState, accuracyDirection };
}

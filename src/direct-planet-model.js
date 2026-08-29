import { PLANET_EPOCH_JD, PLANET_SCALE_DAYS, PLANET_PHASE_DAYS } from './planet-series.js';
import { planetTheoryToJ2000 } from './planet-frame.js';

function legendreBasis(x, degree) {
  const basis = new Float64Array(degree + 1), derivative = new Float64Array(degree + 1);
  basis[0] = 1;
  if (degree > 0) { basis[1] = x; derivative[1] = 1 / PLANET_SCALE_DAYS; }
  for (let n = 2; n <= degree; n++) {
    basis[n] = ((2 * n - 1) * x * basis[n - 1] - (n - 1) * basis[n - 2]) / n;
    derivative[n] = ((2 * n - 1) * (basis[n - 1] / PLANET_SCALE_DAYS + x * derivative[n - 1])
      - (n - 1) * derivative[n - 2]) / n;
  }
  return { basis, derivative };
}

export function chebyshevBasis(x, degree) {
  const basis = new Float64Array(degree + 1), derivative = new Float64Array(degree + 1);
  basis[0] = 1;
  if (degree > 0) { basis[1] = x; derivative[1] = 1 / PLANET_SCALE_DAYS; }
  for (let n = 2; n <= degree; n++) {
    basis[n] = 2 * x * basis[n - 1] - basis[n - 2];
    derivative[n] = 2 * basis[n - 1] / PLANET_SCALE_DAYS + 2 * x * derivative[n - 1] - derivative[n - 2];
  }
  return { basis, derivative };
}

export function anchoredChebyshevBasis(x, degree) {
  const result = chebyshevBasis(x, degree);
  for (let n = 2; n <= degree; n += 2) result.basis[n] -= (-1) ** (n / 2);
  return result;
}

/** Bare Fourier/polynomial LBR arrays; basis selection is fixed by the caller. */
export function createDirectPlanetModel(L, B, R, evaluateBasis = legendreBasis) {
  const groups = [L, B, R].flatMap((axis, coordinate) => axis.map((coefficients, degree) => ({ coordinate, degree, coefficients })));
  const degree = Math.max(L.length, B.length, R.length) - 1;
  const ranked = [[], [], []];
  let serial = 0;
  for (const g of groups) {
    for (let index = 0; index < g.coefficients.length; index += 3) {
      const bound = evaluateBasis === anchoredChebyshevBasis && g.degree > 0 && g.degree % 2 === 0 ? 2 : 1;
      ranked[g.coordinate].push({ degree: g.degree, index, serial: serial++, coefficients: g.coefficients,
        score: Math.abs(g.coefficients[index]) * bound });
    }
  }
  for (const terms of ranked) terms.sort((a, b) => b.score - a.score || a.serial - b.serial);
  const MILLENNIUM_DAYS = PLANET_PHASE_DAYS;

  /** Direct LBR series, without orbital-element conversion at runtime. */
  function nativeState(jd, coordinates, limits) {
    const tau = (jd - PLANET_EPOCH_JD) / MILLENNIUM_DAYS;
    const x = (jd - PLANET_EPOCH_JD) / PLANET_SCALE_DAYS;
    const { basis, derivative } = evaluateBasis(x, degree);
    const values = [0, 0, 0], rates = [0, 0, 0];
    for (const group of groups) {
      if (!coordinates.includes(group.coordinate) || limits?.[group.coordinate] !== undefined) continue;
      let value = 0, rate = 0;
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
        for (const term of ranked[coordinate].slice(0, limits[coordinate] ?? Infinity)) {
          const { degree, index, coefficients } = term;
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
    values[0] = Math.atan2(Math.sin(values[0]), Math.cos(values[0]));
    return { values, rates };
  }

  function cartesian(values, rates) {
    const [longitude, latitude, radius] = values;
    const [dl, db, dr] = rates;
    const cl = Math.cos(longitude), sl = Math.sin(longitude), cb = Math.cos(latitude), sb = Math.sin(latitude);
    const position = [radius * cb * cl, radius * cb * sl, radius * sb];
    const velocity = [dr * cb * cl - radius * sb * db * cl - radius * cb * sl * dl,
      dr * cb * sl - radius * sb * db * sl + radius * cb * cl * dl, dr * sb + radius * cb * db];
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

  return { state, direction, ranked };
}

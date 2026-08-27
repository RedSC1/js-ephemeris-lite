import { apparentBodyPosition, apparentBodyState, validateSkyBody } from './apparent.js';
import { DEG, finite, normDeg, signedDeg } from './sky-math.js';

function settings(start, end, options) {
  finite(start, 'start'); finite(end, 'end');
  if (end < start) throw new RangeError('end must not precede start');
  const stepDays = options.stepDays ?? 0.5;
  const toleranceDays = options.toleranceDays ?? 1e-8;
  if (!Number.isFinite(stepDays) || stepDays <= 0 || !Number.isFinite(toleranceDays)
    || toleranceDays < 1e-9 || stepDays <= toleranceDays) {
    throw new RangeError('stepDays must exceed toleranceDays >= 1e-9');
  }
  const count = Math.ceil((end - start) / stepDays);
  if (count > 200000) throw new RangeError('search exceeds 200000 samples; split the interval');
  return { stepDays, toleranceDays, count };
}

/** Sign-changing roots in [start,end). Multiple roots within one step and
 * tangent roots are not guaranteed: select a step that resolves the signal. */
export function searchCrossings(evaluate, start, end, options = {}) {
  const { stepDays, toleranceDays, count } = settings(start, end, options);
  if (count === 0) return [];
  const sample = t => finite(evaluate(t), 'search sample');
  const roots = [];
  function push(t, residual) {
    if (t < start || t >= end || (roots.length && t - roots.at(-1).time <= toleranceDays * 2)) return;
    roots.push({ time: t, residual });
  }
  let left = start, fLeft = sample(left);
  if (fLeft === 0) push(left, 0);
  for (let i = 1; i <= count; i++) {
    const right = Math.min(end, start + i * stepDays), fRight = sample(right);
    if (fLeft === 0 && fRight === 0) {
      throw new RangeError('adjacent samples are both zero; roots are not isolated at this step');
    }
    if (fRight === 0) push(right, 0);
    else if (fLeft !== 0 && Math.sign(fLeft) !== Math.sign(fRight)) {
      let a = left, b = right, fa = fLeft;
      for (let iteration = 0; iteration < 80 && b - a > toleranceDays; iteration++) {
        const mid = a + (b - a) / 2;
        if (mid === a || mid === b) break;
        const fm = sample(mid);
        if (fm === 0) { a = b = mid; break; }
        if (Math.sign(fm) === Math.sign(fa)) { a = mid; fa = fm; } else b = mid;
      }
      const root = a + (b - a) / 2;
      push(root, sample(root));
    }
    left = right; fLeft = fRight;
  }
  return roots;
}

/** Periodic crossing search; sin brackets also see antipodes, filtered below. */
export function searchAngleCrossings(evaluateDegrees, targetDeg, start, end, options = {}) {
  finite(targetDeg, 'targetDeg');
  const target = normDeg(targetDeg);
  const delta = t => signedDeg(finite(evaluateDegrees(t), 'angle sample') - target);
  return searchCrossings(t => Math.sin(delta(t) * DEG), start, end, options)
    .filter(root => Math.abs(delta(root.time)) < 90)
    .map(root => ({ time: root.time, residualDeg: delta(root.time) }));
}

function bodyOptions(options) { return options.apparent ?? {}; }
function event(body, jdTT, options) {
  const position = apparentBodyState(body, jdTT, bodyOptions(options));
  return {
    body, jdTT, frame: position.frame, longitudeDeg: position.longitudeDeg,
    longitudeSpeedDegPerDay: position.longitudeSpeedDegPerDay,
    direction: position.longitudeSpeedDegPerDay < 0 ? 'retrograde' : 'direct',
  };
}

export function searchLongitudeCrossings(body, targetDeg, startTT, endTT, options = {}) {
  validateSkyBody(body);
  return searchAngleCrossings(
    t => apparentBodyPosition(body, t, bodyOptions(options)).longitudeDeg,
    targetDeg, startTT, endTT, options,
  ).map(root => ({ ...event(body, root.time, options), targetDeg: normDeg(targetDeg) }));
}

/** Relative ECLIPTIC longitude body - other, not closest approach on the sky. */
export function searchRelativeLongitude(body, other, angleDeg, startTT, endTT, options = {}) {
  validateSkyBody(body); validateSkyBody(other);
  if (body === other) throw new RangeError('relative search requires different bodies');
  const relative = t => apparentBodyPosition(body, t, bodyOptions(options)).longitudeDeg
    - apparentBodyPosition(other, t, bodyOptions(options)).longitudeDeg;
  return searchAngleCrossings(relative, angleDeg, startTT, endTT, options).map(root => ({
    ...event(body, root.time, options), other, angleDeg: normDeg(angleDeg),
  }));
}

export function searchStations(body, startTT, endTT, options = {}) {
  validateSkyBody(body);
  const speed = t => apparentBodyState(body, t, bodyOptions(options)).longitudeSpeedDegPerDay;
  return searchCrossings(speed, startTT, endTT, options).map(root => ({
    ...event(body, root.time, options),
    direction: speed(root.time + 0.01) < 0 ? 'retrograde' : 'direct',
  }));
}

/** Every 30-degree boundary, including retrograde re-entry; signs are 0..11. */
export function searchIngresses(body, startTT, endTT, options = {}) {
  validateSkyBody(body);
  const longitude = t => apparentBodyPosition(body, t, bodyOptions(options)).longitudeDeg;
  return searchCrossings(t => Math.sin(longitude(t) * DEG * 6), startTT, endTT, options)
    .map(root => {
      const result = event(body, root.time, options);
      const boundary = Math.round(result.longitudeDeg / 30) % 12;
      const direct = result.direction === 'direct';
      return {
        ...result, boundaryDeg: boundary * 30,
        fromSign: direct ? (boundary + 11) % 12 : boundary,
        toSign: direct ? boundary : (boundary + 11) % 12,
      };
    });
}

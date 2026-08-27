import { AU_KM, earthHeliocentricState, moonGeocentricState } from './ephemeris.js';
import { iau2000bNutation, meanEclipticOfDateMatrixState } from './coordinates.js';
import { apparentBodyPosition, apparentBodyState, validateSkyBody } from './apparent.js';
import { searchCrossings, searchAngleCrossings } from './event-search.js';
import { add, clamp, dot, finite, RAD, rotateZ, signedDeg, spherical, transform } from './sky-math.js';

// Distances and plane crossings use simultaneous GEOMETRIC states, never
// light-time-corrected apparent positions. All input/output epochs are JD(TT).
function apsides(body, startTT, endTT, options) {
  const getState = body === 'moon' ? moonGeocentricState : earthHeliocentricState;
  const radiusRate = t => {
    const s = getState(t, options);
    return dot(s.position, s.velocity) / Math.hypot(...s.position);
  };
  return searchCrossings(radiusRate, startTT, endTT, { stepDays: body === 'moon' ? 1 : 2, ...options })
    .map(({ time }) => {
      const distance = Math.hypot(...getState(time, options).position);
      return {
        body, jdTT: time, center: body === 'moon' ? 'earth' : 'sun',
        kind: radiusRate(time + 0.05) > 0 ? 'periapsis' : 'apoapsis',
        distanceKm: body === 'moon' ? distance : distance * AU_KM,
        distanceAu: body === 'moon' ? distance / AU_KM : distance,
      };
    });
}

export function searchLunarApsides(startTT, endTT, options = {}) {
  return apsides('moon', startTT, endTT, options);
}

export function searchEarthApsides(startTT, endTT, options = {}) {
  return apsides('earth', startTT, endTT, options);
}

export function searchLunarNodes(startTT, endTT, options = {}) {
  const frame = options.frame ?? 'mean-of-date';
  if (!['j2000', 'mean-of-date', 'true-of-date'].includes(frame)) throw new RangeError('unsupported node frame');
  function state(t) {
    const s = moonGeocentricState(t, options);
    if (frame === 'j2000') return s;
    const m = meanEclipticOfDateMatrixState(t);
    let position = transform(m.matrix, s.position);
    let velocity = add(transform(m.matrix, s.velocity), transform(m.rate, s.position));
    // Nutation in longitude rotates the equinox, not the ecliptic plane;
    // therefore mean/true-of-date nodes share times, but not longitudes.
    if (frame === 'true-of-date') {
      const angle = iau2000bNutation(t).dpsi;
      position = rotateZ(position, angle); velocity = rotateZ(velocity, angle);
    }
    return { position, velocity };
  }
  return searchCrossings(t => state(t).position[2], startTT, endTT, { stepDays: 1, ...options })
    .map(({ time }) => {
      const s = state(time), p = spherical(s.position);
      return {
        body: 'moon', jdTT: time, frame,
        kind: s.velocity[2] > 0 ? 'ascending' : 'descending',
        longitudeDeg: p.longitudeDeg, latitudeDeg: p.latitudeDeg,
        distanceKm: Math.hypot(...s.position),
      };
    });
}

function separationState(body, t, options) {
  const a = apparentBodyState(body, t, options), b = apparentBodyState('sun', t, options);
  const p = a.equatorialPositionAu, q = b.equatorialPositionAu;
  const v = a.equatorialVelocityAuPerDay, w = b.equatorialVelocityAuPerDay;
  const r = Math.hypot(...p), s = Math.hypot(...q), cosine = dot(p, q) / (r * s);
  const rate = (dot(v, q) + dot(p, w)) / (r * s)
    - cosine * (dot(p, v) / (r * r) + dot(q, w) / (s * s));
  return { a, b, cosine, rate };
}

/** Maxima of the full 3D apparent angular separation from the Sun. */
export function searchGreatestElongations(body, startTT, endTT, options = {}) {
  if (!['mercury', 'venus'].includes(body)) throw new RangeError('greatest elongation requires mercury or venus');
  const positionOptions = options.apparent ?? {};
  const evaluate = t => separationState(body, t, positionOptions);
  return searchCrossings(t => evaluate(t).rate, startTT, endTT, { stepDays: 1, ...options })
    .filter(({ time }) => evaluate(time - 0.05).rate < 0 && evaluate(time + 0.05).rate > 0)
    .map(({ time }) => {
      const s = evaluate(time);
      // East/west labels always use date ecliptic longitude, independent of
      // requested output axes. The angular separation itself is invariant.
      const opts = { ...positionOptions, frame: 'true-of-date' };
      const delta = signedDeg(apparentBodyPosition(body, time, opts).longitudeDeg
        - apparentBodyPosition('sun', time, opts).longitudeDeg);
      return {
        body, jdTT: time, frame: s.a.frame, kind: delta > 0 ? 'eastern' : 'western',
        elongationDeg: Math.acos(clamp(s.cosine)) * RAD,
        longitudeDeg: s.a.longitudeDeg, latitudeDeg: s.a.latitudeDeg,
      };
    });
}

/** Right ascension body-other; conjunction is angleDeg=0, not closest approach. */
export function searchRelativeRightAscension(body, other, angleDeg, startTT, endTT, options = {}) {
  validateSkyBody(body); validateSkyBody(other); finite(angleDeg, 'angleDeg');
  if (body === other) throw new RangeError('relative search requires different bodies');
  const opts = options.apparent ?? {};
  const position = (target, t) => apparentBodyPosition(target, t, opts);
  return searchAngleCrossings(t => position(body, t).rightAscensionDeg - position(other, t).rightAscensionDeg,
    angleDeg, startTT, endTT, options).map(({ time }) => {
    const a = position(body, time), b = position(other, time);
    return {
      body, other, jdTT: time, frame: a.frame, angleDeg: ((angleDeg % 360) + 360) % 360,
      rightAscensionDeg: a.rightAscensionDeg, declinationDeg: a.declinationDeg,
      declinationDifferenceDeg: a.declinationDeg - b.declinationDeg,
    };
  });
}

export function searchRightAscensionStations(body, startTT, endTT, options = {}) {
  validateSkyBody(body);
  const position = t => apparentBodyState(body, t, options.apparent ?? {});
  const speed = t => position(t).rightAscensionSpeedDegPerDay;
  return searchCrossings(speed, startTT, endTT, options).map(({ time }) => {
    const s = position(time);
    return {
      body, jdTT: time, frame: s.frame, rightAscensionDeg: s.rightAscensionDeg,
      declinationDeg: s.declinationDeg, rightAscensionSpeedDegPerDay: s.rightAscensionSpeedDegPerDay,
      direction: speed(time + 0.01) < 0 ? 'retrograde' : 'direct',
    };
  });
}

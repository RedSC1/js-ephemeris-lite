// C++ cone/ellipsoid solver with shared polynomial Sun/Moon vectors.
// Five-point Newton interpolation; exact positions outside the six-hour window.
import { lunarPhaseTimeAccurate } from './calendar-events.js';
import { coneDiscriminantFast } from './eclipse-cone.js';
import { pairProvider, solveSolar, passes } from './eclipse-geometry.js';
import { B, RE, RM, RS, dot, sub, scale, add, norm, unit, cross, axisIntersection, directContact } from './eclipse-geometry.js';
import { JulianTime } from './time.js';
import { iau2000bNutation } from './coordinates.js';
import { greenwichApparentSiderealTimeRadians } from './solar-core.js';
export function vectorPolynomial(center, { halfSpan = .25, count = 5 } = {}) {
  const exact = pairProvider(), nodes = Array.from({ length: count }, (_, i) => -1 + 2 * i / (count - 1));
  const samples = nodes.map(x => exact.evaluate(center + x * halfSpan));
  const coefficients = Array.from({ length: 2 }, (_, body) => Array.from({ length: 3 }, (_, coord) => {
    const a = samples.map(p => p[body][coord]);
    for (let order = 1; order < count; order++)
      for (let i = count - 1; i >= order; i--)
        a[i] = (a[i] - a[i - 1]) / (nodes[i] - nodes[i - order]);
    return a;
  }));
  return { counts: exact.counts, evaluate(t) {
      const x = (t - center) / halfSpan;
      if (Math.abs(x) > 1)
        return exact.evaluate(t);
      return coefficients.map(body => body.map(a => {
        let v = a[count - 1];
        for (let i = count - 2; i >= 0; i--)
          v = v * (x - nodes[i]) + a[i];
        return v;
      }));
    } };
}
export function solveSolarPolynomial(k, options = {}) {
  if (!passes(k))
    return null;
  const seedTime = lunarPhaseTimeAccurate(k * 2 * Math.PI) - 2451545;
  return solveSolar(k, { cone: coneDiscriminantFast, ...options, seedTime, providerFactory: center => vectorPolynomial(center, options),
    greatestSteps: [.0625, 1 / 1440, .25 / 1440, .0625 / 1440] });
}
const DEG = Math.PI / 180;
function sidereal(t) {
  const time = JulianTime.fromTT(2451545 + t);
  return greenwichApparentSiderealTimeRadians(time.jdUT1, time.jdTT, iau2000bNutation(time.jdTT));
}
function shadowVector(e, p) {
  return add(add(scale(e.xh, -p[0] * RE), scale(e.yh, p[1] * RE)), scale(e.axis, -p[2] * RE));
}
function surface(v) { return scale(v, RE / Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2 / (B * B))); }
function location(v, t) {
  let lon = (Math.atan2(v[1], v[0]) - sidereal(t)) / DEG;
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  return { longitudeDeg: lon, latitudeDeg: Math.atan2(v[2] / (B * B), Math.hypot(v[0], v[1])) / DEG };
}
function observerVector(t, observer) {
  const phi = observer.latitudeDeg * DEG, theta = observer.longitudeDeg * DEG + sidereal(t);
  const n = RE / Math.sqrt(1 - (1 - B * B) * Math.sin(phi) ** 2), h = (observer.heightMeters ?? 0) / 1000;
  return [(n + h) * Math.cos(phi) * Math.cos(theta), (n + h) * Math.cos(phi) * Math.sin(theta), (n * B * B + h) * Math.sin(phi)];
}
function disks(pair, position) {
  const moon = sub(pair[0], position), sun = sub(pair[1], position), md = norm(moon), sd = norm(sun);
  const separation = Math.atan2(norm(cross(moon, sun)), dot(moon, sun));
  const mr = Math.asin(RM / md), sr = Math.asin(RS / sd);
  return { separation, mr, sr, magnitude: (mr + sr - separation) / (2 * sr), sun };
}
function minimize(fn, lo, hi, tolerance = .002 / 86400) {
  const ratio = (Math.sqrt(5) - 1) / 2;
  let a = hi - ratio * (hi - lo), b = lo + ratio * (hi - lo), fa = fn(a), fb = fn(b);
  for (let i = 0; i < 64 && hi - lo > tolerance; i++) {
    if (fa < fb) {
      hi = b;
      b = a;
      fb = fa;
      a = hi - ratio * (hi - lo);
      fa = fn(a);
    }
    else {
      lo = a;
      a = b;
      fa = fb;
      b = lo + ratio * (hi - lo);
      fb = fn(b);
    }
  }
  return (lo + hi) / 2;
}
/** Unclipped local circular-limb circumstances; no horizon or refraction. */
export function localCircumstances(event, observer) {
  const at = t => disks(event.provider.evaluate(t), observerVector(t, observer));
  const maximum = minimize(t => { const g = at(t); return -g.magnitude; }, event.maximum - .2, event.maximum + .2);
  const g = at(maximum), contacts = { partialBegin: null, maximum: null, partialEnd: null, centralBegin: null, centralEnd: null };
  if (g.magnitude <= 0)
    return { kind: 'none', magnitude: 0, contacts, at };
  const partial = t => { const g = at(t); return g.mr + g.sr - g.separation; };
  contacts.maximum = maximum;
  contacts.partialBegin = directContact(partial, maximum, -1);
  contacts.partialEnd = directContact(partial, maximum, 1);
  let kind = 'partial';
  if (g.separation < Math.abs(g.mr - g.sr)) {
    kind = g.mr > g.sr ? 'total' : 'annular';
    const central = t => { const g = at(t); return Math.abs(g.mr - g.sr) - g.separation; };
    contacts.centralBegin = directContact(central, maximum, -1);
    contacts.centralEnd = directContact(central, maximum, 1);
  }
  return { kind, magnitude: g.magnitude, contacts, at };
}
export function solarGroundPoint(event, t, central = false) {
  if (t === null)
    return null;
  const e = event.at(t);
  let point;
  if (central) {
    const hit = axisIntersection(e);
    point = hit.point ?? [-e.x, e.y, 2 - 2 * hit.vertex];
  }
  else
    point = coneDiscriminantFast(e, e.l1, true).point;
  return { time: JulianTime.fromTT(2451545 + t), ...location(surface(shadowVector(e, point)), t) };
}
export function solarMaximumDetails(event) {
  const t = event.maximum, e = event.at(t), hit = axisIntersection(e);
  let v;
  if (hit.point)
    v = shadowVector(e, hit.point);
  else {
    // Start at the cone's closest point and maximize the topocentric magnitude
    // on the ellipsoid. This also handles partial and noncentral eclipses.
    v = surface(shadowVector(e, coneDiscriminantFast(e, e.l1, true).point));
    let step = .1;
    const pair = event.provider.evaluate(t);
    for (let i = 0; i < 60 && step > 1e-8; i++) {
      const normal = unit(v), east = unit(cross([0, 0, 1], normal)), north = unit(cross(normal, east));
      let best = v, score = disks(pair, v).magnitude;
      for (const direction of [east, north])
        for (const sign of [-1, 1]) {
          const candidate = surface(add(v, scale(direction, RE * step * sign))), value = disks(pair, candidate).magnitude;
          if (value > score) {
            best = candidate;
            score = value;
          }
        }
      if (best === v)
        step *= .5;
      v = best;
    }
  }
  const maximumLocation = location(v, t), g = disks(event.provider.evaluate(t), v);
  let pathWidthKm = 0, centralDurationSeconds = 0;
  if (hit.point) {
    const local = localCircumstances(event, maximumLocation);
    if (local.contacts.centralBegin !== null)
      centralDurationSeconds = (local.contacts.centralEnd - local.contacts.centralBegin) * 86400;
    // Instantaneous width through the central point, perpendicular to the
    // ground track; intersections are solved on WGS84, not a flat Earth.
    const h = 1 / 1440;
    const positions = [t - h, t + h].map(time => {
      const a = event.at(time), p = axisIntersection(a).point;
      if (!p)
        return null;
      const l = location(shadowVector(a, p), time);
      return observerVector(t, l);
    });
    if (positions.every(Boolean)) {
      const normal = unit([v[0], v[1], v[2] / (B * B)]), across = unit(cross(normal, sub(positions[1], positions[0])));
      const boundary = angle => {
        const point = surface(add(scale(v, Math.cos(angle)), scale(across, RE * Math.sin(angle))));
        const d = disks(event.provider.evaluate(t), point);
        return Math.abs(d.mr - d.sr) - d.separation;
      };
      const widths = [];
      for (const sign of [-1, 1]) {
        let lo = 0, hi = .001;
        while (hi < 1.5 && boundary(sign * hi) > 0)
          hi *= 2;
        if (boundary(sign * hi) > 0)
          break;
        for (let i = 0; i < 32; i++) {
          const mid = (lo + hi) / 2;
          if (boundary(sign * mid) > 0)
            lo = mid;
          else
            hi = mid;
        }
        widths.push((lo + hi) / 2 * RE);
      }
      if (widths.length === 2)
        pathWidthKm = widths[0] + widths[1];
    }
  }
  return { maximumLocation, magnitude: hit.point ? g.mr / g.sr : Math.max(0, g.magnitude), pathWidthKm, centralDurationSeconds };
}

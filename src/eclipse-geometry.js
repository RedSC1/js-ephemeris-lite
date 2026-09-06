// Circular-limb shadow geometry, WGS84 Earth; lengths are kilometres.
// Internal times are TT days relative to J2000.
import { apparentBodyPosition } from './apparent.js';
import { AU_KM } from './ephemeris.js';
export const D = Math.PI / 180, RE = 6378.137, RM = .2725076 * RE, RS = 695700, B = 1 - 1 / 298.257223563;
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const scale = (a, s) => a.map(x => x * s);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const norm = a => Math.hypot(...a);
export const unit = a => scale(a, 1 / norm(a));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rx = (a, t) => [a[0], a[1] * Math.cos(t) - a[2] * Math.sin(t), a[1] * Math.sin(t) + a[2] * Math.cos(t)];
export function passes(k, lunar = false) {
  const h = k + (lunar ? .5 : 0), T = h / 1236.85;
  const F = (160.7108 + 390.67050274 * h - .0016341 * T * T - .00000227 * T ** 3 + .000000011 * T ** 4) * D;
  // The polynomial node filter is only used in its validated modern interval.
  return Math.abs(k) > 2500 || Math.abs(Math.sin(F)) <= Math.sin(23 * D);
}
export function seed(k, lunar = false) {
  const h = k + (lunar ? .5 : 0), T = h / 1236.85;
  const m = (2.5534 + 29.10535669 * h - .0000218 * T * T - .00000011 * T ** 3) * D;
  const p = (201.5643 + 385.81693528 * h + .1017438 * T * T + .00001239 * T ** 3 + .000000058 * T ** 4) * D;
  const e = 1 - .002516 * T - .0000074 * T * T;
  let t = 5.09765 + 29.530588853 * h + .0001337 * T * T - .000000150 * T ** 3 + .00000000073 * T ** 4;
  if (!lunar)
    return t - .4075 * Math.sin(p) + .1721 * e * Math.sin(m);
  const omega = (124.7746 - 1.56375580 * h + .0020691 * T * T + .00000215 * T ** 3) * D;
  let f = (160.7108 + 390.67050274 * h - .0016341 * T * T - .00000227 * T ** 3 + .000000011 * T ** 4) % 180;
  if (f < 0)
    f += 180;
  f = (f - .02665 * Math.sin(omega)) * D;
  const a = (299.77 + .107408 * h - .009173 * T * T) * D;
  return t - .4065 * Math.sin(p) + .1727 * e * Math.sin(m) + .0161 * Math.sin(2 * p) - .0097 * Math.sin(2 * f)
    + .0073 * e * Math.sin(p - m) - .0050 * e * Math.sin(p + m) - .0023 * Math.sin(p - 2 * f) + .0021 * e * Math.sin(2 * m)
    + .0012 * Math.sin(p + 2 * f) + .0006 * e * Math.sin(2 * p + m) - .0004 * Math.sin(3 * p) - .0003 * e * Math.sin(m + 2 * f)
    + .0003 * Math.sin(a) - .0002 * e * Math.sin(m - 2 * f) - .0002 * e * Math.sin(2 * p - m) - .0002 * Math.sin(omega);
}
export function pairProvider() {
  const counts = { exactPairs: 0 };
  return { counts, evaluate(t) {
      counts.exactPairs++;
      return ['moon', 'sun'].map(body => scale(apparentBodyPosition(body, 2451545 + t, { solarDeflection: false, frame: 'true-of-date' }).equatorialPositionAu, AU_KM));
    } };
}
export function solarElements(pair, moonRadius = RM, sunRadius = RS) {
  const [moon, sun] = pair, axis = unit(sub(moon, sun)), xh = unit(cross([0, 0, 1], axis)), yh = unit(cross(axis, xh));
  const z = -dot(moon, axis) / RE, dist = norm(sub(moon, sun));
  return { x: dot(moon, xh) / RE, y: dot(moon, yh) / RE, z, d: Math.asin(axis[2]),
    l1: moonRadius / RE + z * (sunRadius + moonRadius) / dist, l2: moonRadius / RE - z * (sunRadius - moonRadius) / dist, axis, xh, yh, moon, sun, moonRadius, sunRadius };
}
const qdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] / (B * B);
export function lineIntersection(origin, direction, rotation) {
  const o = rx(origin, rotation), v = rx(direction, rotation), a = qdot(v, v), b = qdot(o, v), c = qdot(o, o) - 1;
  const disc = b * b - a * c, vertex = -b / a;
  const t = disc >= 0 ? (-b - Math.sqrt(disc)) / a : null;
  return { disc: disc / a, vertex, point: t === null ? null : add(origin, scale(direction, t)) };
}
export function axisIntersection(e) { return lineIntersection([-e.x, e.y, 2], [0, 0, -2], Math.PI / 2 + e.d); }
export function coneDiscriminant(e, radius) {
  function evaluate(t) {
    const c = Math.cos(t), s = Math.sin(t), o = [-e.x + e.moonRadius / RE * c, e.y + e.moonRadius / RE * s, e.z];
    const v = [(radius - e.moonRadius / RE) * c, (radius - e.moonRadius / RE) * s, -e.z];
    const a = lineIntersection(o, v, Math.PI / 2 + e.d);
    return a.vertex > 0 ? a.disc : -Infinity;
  }
  const step = Math.PI / 12;
  let best = -Infinity, at = 0;
  for (let i = 0; i < 24; i++) {
    const f = evaluate(i * step);
    if (f > best) {
      best = f;
      at = i * step;
    }
  }
  let lo = at - step, hi = at + step;
  const g = (Math.sqrt(5) - 1) / 2;
  let c = hi - g * (hi - lo), d = lo + g * (hi - lo), fc = evaluate(c), fd = evaluate(d);
  for (let i = 0; i < 28; i++) {
    if (fc > fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - g * (hi - lo);
      fc = evaluate(c);
    }
    else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + g * (hi - lo);
      fd = evaluate(d);
    }
  }
  return Math.max(fc, fd);
}
export function bisect(fn, lo, hi, tolerance = 1e-10) {
  let fl = fn(lo), fh = fn(hi);
  if (fl * fh > 0)
    throw Error('unbracketed contact');
  for (let i = 0; i < 60 && hi - lo > tolerance; i++) {
    const m = (lo + hi) / 2, f = fn(m);
    if (fl * f <= 0) {
      hi = m;
      fh = f;
    }
    else {
      lo = m;
      fl = f;
    }
  }
  return (lo + hi) / 2;
}
export function directContact(fn, t, side) {
  let inner = t, fi = fn(t), outer = null, fo;
  if (fi < 0)
    return null;
  for (const h of [.5, 1, 2, 4, 8, 12]) {
    const x = t + side * h / 24, f = fn(x);
    if (f <= 0) {
      outer = x;
      fo = f;
      break;
    }
    inner = x;
    fi = f;
  }
  if (outer === null)
    throw Error('contact outside 12-hour bracket');
  let lo = side < 0 ? outer : inner, hi = side < 0 ? inner : outer, fl = side < 0 ? fo : fi, fh = side < 0 ? fi : fo, last = 0;
  for (let i = 0; i < 40 && hi - lo > .02 / 86400; i++) {
    let fraction = -fl / (fh - fl);
    if (!(fraction > .05 && fraction < .95))
      fraction = .5;
    const m = lo + fraction * (hi - lo), f = fn(m);
    if (fl * f <= 0) {
      hi = m;
      fh = f;
      if (last === 1)
        fl *= .5;
      last = 1;
    }
    else {
      lo = m;
      fl = f;
      if (last === -1)
        fh *= .5;
      last = -1;
    }
  }
  return (lo + hi) / 2;
}
export function solveSolar(k, { moonRadius = RM, sunRadius = RS, filter = true, seedTime, providerFactory, greatestSteps, cone = coneDiscriminant } = {}) {
  if (filter && !passes(k))
    return null;
  let t = seedTime ?? seed(k);
  const provider = providerFactory ? providerFactory(t) : pairProvider(), at = t => solarElements(provider.evaluate(t), moonRadius, sunRadius);
  const rho = t => { const e = at(t); return (e.x * e.x + e.y * e.y) * RE * RE; };
  for (const h of greatestSteps ?? [.5, .125, .03125, ...[1, .5, .25, .125, .0625, .03125].map(x => x / 1440)]) {
    const fm = rho(t - h), f = rho(t), fp = rho(t + h), c = fm - 2 * f + fp;
    if (Math.abs(c) > 1e-12)
      t += Math.max(-h, Math.min(h, .5 * (fm - fp) / c * h));
  }
  const e = at(t), partial = t => { const g = at(t); return cone(g, g.l1); }, central = t => axisIntersection(at(t)).disc;
  if (partial(t) < 0)
    return null;
  const isCentral = central(t) >= 0;
  let kind = cone(e, e.l2) >= 0 ? (e.l2 >= 0 ? 'total' : 'annular') : 'partial';
  const contacts = { partialBegin: directContact(partial, t, -1), partialEnd: directContact(partial, t, 1), centralBegin: null, centralEnd: null };
  let magnitude = null;
  if (isCentral) {
    contacts.centralBegin = directContact(central, t, -1);
    contacts.centralEnd = directContact(central, t, 1);
    const signs = [];
    for (const time of [t, contacts.centralBegin + 10 / 86400, contacts.centralEnd - 10 / 86400]) {
      const g = at(time), hit = axisIntersection(g);
      if (!hit.point)
        continue;
      // Axis distance from Moon to visible Earth surface, in Earth radii.
      const depth = hit.point[2];
      signs.push(g.l2 + (moonRadius / RE - g.l2) / g.z * depth);
      if (time === t) {
        const observer = add(add(scale(g.xh, -hit.point[0] * RE), scale(g.yh, hit.point[1] * RE)), scale(g.axis, -depth * RE));
        magnitude = Math.asin(moonRadius / norm(sub(g.moon, observer))) / Math.asin(sunRadius / norm(sub(g.sun, observer)));
      }
    }
    if (signs.some(x => x > 0) && signs.some(x => x < 0))
      kind = 'hybrid';
    else if (signs.length)
      kind = signs[0] > 0 ? 'total' : 'annular';
  }
  return { kind, maximum: t, conjunction: seedTime, contacts, magnitude, counts: provider.counts, provider, at };
}
export function fit(values) {
  const a = Array.from({ length: 4 }, () => Array(5).fill(0));
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) / 2;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++)
        a[r][c] += x ** (r + c);
      a[r][4] += values[i] * x ** r;
    }
  }
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[p][c]))
        p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let j = c; j < 5; j++)
      a[c][j] /= d;
    for (let r = 0; r < 4; r++)
      if (r !== c) {
        const f = a[r][c];
        for (let j = c; j < 5; j++)
          a[r][j] -= f * a[c][j];
      }
  }
  return a.map(row => row[4]);
}

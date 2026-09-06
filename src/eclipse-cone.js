// Same C++ cone/oblate-Earth discriminant, factored to avoid allocating and
// rotating two 3-vectors for every candidate generator angle.
import { B, RE } from './eclipse-geometry.js';
const step = Math.PI / 12, scan = Array.from({ length: 24 }, (_, i) => [Math.cos(i * step), Math.sin(i * step)]);
export function coneDiscriminantFast(e, radius, withPoint = false) {
  const angle = Math.PI / 2 + e.d, c = Math.cos(angle), s = Math.sin(angle), inv = 1 / (B * B);
  const r = e.moonRadius / RE, delta = radius - r;
  const ox = -e.x, oy = e.y * c - e.z * s, oz = e.y * s + e.z * c, vy = e.z * s, vz = -e.z * c;
  const oo = ox * ox + oy * oy + oz * oz * inv, vv = vy * vy + vz * vz * inv, ov = oy * vy + oz * vz * inv;
  const os = oy * c + oz * s * inv, vs = vy * c + vz * s * inv, ns = c * c + s * s * inv;
  function value(cos, sin) {
    const nn = cos * cos + ns * sin * sin, on = ox * cos + os * sin, vn = vs * sin;
    const a = vv + 2 * delta * vn + delta * delta * nn, b = ov + delta * on + r * vn + r * delta * nn;
    if (-b / a <= 0)
      return -Infinity;
    const cc = oo + 2 * r * on + r * r * nn - 1;
    return b * b / a - cc;
  }
  const evaluate = t => value(Math.cos(t), Math.sin(t));
  let best = -Infinity, at = 0;
  for (let i = 0; i < 24; i++) {
    const f = value(...scan[i]);
    if (f > best) {
      best = f;
      at = i * step;
    }
  }
  let lo = at - step, hi = at + step, g = (Math.sqrt(5) - 1) / 2;
  let a = hi - g * (hi - lo), b = lo + g * (hi - lo), fa = evaluate(a), fb = evaluate(b);
  for (let i = 0; i < 28; i++) {
    if (fa > fb) {
      hi = b;
      b = a;
      fb = fa;
      a = hi - g * (hi - lo);
      fa = evaluate(a);
    }
    else {
      lo = a;
      a = b;
      fa = fb;
      b = lo + g * (hi - lo);
      fb = evaluate(b);
    }
  }
  if (!withPoint)
    return Math.max(fa, fb);
  const theta = fa > fb ? a : b, cos = Math.cos(theta), sin = Math.sin(theta);
  const origin = [-e.x + r * cos, e.y + r * sin, e.z];
  const direction = [delta * cos, delta * sin, -e.z];
  const nn = cos * cos + ns * sin * sin, on = ox * cos + os * sin, vn = vs * sin;
  const qa = vv + 2 * delta * vn + delta * delta * nn, qb = ov + delta * on + r * vn + r * delta * nn;
  return { disc: Math.max(fa, fb), point: origin.map((v, i) => v - direction[i] * qb / qa) };
}

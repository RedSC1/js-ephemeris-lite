// C++ 3-D Chauvenet shadow, maximum iteration, and cubic circular-limb contacts.
import { RE, RM, RS, norm, dot, scale, sub, pairProvider, seed, passes, bisect } from './eclipse-geometry.js';
import { fit } from './eclipse-geometry.js';
import { lunarPhaseTimeAccurate } from './calendar-events.js';
function geometry(pair) {
  const [moon, sun] = pair, axis = scale(sun, -1 / norm(sun)), z = dot(moon, axis), q = sub(moon, scale(axis, z)), sd = norm(sun);
  if (!(z > 0))
    throw Error('Moon not on night-side shadow axis');
  return { q, rho: norm(q), er: RE * 1.02 * .99834 - z * (RS - RE) * 1.02 / sd, Er: RE * 1.02 * .99834 + z * (RS + RE) * 1.02 / sd };
}
const radius = (g, b) => b === 0 ? g.Er + RM : b === 1 ? g.er + RM : g.er - RM;
const f = (g, b) => dot(g.q, g.q) - radius(g, b) ** 2;
const evalPoly = (c, t) => { const x = t / .25; return c[0] + x * (c[1] + x * (c[2] + x * c[3])); };
export function solveLunar(k, { directContacts = false } = {}) {
  if (!passes(k, true))
    return null;
  let t = Math.abs(k) <= 2500 ? seed(k, true) : lunarPhaseTimeAccurate((k + .5) * 2 * Math.PI) - 2451545;
  const provider = pairProvider(), at = t => geometry(provider.evaluate(t)), h = 60 / 86400;
  for (let i = 0; i < 4; i++) {
    const a = at(t - h), g = at(t), b = at(t + h), fm = dot(a.q, a.q), fc = dot(g.q, g.q), fp = dot(b.q, b.q), curv = fm - 2 * fc + fp;
    let offset;
    if (curv > 0)
      offset = .5 * h * (fm - fp) / curv;
    else {
      const v = scale(sub(b.q, a.q), 1 / (2 * h));
      offset = -dot(g.q, v) / dot(v, v);
    }
    offset = Math.max(-.25, Math.min(.25, offset));
    t += offset;
    if (Math.abs(offset) < .001 / 86400)
      break;
  }
  const g = at(t);
  if (g.rho > g.Er + RM)
    return null;
  const kind = g.rho <= g.er - RM ? 'total' : g.rho <= g.er + RM ? 'partial' : 'penumbral';
  const offsets = [-.25, -.125, 0, .125, .25], samples = offsets.map(x => at(t + x));
  const q = Array.from({ length: 3 }, (_, j) => fit(samples.map(g => g.q[j])));
  const contacts = {};
  for (const [b, names] of [[0, ['penumbralBegin', 'penumbralEnd']], [1, ['partialBegin', 'partialEnd']], [2, ['totalBegin', 'totalEnd']]]) {
    for (const n of names)
      contacts[n] = null;
    if (b === 1 && kind === 'penumbral' || b === 2 && kind !== 'total')
      continue;
    const r = fit(samples.map(g => radius(g, b)));
    const fun = x => q.reduce((s, c) => s + evalPoly(c, x) ** 2, 0) - evalPoly(r, x) ** 2;
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      let answer = null;
      for (let i = 0; i < 2; i++) {
        const left = Math.min(sign * i * .125, sign * (i + 1) * .125), right = Math.max(sign * i * .125, sign * (i + 1) * .125);
        if (f(samples[Math.round(left / .125) + 2], b) * f(samples[Math.round(right / .125) + 2], b) > 0)
          continue;
        const fn = directContacts ? x => f(at(t + x), b) : fun;
        if (fn(left) * fn(right) > 0)
          answer = bisect(x => f(at(t + x), b), left, right);
        else
          answer = bisect(fn, left, right);
        break;
      }
      if (answer === null)
        throw Error(`Lunar contact bracket failed k=${k}`);
      contacts[names[side]] = t + answer;
    }
  }
  return { kind, maximum: t, contacts, umbralMagnitude: (g.er + RM - g.rho) / (2 * RM), penumbralMagnitude: (g.Er + RM - g.rho) / (2 * RM), counts: provider.counts };
}

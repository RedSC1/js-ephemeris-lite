// Internal, unit-agnostic vector helpers. Public sky APIs use degrees and AU.
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const normDeg = x => ((x % 360) + 360) % 360;
export const signedDeg = x => normDeg(x + 180) - 180;
export const clamp = x => Math.max(-1, Math.min(1, x));
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const scale = (v, s) => v.map(x => x * s);
export const unit = v => scale(v, 1 / Math.hypot(...v));
export const transform = (m, v) => m.map(row => dot(row, v));
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function rotateX(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
}
export function rotateZ(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
}
export function spherical(v) {
  return {
    longitudeDeg: normDeg(Math.atan2(v[1], v[0]) * RAD),
    latitudeDeg: Math.atan2(v[2], Math.hypot(v[0], v[1])) * RAD,
    distanceAu: Math.hypot(...v),
  };
}
export function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

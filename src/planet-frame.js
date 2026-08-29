// Shared VSOP2013/TOP2013 native axes → mean J2000 ecliptic.
// Native → ICRF: official VSOP2013.f / TOP2013.f, eps=23°26′21.41136″, phi=-0.05188″.
// Then ICRF → library J2000: IAU2006 obliquity and Vondrak2011 including frame bias.
// Keep this rotation after spherical evaluation; it is not a scalar L/B offset.
const TO_J2000 = [
  [0.9999999999999803, 1.9786988844634012e-7, 2.0200940272138296e-9],
  [-1.978698884606213e-7, 0.9999999999999803, 7.069560215011705e-9],
  [-2.020092628360702e-9, -7.0695604925674616e-9, 1],
];

export function planetTheoryToJ2000(vector) {
  return TO_J2000.map(row => row.reduce((sum, value, k) => sum + value * vector[k], 0));
}

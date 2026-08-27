import { spawnSync } from 'node:child_process';
import { writeNativeFixture } from './write-fixture.mjs';

// Oracle inputs are independent of JS search outputs. Never seed C++ with JS roots.
const [binary, bsp, output] = process.argv.slice(2);
if (!binary || !bsp || !output) throw new Error('usage: node generate-sky.mjs BINARY DE441_BSP OUTPUT_JSON');
const ids = { sun: 10, moon: 301, mercury: 1, venus: 2, mars: 4, jupiter: 5, saturn: 6, uranus: 7, neptune: 8 };
const frames = { 'j2000': 4, 'mean-of-date': 6, 'true-of-date': 2 };
const rows = [], commands = [];
const add = (row, command) => { rows.push(row); commands.push(command.join(' ')); };
const epochs = [2451545, 2460310.5, 2460409.25, 2460482.5, 2460665.5];
const observers = [
  { longitudeDeg: 116.4, latitudeDeg: 39.9, heightMeters: 40 },
  { longitudeDeg: -104.9903, latitudeDeg: 39.7392, heightMeters: 1609 },
  { longitudeDeg: 151.2, latitudeDeg: -33.9, heightMeters: 58 },
  { longitudeDeg: 15, latitudeDeg: 78, heightMeters: 0 },
];
for (const [body, id] of Object.entries(ids)) {
  for (const jd of epochs) add({ kind: 'phenomena', body, jd }, ['p', id, jd]);
  for (const [site, observer] of observers.entries()) {
    for (const jd of [2460409.25, 2460482.5, 2460665.5]) {
      for (const refraction of [false, true]) {
        const weather = { ...observer, pressureMbar: site === 1 ? 835 : 1013.25, temperatureCelsius: site === 3 ? -10 : 15 };
        const args = [observer.longitudeDeg, observer.latitudeDeg, observer.heightMeters, weather.pressureMbar, weather.temperatureCelsius, +refraction];
        add({ kind: 'horizontal', body, jd, observer: weather, options: { refraction } }, ['h', id, jd, ...args, 2, 0]);
        // Include centre/no-refraction and upper-limb/refraction conventions.
        const limb = refraction ? 'upper' : 'center';
        add({ kind: 'visibility', body, jd, observer: weather, options: { refraction, limb } }, ['v', id, jd, ...args, refraction ? 1 : 2, 0]);
      }
    }
  }
  if (['sun', 'moon', 'venus'].includes(body)) for (const observer of observers) for (const refraction of [false, true]) {
    const jd = 2460409.25;
    add({ kind: 'visibility', body, jd, observer, options: { limb: 'lower', horizonDegrees: 2, refraction } },
      ['v', id, jd, observer.longitudeDeg, observer.latitudeDeg, observer.heightMeters, 1013.25, 15, +refraction, 3, 2]);
  }
  for (const [frame, frameId] of Object.entries(frames)) {
    const start = 2460310.5, end = 2460676.5;
    const options = { apparent: { frame } };
    add({ kind: 'stations', body, start, end, options }, ['s', id, start, end, 0, 10, frameId]);
    for (const angle of [0, 90, 180, 270]) {
      add({ kind: 'longitude', body, start, end, angle, options }, ['l', id, start, end, angle, 10, frameId]);
    }
    if (body !== 'sun') for (const angle of [0, 90, 180, 270]) {
      add({ kind: 'relative', body, other: 'sun', start, end, angle, options }, ['a', id, start, end, angle, 10, frameId]);
    }
    // Merge twelve independent native longitude searches for the ingress oracle.
    for (let angle = 0; angle < 360; angle += 30) {
      add({ kind: 'ingress-boundary', body, start, end, angle, options }, ['l', id, start, end, angle, 10, frameId]);
    }
  }
}
const result = spawnSync(binary, [bsp], { input: commands.join('\n') + '\n', encoding: 'utf8', maxBuffer: 32e6 });
if (result.status !== 0) throw new Error(`C++ exit ${result.status}: ${result.stderr}; ${result.error ?? ''}; next input: ${commands[result.stdout.trim() ? result.stdout.trim().split(/\r?\n/).length : 0]}; tail: ${result.stdout.slice(-200)}`);
const lines = result.stdout.trim().split(/\r?\n/);
if (lines.length !== rows.length) throw new Error(`expected ${rows.length} oracle rows, received ${lines.length}`);
for (let i = 0; i < rows.length; i++) rows[i].expected = JSON.parse(lines[i]);
const fixture = { source: 'taiyin-ephemeris C++ / JPL DE441', conventions: 'TT for phenomena and longitude searches; UT1 for horizontal/visibility; north-through-east azimuth; hybrid refraction; native independent interval searches', rows };
writeNativeFixture(output, fixture, binary, './sky.cpp');
console.log(`wrote ${rows.length} native oracle rows to ${output}`);

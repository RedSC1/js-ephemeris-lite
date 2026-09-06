import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/eclipses.js';
import { JulianTime } from '../src/time.js';
import { solveSolarPolynomial } from '../src/eclipse-solar.js';
import { solveSolar, axisIntersection } from '../src/eclipse-geometry.js';
import { coneDiscriminantFast } from '../src/eclipse-cone.js';
import { solveLunar } from '../src/eclipse-lunar.js';
const tt = x => JulianTime.fromTT(2451545 + x);
test('eclipse subpath exposes modern APIs without legacy calculators', () => {
  for (const name of ['ecFast', 'ysPL', 'rsGS', 'rsPL'])
    assert.equal(name in api, false);
  assert.equal(typeof api.getSolarEclipseDetails, 'function');
});
test('grazing solar eclipses survive geometric classification', () => {
  for (const near of [-343287.6017978299, -178123.22420314816, 385970.0547769653, -23737.277315980806]) {
    const e = api.getSolarEclipseDetails(tt(near));
    assert.equal(e.kind, 'partial');
    assert.ok(e.magnitude > 0 && e.magnitude < .01);
    assert.ok(e.contacts.partialBegin.time.jdTT < e.contacts.partialEnd.time.jdTT);
  }
});
test('global circumstances remain physically consistent for total, annular and hybrid eclipses', () => {
  for (const [near, kind, lon, lat, width, duration] of [
    [8509, 'hybrid', 125.77, -9.60, 54, 83],
    [8687, 'annular', -83.11, 11.37, 182, 309],
    [8864, 'total', -104.15, 25.29, 202, 274],
  ]) {
    const e = api.getSolarEclipseDetails(tt(near));
    assert.equal(e.kind, kind);
    assert.ok(Math.abs(e.maximumLocation.longitudeDeg - lon) < .05);
    assert.ok(Math.abs(e.maximumLocation.latitudeDeg - lat) < .05);
    assert.ok(Math.abs(e.pathWidthKm - width) < 5);
    assert.ok(Math.abs(e.centralDurationSeconds - duration) < 3);
    const local = api.getLocalSolarEclipse(tt(near), e.maximumLocation);
    assert.equal(local.visible, true);
    assert.equal(local.kind, kind === 'hybrid' ? 'total' : kind);
    const c = local.contacts;
    assert.ok(c.partialBegin.jdTT < c.centralBegin.jdTT);
    assert.ok(c.centralBegin.jdTT < c.maximum.jdTT && c.maximum.jdTT < c.centralEnd.jdTT);
    assert.ok(c.centralEnd.jdTT < c.partialEnd.jdTT);
    assert.ok(Math.abs((c.centralEnd.jdTT - c.centralBegin.jdTT) * 86400 - e.centralDurationSeconds) < .01);
  }
});
test('noncentral eclipses have no inverted central contact interval', () => {
  for (const near of [5231.76, -11748.26]) {
    const e = api.getSolarEclipseDetails(tt(near));
    assert.ok(['annular', 'total'].includes(e.kind));
    assert.equal(e.contacts.centralBegin, null);
    assert.equal(e.contacts.centralEnd, null);
    assert.equal(e.centralDurationSeconds, 0);
    assert.equal(e.pathWidthKm, 0);
  }
});
test('five-point solar interpolation preserves direct-geometry contact roots', () => {
  for (const k of [-80000, -11700, -804, 283, 300, 600, 42000, 90000]) {
    const p = solveSolarPolynomial(k);
    if (!p)
      continue;
    const direct = solveSolar(k, { seedTime: p.conjunction, cone: coneDiscriminantFast,
      greatestSteps: [.0625, 1 / 1440, .25 / 1440, .0625 / 1440] });
    assert.equal(p.kind, direct.kind);
    assert.ok(Math.abs(p.maximum - direct.maximum) * 86400 < .1);
    for (const [name, time] of Object.entries(p.contacts)) {
      if (time === null) {
        assert.equal(direct.contacts[name], null);
        continue;
      }
      assert.ok(Math.abs(time - direct.contacts[name]) * 86400 < .1, `${k} ${name}`);
      const e = p.at(time), fn = t => {
        const a = p.at(t);
        return name.startsWith('central') ? axisIntersection(a).disc : coneDiscriminantFast(a, a.l1);
      };
      const slope = (fn(time + 1 / 86400) - fn(time - 1 / 86400)) / 2;
      assert.ok(Math.abs(fn(time) / slope) < .05, `${name} equation residual in seconds`);
    }
  }
});
test('lunar cubic contacts agree with direct 3-D shadow roots', () => {
  let count = 0;
  for (let k = 270; k < 305; k++) {
    const e = solveLunar(k);
    if (!e)
      continue;
    const direct = solveLunar(k, { directContacts: true });
    count++;
    assert.equal(e.kind, direct.kind);
    for (const [key, value] of Object.entries(e.contacts)) {
      if (value === null)
        assert.equal(direct.contacts[key], null);
      else
        assert.ok(Math.abs(value - direct.contacts[key]) * 86400 < .03, key);
    }
  }
  assert.ok(count >= 4);
});
test('local solar visibility handles sunset and hidden eclipses', () => {
  const sunset = api.getLocalSolarEclipse(tt(8509), { longitudeDeg: -175, latitudeDeg: -35 });
  assert.equal(sunset.visible, true);
  assert.equal(sunset.horizonClipped, 'sunset');
  assert.ok(sunset.contacts.partialBegin);
  assert.equal(sunset.contacts.partialEnd, null);
  const hidden = api.getLocalSolarEclipse(tt(8864), { longitudeDeg: 116.4, latitudeDeg: 39.9 });
  assert.equal(hidden.visible, false);
  assert.equal(hidden.kind, 'none');
  assert.ok(Object.values(hidden.contacts).every(v => v === null));
});
test('search boundaries and independent results are preserved', () => {
  const first = api.getSolarEclipseDetails(tt(8864));
  const second = api.getSolarEclipseDetails(tt(8687));
  assert.notEqual(first.contacts, second.contacts);
  assert.equal(first.kind, 'total');
  assert.equal(api.searchSolarEclipses(first.maximum, JulianTime.fromTT(first.maximum.jdTT + 1)).length, 1);
  assert.equal(api.searchSolarEclipses(JulianTime.fromTT(first.maximum.jdTT - 1), first.maximum).length, 0);
});

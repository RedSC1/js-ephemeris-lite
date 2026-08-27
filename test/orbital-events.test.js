import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as events from '../src/orbital-events.js';
import { apparentBodyPosition, apparentBodyState } from '../src/apparent.js';
import { moonGeocentricState, earthHeliocentricState } from '../src/ephemeris.js';
import { bodyPhenomena } from '../src/phenomena.js';
import { signedDeg } from '../src/sky-math.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/orbital-de441.json',import.meta.url)));

test('orbital events agree with C++ DE441 fixtures at documented model tolerances',()=>{
  const cache=new Map();
  const tolerances={searchLunarApsides:25,searchEarthApsides:75,searchLunarNodes:6,
    searchGreatestElongations:3,searchRightAscensionStations:8,searchRelativeRightAscension:1};
  for(const c of fixture.samples) {
    const key=JSON.stringify([c.fn,c.body,c.start,c.end,c.options]);
    if(!cache.has(key)) {
      const args=c.fn==='searchRelativeRightAscension'?[c.body,'moon',0]:c.body?[c.body]:[];
      cache.set(key,events[c.fn](...args,c.start,c.end,c.options));
    }
    const found=cache.get(key).find(e=>Math.abs(e.jdTT-c.event.jdTT)<0.01);
    assert.ok(found,`${key}: missing event`);
    assert.ok(Math.abs(found.jdTT-c.oracleJdTT)*86400<tolerances[c.fn],`${c.fn}: model tolerance`);
  }
  for(const [key,found] of cache) {
    assert.equal(found.length,fixture.samples.filter(c=>JSON.stringify([c.fn,c.body,c.start,c.end,c.options])===key).length);
  }
});

test('apsides are radial-velocity roots with the advertised physical center',()=>{
  for(const [fn,state] of [[events.searchLunarApsides,moonGeocentricState],[events.searchEarthApsides,earthHeliocentricState]]) {
    for(const e of fn(2461041.5,2461406.5)) {
      const radius=t=>Math.hypot(...state(t).position);
      const center=radius(e.jdTT),before=radius(e.jdTT-0.05),after=radius(e.jdTT+0.05);
      assert.ok(e.kind==='periapsis'?center<before && center<after:center>before && center>after);
      assert.ok(e.distanceKm>300000);
    }
  }
});

test('lunar node planes remain distinct; true equinox only shifts the longitude',()=>{
  const args=[2461041.5,2461072.5];
  const mean=events.searchLunarNodes(...args);
  const truth=events.searchLunarNodes(...args,{frame:'true-of-date'});
  const fixed=events.searchLunarNodes(...args,{frame:'j2000'});
  assert.equal(mean.length,2);
  for(let i=0;i<mean.length;i++) {
    assert.ok(Math.abs(mean[i].latitudeDeg)<1e-7);
    assert.equal(mean[i].jdTT,truth[i].jdTT);
    assert.notEqual(mean[i].longitudeDeg,truth[i].longitudeDeg);
    assert.ok(Math.abs(mean[i].jdTT-fixed[i].jdTT)>1e-7);
  }
});

test('greatest elongations are 3D maxima, not conjunction minima',()=>{
  const e=events.searchGreatestElongations('mercury',2461041.5,2461406.5);
  assert.equal(e.length,6);
  assert.deepEqual(e.map(r=>r.kind),['eastern','western','eastern','western','eastern','western']);
  for(const r of e) for(const offset of [-0.05,0.05]) assert.ok(r.elongationDeg>bodyPhenomena('mercury',r.jdTT+offset).solarElongationDeg);
});

test('right ascension events are not accidentally ecliptic-longitude events',()=>{
  const station=events.searchRightAscensionStations('mercury',2460401.5,2460431.5)[0];
  assert.ok(Math.abs(station.rightAscensionSpeedDegPerDay)<1e-5);
  assert.ok(Math.abs(apparentBodyState('mercury',station.jdTT).longitudeSpeedDegPerDay)>1e-4);
  const roots=events.searchRelativeRightAscension('venus','moon',0,2461041.5,2461072.5);
  for(const r of roots) {
    const a=apparentBodyPosition('venus',r.jdTT),b=apparentBodyPosition('moon',r.jdTT);
    assert.ok(Math.abs(signedDeg(a.rightAscensionDeg-b.rightAscensionDeg))<1e-6);
  }
});

test('orbital APIs reject invalid requests and preserve empty half-open intervals',()=>{
  assert.throws(()=>events.searchLunarNodes(0,1,{frame:'icrs'}),/frame/);
  assert.throws(()=>events.searchGreatestElongations('mars',0,1),/mercury/);
  assert.throws(()=>events.searchRelativeRightAscension('moon','moon',0,0,1),/different/);
  assert.throws(()=>events.searchEarthApsides(1,0),/precede/);
  assert.deepEqual(events.searchLunarApsides(2451545,2451545),[]);
  assert.deepEqual(events.searchLunarNodes(2451545,2451545),[]);
});

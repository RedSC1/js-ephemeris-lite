import test from 'node:test';
import assert from 'node:assert/strict';
import { J2000 } from '../src/coordinates.js';
import {
 getLocalSolarEclipse,getLunarEclipseDetails,getSolarEclipseDetails,
 getLocalLunarEclipse,
 searchLunarEclipses,searchSolarEclipses,ECLIPSE_SEARCH_INFO,
} from '../src/eclipse-search.js';
import { JulianTime, ZonedTime } from '../src/time.js';

test('modern solar search enumerates every eclipse in a half-open Date range',()=>{
 const events=searchSolarEclipses(
  new Date('2023-01-01T00:00:00Z'),new Date('2025-01-01T00:00:00Z'),
 );
 assert.deepEqual(events.map(event=>event.code),['H','A','T','A']);
 assert.deepEqual(events.map(event=>event.kind),['hybrid','annular','total','annular']);
 assert.equal(events[2].maximum.toDate().toISOString().slice(0,16),'2024-04-08T18:17');
 assert.ok(events.every(event=>event.contacts.partialBegin&&event.contacts.partialEnd));
 assert.ok(events.every(event=>Number.isFinite(event.maximumLocation.longitudeDeg)));
});

test('single solar details accept normal time objects and return null for a non-eclipse lunation',()=>{
 const instant=new ZonedTime({year:2024,month:4,day:8,hour:18,minute:0,second:0,offsetMinutes:0});
 const event=getSolarEclipseDetails(instant);
 assert.equal(event.code,'T');
 assert.equal(event.kind,'total');
 assert.ok(event.magnitude>1);
 assert.equal(getSolarEclipseDetails(new Date('2024-01-11T12:00:00Z')),null);
});

test('lunar search distinguishes penumbral, partial and total contacts',()=>{
 const events=searchLunarEclipses(
  new Date('2022-01-01T00:00:00Z'),new Date('2025-01-01T00:00:00Z'),
 );
 assert.deepEqual(events.map(event=>event.kind),['total','total','penumbral','partial','penumbral','partial']);
 const november=getLunarEclipseDetails(new Date('2022-11-08T11:00:00Z'));
 assert.equal(november.kind,'total');
 assert.ok(november.contacts.partialBegin.jdTT<november.contacts.maximum.jdTT);
 assert.ok(november.contacts.maximum.jdTT<november.contacts.partialEnd.jdTT);
 assert.ok(november.contacts.totalBegin&&november.contacts.totalEnd);
 const penumbral=events.find(event=>event.kind==='penumbral');
 assert.ok(penumbral.magnitude>0);
 assert.equal(penumbral.contacts.partialBegin,null);
});

test('local solar details use degrees and metres and preserve horizon clipping',()=>{
 const denver=getLocalSolarEclipse(new Date('2024-04-08T18:00:00Z'),{
  longitudeDeg:-104.9903,latitudeDeg:39.7392,heightMeters:1609,
 });
 assert.equal(denver.visible,true);
 assert.equal(denver.kind,'partial');
 assert.equal(denver.observer.heightMeters,1609);
 assert.ok(denver.contacts.partialBegin&&denver.contacts.maximum&&denver.contacts.partialEnd);

 const sunrise=getLocalSolarEclipse(JulianTime.fromTT(J2000+8509),{
  longitudeDeg:65,latitudeDeg:-70,
 });
 assert.equal(sunrise.visible,true);
 assert.equal(sunrise.horizonClipped,'sunrise');
 assert.equal(sunrise.contacts.partialBegin,null);
 assert.ok(sunrise.contacts.partialEnd);
});

test('local lunar visibility covers moonrise, moonset and an entirely hidden eclipse',()=>{
 const date=new Date('2022-11-08T11:00:00Z');
 const beijing=getLocalLunarEclipse(date,{longitudeDeg:116.4074,latitudeDeg:39.9042,heightMeters:43});
 assert.equal(beijing.visible,true);
 assert.equal(beijing.horizonClipped,'moonrise');
 assert.equal(beijing.moonrises.length,1);
 assert.equal(beijing.contacts.penumbralBegin.visible,false);
 assert.equal(beijing.contacts.partialBegin.visible,true);
 assert.ok(beijing.contacts.maximum.apparentAltitudeDeg>20);

 const newYork=getLocalLunarEclipse(date,{longitudeDeg:-74.006,latitudeDeg:40.7128});
 assert.equal(newYork.visible,true);
 assert.equal(newYork.horizonClipped,'moonset');
 assert.equal(newYork.moonsets.length,1);
 assert.equal(newYork.contacts.maximum.visible,true);
 assert.equal(newYork.contacts.totalEnd.visible,false);

 const london=getLocalLunarEclipse(date,{longitudeDeg:-0.1276,latitudeDeg:51.5072});
 assert.equal(london.visible,false);
 assert.equal(london.horizonClipped,null);
 assert.ok(Object.values(london.contacts).filter(Boolean).every(contact=>!contact.visible));
 assert.equal(getLocalLunarEclipse(new Date('2024-01-11T12:00:00Z'),{
  longitudeDeg:0,latitudeDeg:0,
 }),null);
});

test('eclipse search validates intervals, locations and search size',()=>{
 assert.equal(ECLIPSE_SEARCH_INFO.mapRenderer,false);
 assert.throws(()=>searchSolarEclipses(2460000,2460000),/later than start/);
 assert.throws(()=>searchLunarEclipses(0,200000),/5000 lunations/);
 assert.throws(()=>getSolarEclipseDetails(new Date(Number.NaN)),/valid/);
 assert.throws(()=>getLocalSolarEclipse(new Date('2024-04-08T18:00:00Z'),{
  longitudeDeg:181,latitudeDeg:0,
 }),/longitudeDeg/);
});

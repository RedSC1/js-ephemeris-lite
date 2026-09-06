import * as current from '../../src/eclipse-search.js';
import * as baseline from './legacy-baseline.mjs';
import {JulianTime} from '../../src/time.js';
const start=new Date('1900-01-01'),end=new Date('2100-01-01');
const output={};
for(const body of ['Solar','Lunar']){
 const search=`search${body}Eclipses`;
 const a=performance.now(),old=baseline[search](start,end),b=performance.now(),now=current[search](start,end),c=performance.now();
 const missing=old.filter(e=>!now.some(n=>Math.abs(n.maximum.jdTT-e.maximum.jdTT)<1));
 const extra=now.filter(e=>!old.some(n=>Math.abs(n.maximum.jdTT-e.maximum.jdTT)<1));
 let maxSeconds=0;const kinds=[];
 for(const e of old){const n=now.find(n=>Math.abs(n.maximum.jdTT-e.maximum.jdTT)<1);if(!n)continue;
 maxSeconds=Math.max(maxSeconds,Math.abs(e.maximum.jdTT-n.maximum.jdTT)*86400);
 if(e.kind!==n.kind)kinds.push({date:e.maximum.toDate().toISOString(),old:e.kind,new:n.kind});}
 output[body]={oldCount:old.length,newCount:now.length,missing:missing.length,extra:extra.length,extraConfirmedByLegacyDetails:extra.filter(e=>baseline[`get${body}EclipseDetails`](e.maximum)?.kind).length,oldMs:b-a,newMs:c-b,maxSeconds,kinds};
}
console.log(JSON.stringify(output,null,2));
// Test full-payload broad-epoch queries as well as the raw prototype solver.
let solar=0,lunar=0;
for(let i=0;i<800;i++){
 const date=JulianTime.fromTT(2451545+(-8000+16000*(i+.37)/800)*365.25);
 for(const body of ['Solar','Lunar']){
  const event=current[`get${body}EclipseDetails`](date);if(!event)continue;
  if(body==='Solar')solar++;else lunar++;
  if(!Number.isFinite(event.magnitude)||!Number.isFinite(event.maximum.jdTT))throw Error('invalid result');
  const times=Object.values(event.contacts).filter(Boolean).map(p=>(p.time??p).jdTT);
  if(times.some(t=>!Number.isFinite(t)))throw Error('invalid contact');
  const c=event.contacts;
  const begin=(c.penumbralBegin??c.partialBegin),finish=(c.penumbralEnd??c.partialEnd);
  if((begin.time??begin).jdTT>event.maximum.jdTT||(finish.time??finish).jdTT<event.maximum.jdTT)throw Error('inverted contacts');
  if(body==='Solar'&&(!Number.isFinite(event.pathWidthKm)||event.pathWidthKm<0||!Number.isFinite(event.centralDurationSeconds)||event.centralDurationSeconds<0))throw Error('invalid central dimensions');
 }
}
console.log({wideSamples:800,solar,lunar});

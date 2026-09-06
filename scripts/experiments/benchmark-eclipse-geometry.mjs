import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {getSolarEclipseDetails,getLunarEclipseDetails} from './legacy-baseline.mjs';
import {solveSolar,passes} from './eclipse-geometry.mjs';
import {solveLunar} from './lunar-geometry.mjs';
const oldSolar=k=>getSolarEclipseDetails(2451545+k*29.5306+5);
const oldLunar=k=>getLunarEclipseDetails(2451545+k*29.5306+18);
const stats=a=>{a.sort((x,y)=>x-y);return {n:a.length,rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),p99:a[Math.floor(.99*a.length)],max:a.at(-1)};};
const time=v=>v===null||v===undefined?null:typeof v==='number'?v:(v.time??v).jdTT-2451545;
const original=v=>v&&{...v,maximum:time(v.maximum),contacts:Object.fromEntries(Object.entries(v.contacts).filter(([k])=>k!=='maximum').map(([k,v])=>[k,time(v)]))};
const start=Number(process.argv[2]??1900),end=Number(process.argv[3]??2100);
const lo=Math.floor((start-2000)*365.25/29.5306),hi=Math.ceil((end-2000)*365.25/29.5306);
const report={start,end,lunations:hi-lo,solar:{},lunar:{}};
for(const [name,oldFn,fn] of [['solar',oldSolar,solveSolar],['lunar',oldLunar,solveLunar]]){
 const out=report[name],events=[],maxDiff=[],contactDiff=[],magDiff=[],windowDiff=[];out.mismatches=[];out.counts=[];
 for(let k=lo;k<hi;k++){
  const old=original(oldFn(k)),n=fn(k),w=name==='solar'?fn(k,{window:true}):n;
  if(Boolean(old)!==Boolean(n)||old&&n&&old.kind!==n.kind)out.mismatches.push({k,old:old?.kind,new:n?.kind});
  if(Boolean(n)!==Boolean(w)||n&&w&&n.kind!==w.kind)out.mismatches.push({k,window:w?.kind,direct:n?.kind});
  if(!n)continue;events.push(k);out.counts.push(n.counts);
  if(!old)continue;
  maxDiff.push(Math.abs(n.maximum-old.maximum)*86400);
  const mag=name==='solar'?'magnitude':'umbralMagnitude';
  if(n[mag]!=null&&old[mag]!=null)magDiff.push(Math.abs(n[mag]-old[mag]));
  for(const [key,v] of Object.entries(n.contacts)){
   if((v===null)!==(old.contacts[key]===null))out.mismatches.push({k,contact:key,old:old.contacts[key],new:v});
   if(v!==null&&old.contacts[key]!=null)contactDiff.push(Math.abs(v-old.contacts[key])*86400);
   if(v!==null&&w.contacts[key]!=null)windowDiff.push(Math.abs(v-w.contacts[key])*86400);
  }
 }
 out.events=events.length;out.maxDeltaSeconds=stats(maxDiff);out.contactDeltaSeconds=stats(contactDiff);out.magnitudeDelta=stats(magDiff);
 if(name==='solar')out.windowVsDirectSeconds=stats(windowDiff);
 out.timings={oldSearch:[],filteredOldSearch:[],newSearch:[],oldEvents:[],newEvents:[]};
 if(name==='solar'){out.timings.windowSearch=[];out.timings.windowEvents=[];}
 const all=Array.from({length:hi-lo},(_,i)=>lo+i);
 for(let round=0;round<3;round++){
  let cases=[['oldSearch',oldFn,all],['filteredOldSearch',k=>passes(k,name==='lunar')?oldFn(k):null,all],['newSearch',fn,all],['oldEvents',oldFn,events],['newEvents',fn,events]];
  if(name==='solar')cases.push(['windowSearch',k=>fn(k,{window:true}),all],['windowEvents',k=>fn(k,{window:true}),events]);
  if(round%2)cases.reverse();
  for(const [label,method,inputs] of cases){const t=performance.now();let count=0;for(const k of inputs)if(method(k))count++;out.timings[label].push(performance.now()-t);if(count!==events.length)out.mismatches.push({label,count});}
 }
 out.meanPairs=out.counts.reduce((s,c)=>s+c.exactPairs,0)/out.counts.length;delete out.counts;
 console.log(name,JSON.stringify(out));
 writeFileSync('/tmp/eclipse-geometry-result.json',JSON.stringify(report,null,2));
}

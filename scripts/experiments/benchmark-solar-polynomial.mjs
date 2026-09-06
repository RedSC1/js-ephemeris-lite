import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {getSolarEclipseDetails} from './legacy-baseline.mjs';
import {solveSolar} from './eclipse-geometry.mjs';
import {solveSolarPolynomial as polynomial} from './solar-polynomial.mjs';
const count=Number(process.argv[2]??7);
const solveSolarPolynomial=k=>polynomial(k,{count});
const old=k=>getSolarEclipseDetails(2451545+k*29.5306+5),events=[],diffs=[],maximum=[],mismatches=[];
const all=Array.from({length:2474},(_,i)=>i-1237);
let extra=0;
for(const k of all){const o=old(k),p=solveSolarPolynomial(k);if(Boolean(o)!==Boolean(p))mismatches.push({k,old:o?.kind,poly:p?.kind});if(p){events.push(k);extra+=Math.max(0,p.counts.exactPairs-count);}}
for(const k of events){
 const p=solveSolarPolynomial(k),r=solveSolar(k,{seedTime:p.maximum});
 if(p.kind!==r?.kind)mismatches.push({k,poly:p.kind,direct:r?.kind});
 maximum.push(Math.abs(p.maximum-r.maximum)*86400);
 for(const [key,v] of Object.entries(p.contacts)){if((v===null)!==(r.contacts[key]===null))mismatches.push({k,key});if(v!==null&&r.contacts[key]!==null)diffs.push(Math.abs(v-r.contacts[key])*86400);}
}
const stats=a=>{a.sort((a,b)=>a-b);return {n:a.length,rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),p99:a[Math.floor(.99*a.length)],max:a.at(-1)};};
const times={oldEvents:[],polyEvents:[],oldSearch:[],polySearch:[]};
for(let r=0;r<3;r++){
 let cases=[['oldEvents',old,events],['polyEvents',solveSolarPolynomial,events],['oldSearch',old,all],['polySearch',solveSolarPolynomial,all]];if(r%2)cases.reverse();
 for(const [key,fn,inputs] of cases){const t=performance.now();let n=0;for(const k of inputs)if(fn(k))n++;if(n!==events.length)throw Error('count');times[key].push(performance.now()-t);}
}
const out={sampleCount:count,events:events.length,mismatches,extraExactPairs:extra,maximumVsDirectSeconds:stats(maximum),contactVsDirectSeconds:stats(diffs),times};
writeFileSync(`/tmp/solar-polynomial-${count}-result.json`,JSON.stringify(out,null,2));console.log(out);

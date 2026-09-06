import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {ysPL} from './legacy-baseline.mjs';
import {solve,counters} from './lunar-elements.mjs';
const start=Number(process.argv[2]??1900),end=Number(process.argv[3]??2100);
const inputs=[];
for(let k=Math.floor((start-2000)*365.25/29.5306);k<Math.ceil((end-2000)*365.25/29.5306);k++)inputs.push(k*29.5306+18);
let mismatches=0,fallbacks=0;const events=[],diffs=[];
for(const jd of inputs){
 const old=ysPL.lecMax(jd),next=solve(jd);
 if(old.LX!==next.LX||old.lT.some((v,i)=>Boolean(v)!==Boolean(next.lT[i])))mismatches++;
 fallbacks+=next.fallbacks;
 if(old.lT[3]){events.push(jd);for(let i=0;i<7;i++)if(old.lT[i])diffs.push(Math.abs(old.lT[i]-next.lT[i])*86400);}
}
const stats=a=>{a.sort((x,y)=>x-y);return {n:a.length,rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),p99:a[Math.floor(a.length*.99)],max:a.at(-1)};};
const exactOld=[],exactNew=[];let worst=null;
// Independently solve the unapproximated JS geometry for a distributed subset.
for(let k=0;k<events.length;k+=Math.max(1,Math.floor(events.length/45))){
 const jd=events[k],old=ysPL.lecMax(jd),next=solve(jd),ref=solve(jd,{direct:true});
 for(let i=0;i<7;i++)if(ref.lT[i]&&i!==1){
  const a=Math.abs(old.lT[i]-ref.lT[i])*86400,b=Math.abs(next.lT[i]-ref.lT[i])*86400;
  exactOld.push(a);exactNew.push(b);if(!worst||b>worst.errorSeconds)worst={jdTT:jd+2451545,contact:i,errorSeconds:b};
 }
}
function bench(fn,list){const t=performance.now();let sum=0;for(const jd of list)sum+=fn(jd).jd;return {ms:performance.now()-t,checksum:sum};}
for(let i=0;i<15;i++){ysPL.lecMax(events[i]);solve(events[i]);}
const timings={searchOld:[],searchNew:[],eventsOld:[],eventsNew:[]};
for(let round=0;round<3;round++){
 const order=round%2?[['New',solve],['Old',ysPL.lecMax]]:[['Old',ysPL.lecMax],['New',solve]];
 for(const [label,fn] of order){timings['search'+label].push(bench(fn,inputs).ms);timings['events'+label].push(bench(fn,events).ms);}
}
const result={start,end,lunations:inputs.length,events:events.length,mismatches,fallbacks,oldNewSeconds:stats(diffs),directGeometryErrorSeconds:{old:stats(exactOld),cubic:stats(exactNew),worst},timings};
writeFileSync('/tmp/lunar-elements-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

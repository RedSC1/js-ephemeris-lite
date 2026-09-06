import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {ysPL} from './legacy-baseline.mjs';
import {solve} from './lunar-elements.mjs';
// C++ Meeus F filter, including its 23-degree node margin. k=0 is Jan 2000.
function passes(k){
 const h=k+.5,T=h/1236.85;
 const F=(160.7108+390.67050274*h-.0016341*T*T-.00000227*T**3+.000000011*T**4)*Math.PI/180;
 return Math.abs(Math.sin(F))<=Math.sin(23*Math.PI/180);
}
const lo=Math.floor(-100*365.25/29.5306),hi=Math.ceil(100*365.25/29.5306);
let rejected=0,missed=0,events=0;const inputs=[];
for(let k=lo;k<hi;k++){
 const jd=k*29.5306+18,old=ysPL.lecMax(jd);inputs.push(k);
 if(old.lT[3])events++;
 if(!passes(k)){rejected++;if(old.lT[3])missed++;}
}
// Stratified samples across the library's broad range, without claiming exhaustive coverage.
let wideMissed=0,wideEvents=0;
for(let i=0;i<1600;i++){
 const year=-6000+(i+.371)*10,k=Math.floor((year-2000)*365.25/29.5306);
 const event=ysPL.lecMax(k*29.5306+18);
 if(event.lT[3]){wideEvents++;if(!passes(k))wideMissed++;}
}
const timings={old:[],filteredOld:[],filteredCubic:[]};
for(let r=0;r<3;r++){
 let cases=[['old',ysPL.lecMax,false],['filteredOld',ysPL.lecMax,true],['filteredCubic',solve,true]];
 if(r%2)cases.reverse();
 for(const [name,fn,filter] of cases){
  const start=performance.now();let count=0;
  for(const k of inputs){if(filter&&!passes(k))continue;if(fn(k*29.5306+18).lT[3])count++;}
  if(count!==events)throw Error('Timing search event count mismatch');
  timings[name].push(performance.now()-start);
 }
}
const out={lunations:inputs.length,events,rejected,missed,wide:{samples:1600,events:wideEvents,missed:wideMissed},timings};
writeFileSync('/tmp/lunar-filter-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));

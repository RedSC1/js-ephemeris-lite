// Experiment: C++-style five-sample cubic contact solver on the existing JS
// lunar geometry. This isolates contact solving; it is not the full C++ model.
import { ysPL } from './legacy-baseline.mjs';
import { lunarPhaseTimeAccurate } from '../../src/calendar-events.js';
const DAY=86400, HALF=0.25;
export const counters={geometry:0};
const geometry=t=>{counters.geometry++;return ysPL.lecXY(t,{});};
const radius=(g,b)=>b===0?g.Er+g.mr:b===1?g.er+g.mr:g.er-g.mr;
const value=(g,b)=>g.x*g.x+g.y*g.y-radius(g,b)**2;
export function fit(values){
 const a=Array.from({length:4},()=>Array(5).fill(0));
 for(let i=0;i<5;i++){
  const x=(i-2)/2;
  for(let r=0;r<4;r++){
   for(let c=0;c<4;c++)a[r][c]+=x**(r+c);
   a[r][4]+=values[i]*x**r;
  }
 }
 for(let c=0;c<4;c++){
  let p=c;for(let r=c+1;r<4;r++)if(Math.abs(a[r][c])>Math.abs(a[p][c]))p=r;
  [a[c],a[p]]=[a[p],a[c]];
  const d=a[c][c];for(let j=c;j<5;j++)a[c][j]/=d;
  for(let r=0;r<4;r++)if(r!==c){const f=a[r][c];for(let j=c;j<5;j++)a[r][j]-=f*a[c][j];}
 }
 return a.map(row=>row[4]);
}
const poly=(c,t)=>{const x=t/HALF;return c[0]+x*(c[1]+x*(c[2]+x*c[3]));};
function root(fn,left,right){
 let fl=fn(left),fr=fn(right);
 if(fl*fr>0)return null;
 for(let i=0;i<48&&right-left>1e-10;i++){
  const mid=(left+right)/2,f=fn(mid);
  if(fl*f<=0)right=mid;else{left=mid;fl=f;}
 }
 return (left+right)/2;
}
export function solve(jd,{direct=false}={}){
 // Keep current phase seed and maximum refinement identical to production.
 const phase=(Math.floor((jd-4)/29.5306)*2+1)*Math.PI;
 let t=lunarPhaseTimeAccurate(phase)-2451545;
 let g=geometry(t);
 const dt=60/DAY;
 for(let i=0;i<3;i++){
  const next=geometry(t+dt),u=(next.y-g.y)/dt,v=(next.x-g.x)/dt;
  t-= (g.y*u+g.x*v)/(u*u+v*v);g=geometry(t);
 }
 const rmin=Math.hypot(g.x,g.y),lT=Array(7).fill(0);
 let LX='',sf=0,penumbralMagnitude=0;
 if(rmin<=g.mr+g.er){LX='偏';sf=(g.mr+g.er-rmin)/g.mr/2;lT[1]=t;}
 if(rmin<=g.er-g.mr)LX='全';
 if(rmin>g.mr+g.Er)return {lT,LX,sf,penumbralMagnitude,jd:t,fallbacks:0};
 penumbralMagnitude=(g.mr+g.Er-rmin)/g.mr/2;
 const offsets=[-HALF,-HALF/2,0,HALF/2,HALF];
 const samples=offsets.map(o=>o===0?g:geometry(t+o));
 const cx=fit(samples.map(s=>s.x)),cy=fit(samples.map(s=>s.y));
 let fallbacks=0;
 for(const [b,early,late] of [[0,3,4],[1,0,2],[2,5,6]]){
  if(b===1&&!LX||b===2&&LX!=='全')continue;
  const cr=fit(samples.map(s=>radius(s,b)));
  const f=o=>poly(cx,o)**2+poly(cy,o)**2-poly(cr,o)**2;
  for(const [side,index] of [[-1,early],[1,late]]){
   let answer=null;
   for(let k=0;k<2;k++){
    const a=side*k*HALF/2,z=side*(k+1)*HALF/2;
    const left=Math.min(a,z),right=Math.max(a,z);
    if(value(samples[Math.round(left/(HALF/2))+2],b)*value(samples[Math.round(right/(HALF/2))+2],b)>0)continue;
    answer=root(direct?o=>value(geometry(t+o),b):f,left,right);
    if(answer===null&&!direct){fallbacks++;answer=root(o=>value(geometry(t+o),b),left,right);}
    if(answer!==null)break;
   }
   if(answer===null)throw new Error(`No contact bracket: ${jd} boundary ${b} side ${side}`);
   lT[index]=t+answer;
  }
 }
 return {lT,LX,sf,penumbralMagnitude,jd:t,fallbacks};
}

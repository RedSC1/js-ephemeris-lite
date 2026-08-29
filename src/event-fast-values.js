// One-time numeric table layout compiled from the shared physical series.
// No runtime fitting, calibration, or result cache.
import { EARTH_L, EARTH_B, EARTH_R } from './planet-series.js';
import { MOON_L, MOON_B, MOON_W1, MOON_ARGUMENTS } from './moon-series.js';
import { iau2000bNutationLongitude } from './coordinates.js';
import { FAST_EVENT_FRAME_PROJECTION as FRAMES } from './event-series.js';
function select(blocks,stride,score,limits,pack){
 const ranked=blocks.flatMap((rows,n)=>Array.from({length:rows.length/stride},(_,k)=>({n,i:k*stride,score:score(rows,k*stride)}))).sort((a,b)=>b.score-a.score);
 return Object.fromEntries(limits.map(limit=>{
  const chosen=new Set(ranked.slice(0,limit==='full'?Infinity:limit).map(r=>r.n+':'+r.i));
  return[limit,blocks.map((rows,n)=>{const out=[];for(let i=0;i<rows.length;i+=stride)if(chosen.has(n+':'+i))out.push(...pack(rows,i));return out;})];
 }));
}
const EARTH=[EARTH_L,EARTH_B,EARTH_R].map((b,c)=>select(b,3,(a,i)=>Math.abs(a[i]),c===0?[11,28,48,129,160]:c===1?[0,'full']:[3,30],(a,i)=>a.slice(i,i+3)));
const MOON=[MOON_L,MOON_B].map((b,c)=>select(b,3,(a,i)=>Math.hypot(a[i],a[i+1]),c===0?[8,33,256]:[0,10],(a,i)=>[Math.hypot(a[i],a[i+1]),-Math.atan2(a[i],a[i+1]),...MOON_ARGUMENTS[a[i+2]]]));
const EARTH_DEGREE = Math.max(EARTH_L.length, EARTH_B.length, EARTH_R.length) - 1;
const J=2451545,S=2922000,A=20.4898*Math.PI/648000;
export const wrap=x=>x-2*Math.PI*Math.floor((x+Math.PI)/(2*Math.PI));
const poly=(a,x)=>{let v=0;for(let i=a.length-1;i>=0;i--)v=v*x+a[i];return v;};
function earth(jd,n,bn,rn){
 const x=(jd-J)/S,tau=x*8,b=new Float64Array(EARTH_DEGREE+1);b[0]=1;b[1]=x;
 for(let i=2;i<b.length;i++)b[i]=2*x*b[i-1]-b[i-2];
 for(let i=2;i<b.length;i+=2)b[i]-=(-1)**(i/2);
 const limits=[n,bn,rn],v=[0,0,0];
 for(let c=0;c<3;c++){
  const blocks=EARTH[c][limits[c]];
  for(let p=0;p<blocks.length;p++){const rows=blocks[p];let sum=0;for(let i=0;i<rows.length;i+=3)sum+=rows[i]*Math.cos(rows[i+1]+rows[i+2]*tau);v[c]+=sum*b[p];}
 }
 return v;
}
function moon(jd,n,bn){
 const x=(jd-J)/S,x1=x,x2=x*x,x3=x2*x,x4=x3*x,x5=x4*x,x6=x5*x,x7=x6*x,x8=x7*x,xp=[1,x1,x2,x3,x4,x5,x6,x7,x8],v=[0,0];
 for(let c=0;c<2;c++){
  const blocks=MOON[c][c===0?n:bn];
  for(let p=0;p<blocks.length;p++){
   const rows=blocks[p];let sum=0;
   for(let i=0;i<rows.length;i+=10){const a=rows[i+2]*x1+rows[i+3]*x2+rows[i+4]*x3+rows[i+5]*x4+rows[i+6]*x5+rows[i+7]*x6+rows[i+8]*x7+rows[i+9]*x8;sum+=rows[i]*Math.cos(a+rows[i+1]);}
   v[c]+=sum*xp[p];
  }
 }
 return [v[0]+poly(MOON_W1,x),v[1]];
}
// Offline polynomial projection of the SAME native-to-date rotations. Both
// latitude columns remain present. Cancel the common cos(B) in atan2(Y, X).
function longitude(v,x,offset){
 const cl=Math.cos(v[0]),sl=Math.sin(v[0]),tb=Math.tan(v[1]);
 return Math.atan2(poly(FRAMES[offset+3],x)*cl+poly(FRAMES[offset+4],x)*sl+poly(FRAMES[offset+5],x)*tb,
  poly(FRAMES[offset],x)*cl+poly(FRAMES[offset+1],x)*sl+poly(FRAMES[offset+2],x)*tb);
}
export function fastSolarLongitude(jd,n=160,nut=10,bn='full',rn=30){
 const e=earth(jd,n,bn,rn);
 return wrap(longitude(e,(jd-J)/S,0)+Math.PI)+iau2000bNutationLongitude(jd,nut)-A/e[2];
}
export function fastElongation(jd,m=256,n=129,bn=10,eb='full',rn=30){
 const e=earth(jd,n,eb,rn),v=moon(jd,m,bn),x=(jd-J)/S;
 return wrap(longitude(v,x,6)-longitude(e,x,0)-Math.PI-3.4e-6+A/e[2]);
}

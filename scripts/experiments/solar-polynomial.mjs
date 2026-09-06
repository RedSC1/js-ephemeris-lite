// C++ cone/ellipsoid solver with shared polynomial Sun/Moon vectors.
// No Shou Xing eclipse geometry is used by this experimental path.
import {lunarPhaseTimeAccurate} from '../../src/calendar-events.js';
import {coneDiscriminantFast} from './solar-cone-fast.mjs';
import {pairProvider,solveSolar,passes} from './eclipse-geometry.mjs';
export function vectorPolynomial(center,{halfSpan=.25,count=7}={}){
 const exact=pairProvider(center),nodes=Array.from({length:count},(_,i)=>-1+2*i/(count-1));
 const samples=nodes.map(x=>exact.evaluate(center+x*halfSpan));
 const coefficients=Array.from({length:2},(_,body)=>Array.from({length:3},(_,coord)=>{
  const a=samples.map(p=>p[body][coord]);
  for(let order=1;order<count;order++)for(let i=count-1;i>=order;i--)a[i]=(a[i]-a[i-1])/(nodes[i]-nodes[i-order]);
  return a;
 }));
 return {counts:exact.counts,evaluate(t){
  const x=(t-center)/halfSpan;
  if(Math.abs(x)>1)return exact.evaluate(t);
  return coefficients.map(body=>body.map(a=>{
   let v=a[count-1];for(let i=count-2;i>=0;i--)v=v*(x-nodes[i])+a[i];return v;
  }));
 }};
}
export function solveSolarPolynomial(k,options={}){
 if(!passes(k))return null;
 const seedTime=lunarPhaseTimeAccurate(k*2*Math.PI)-2451545;
 return solveSolar(k,{cone:coneDiscriminantFast,...options,seedTime,providerFactory:center=>vectorPolynomial(center,options),
 greatestSteps:[.0625,1/1440,.25/1440,.0625/1440]});
}

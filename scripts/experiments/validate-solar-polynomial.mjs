import {writeFileSync} from 'node:fs';
import {solveSolarPolynomial as polynomial,vectorPolynomial} from './solar-polynomial.mjs';
const count=Number(process.argv[2]??7);
const solveSolarPolynomial=k=>polynomial(k,{count});
import {solveSolar,pairProvider,norm,sub,solarElements,axisIntersection,coneDiscriminant} from './eclipse-geometry.mjs';
const result={sampleCount:count,wideSamples:800,events:0,missing:[],kindDifferences:[],maxContactDeltaSeconds:0,maxVectorDeltaKm:0,extraExactPairs:0,maxDirectContactResidualSeconds:0};
for(let i=0;i<800;i++){
 const year=-6000+(i+.371)*20,k=Math.floor((year-2000)*365.25/29.5306),p=solveSolarPolynomial(k);
 if(!p)continue;
 result.events++;result.extraExactPairs+=Math.max(0,p.counts.exactPairs-count);
 const d=solveSolar(k,{seedTime:p.maximum});
 if(!d){result.missing.push({k});continue;}
 if(d.kind!==p.kind)result.kindDifferences.push({k,poly:p.kind,direct:d.kind});
 for(const key of Object.keys(p.contacts)){
  const t=p.contacts[key];if(t===null)continue;
  if(d.contacts[key]===null){result.missing.push({k,key});continue;}
  result.maxContactDeltaSeconds=Math.max(result.maxContactDeltaSeconds,Math.abs(t-d.contacts[key])*86400);
 }
}
// Independent vector and contact residual checks on a spread of modern events.
for(let k=-1237;k<1237;k+=11){
 const p=solveSolarPolynomial(k);if(!p)continue;
 const raw=pairProvider(p.maximum),poly=vectorPolynomial(p.maximum,{count});
 for(const o of [-.249,-.17,-.07,.03,.14,.249]){
  const a=raw.evaluate(p.maximum+o),b=poly.evaluate(p.maximum+o);
  for(let j=0;j<2;j++)result.maxVectorDeltaKm=Math.max(result.maxVectorDeltaKm,norm(sub(a[j],b[j])));
 }
 for(const [key,t] of Object.entries(p.contacts)){
  if(t===null)continue;
  const f=t=>{const e=solarElements(raw.evaluate(t));return key.startsWith('central')?axisIntersection(e).disc:coneDiscriminant(e,e.l1);};
  const slope=(f(t+1/86400)-f(t-1/86400))/2;
  result.maxDirectContactResidualSeconds=Math.max(result.maxDirectContactResidualSeconds,Math.abs(f(t)/slope));
 }
}
writeFileSync(`/tmp/solar-polynomial-${count}-validation.json`,JSON.stringify(result,null,2));console.log(result);

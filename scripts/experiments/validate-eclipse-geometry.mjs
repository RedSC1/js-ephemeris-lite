import {writeFileSync} from 'node:fs';
import {getSolarEclipseDetails,getLunarEclipseDetails} from './legacy-baseline.mjs';
import {solveSolar,passes} from './eclipse-geometry.mjs';
import {solveLunar} from './lunar-geometry.mjs';
const stats=a=>({n:a.length,rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),max:Math.max(...a)});
const report={lunarReference:{},solarRadiusCheck:[],wide:{samples:800,solarEvents:0,lunarEvents:0,missing:[],errors:[],kindDifferences:[]}};
const directDiff=[],oldUmbral=[],oldPenumbral=[];
for(let k=-1237;k<1237;k+=9){
 if(!passes(k,true))continue;
 const n=solveLunar(k);if(!n)continue;
 const ref=solveLunar(k,{directContacts:true}),old=getLunarEclipseDetails(2451545+k*29.5306+18);
 for(const [key,v] of Object.entries(n.contacts))if(v!==null)directDiff.push(Math.abs(v-ref.contacts[key])*86400);
 // Production sets umbral magnitude to zero for penumbral-only events.
 if(n.kind!=='penumbral')oldUmbral.push(Math.abs(n.umbralMagnitude-old.umbralMagnitude));
 oldPenumbral.push(Math.abs(n.penumbralMagnitude-old.penumbralMagnitude));
}
report.lunarReference={contactVsDirectSeconds:stats(directDiff),umbralMagnitudeDeltaExcludingPenumbral:stats(oldUmbral),penumbralMagnitudeDelta:stats(oldPenumbral)};
for(const k of [-1120,-903,-639,-416,171]){
 const old=getSolarEclipseDetails(2451545+k*29.5306+5),n=solveSolar(k),aligned=solveSolar(k,{moonRadius:.2722810*6378.1366,sunRadius:109.1222*6378.1366});
 report.solarRadiusCheck.push({k,old:old.kind,cppRadii:n.kind,legacyCoreRadii:aligned.kind});
}
for(let i=0;i<800;i++){
 const year=-6000+(i+.371)*20,k=Math.floor((year-2000)*365.25/29.5306);
 for(const [name,oldFn,fn,offset] of [['solar',getSolarEclipseDetails,solveSolar,5],['lunar',getLunarEclipseDetails,solveLunar,18]]){
  try{
   const old=oldFn(2451545+k*29.5306+offset),n=fn(k);
   if(old)report.wide[name+'Events']++;
   if(Boolean(old)!==Boolean(n))report.wide.missing.push({k,year,name,old:old?.kind,new:n?.kind});
   else if(old&&old.kind!==n.kind)report.wide.kindDifferences.push({k,year,name,old:old.kind,new:n.kind});
  }catch(e){report.wide.errors.push({k,year,name,error:e.message});}
 }
}
writeFileSync('/tmp/eclipse-geometry-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

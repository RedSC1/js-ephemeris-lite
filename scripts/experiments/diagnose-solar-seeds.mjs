import {writeFileSync} from 'node:fs';
import {solveSolar,passes,seed} from './eclipse-geometry.mjs';
import {getSolarEclipseDetails} from './legacy-baseline.mjs';
import {lunarPhaseTimeAccurate} from '../../src/calendar-events.js';
const report={samples:800,events:0,missing:[],kindDifferences:[],seedRecoveries:[]};
for(let i=0;i<800;i++){
 const year=-6000+(i+.371)*20,k=Math.floor((year-2000)*365.25/29.5306);
 const old=getSolarEclipseDetails(2451545+k*29.5306+5);
 if(!passes(k)){if(old)report.missing.push({k,reason:'filter'});continue;}
 const exactSeed=lunarPhaseTimeAccurate(k*2*Math.PI)-2451545;
 const n=solveSolar(k,{seedTime:exactSeed,moonRadius:.2722810*6378.1366,sunRadius:109.1222*6378.1366});
 if(old)report.events++;
 if(Boolean(old)!==Boolean(n))report.missing.push({k,old:old?.kind,new:n?.kind});
 if(old&&n&&old.kind!==n.kind)report.kindDifferences.push({k,old:old.kind,new:n.kind});
 if(old&&n&&!solveSolar(k))report.seedRecoveries.push({k,seedErrorHours:(seed(k)-exactSeed)*24});
}
writeFileSync('/tmp/solar-seed-validation.json',JSON.stringify(report,null,2));console.log(report);

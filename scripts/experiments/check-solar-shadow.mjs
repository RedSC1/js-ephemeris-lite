import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {pairProvider,solarElements,coneDiscriminant,RM,RE,B,seed,passes} from '../../src/eclipse-geometry.js';
import {coneDiscriminantFast} from '../../src/eclipse-cone.js';
const lines=[],expected=[];
for(let k=-1200;k<1250;k+=7){
 if(!passes(k))continue;
 const t=seed(k),p=pairProvider(t);
 for(const dt of [-.2,0,.2]){
  const e=solarElements(p.evaluate(t+dt));
  for(const r of [e.l1,e.l2]){lines.push([-e.x,e.y,e.z,RM/RE,r,Math.PI/2+e.d,B].join(' '));expected.push(coneDiscriminantFast(e,r));}
 }
}
const result=spawnSync(process.argv[2]??'/tmp/solar-shadow-oracle',[],{input:lines.join('\n')+'\n',encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr||`oracle exit ${result.status}`);
const actual=result.stdout.trim().split(/\s+/).map(Number);
if(actual.length!==expected.length)throw Error('oracle row count');
const max=Math.max(...actual.map((x,i)=>Math.abs(x-expected[i])));
if(!Number.isFinite(max)||max>1e-8)throw Error(`geometry mismatch ${max}`);
const out={samples:actual.length,maxDiscriminantDelta:max};console.log(out);
writeFileSync('/tmp/solar-shadow-check.json',JSON.stringify(out,null,2));

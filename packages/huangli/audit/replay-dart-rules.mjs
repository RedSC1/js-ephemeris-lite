import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ruleGroups } from './rule-matrix.mjs';
import { DATA } from '../src/data.js';
import { evaluateAlmanacRules } from '../src/rules.js';
import { calculateYiJi } from '../src/yi-ji.js';
import { BitSet } from '../src/bitset.js';

const oracle=JSON.parse(readFileSync(new URL('./rules-dart-fingerprint.json',import.meta.url)));
assert.equal(createHash('sha256').update(JSON.stringify(DATA)).digest('hex'),oracle.data.dartSha256);
let total=0;
const naturalGods=new Set(),activities=new Set();
for(const [name,rows] of ruleGroups()) {
  const expected=oracle.groups.find(g=>g.name===name),digest=createHash('sha256');
  assert(expected,`missing Dart group: ${name}`);
  let count=0;
  for(const r of rows) {
    let value;
    if(r.godIds) {
      const x=calculateYiJi({monthBranch:r.monthBranch,dayGanZhiIndex:r.dayIndex,
        lunarMonth:r.lunarMonth,lunarDay:r.lunarDay,nextSolarTermIndex:r.nextSolarTermIndex,
        dayOfficerIndex:(r.dayIndex%12-r.monthBranch+12)%12,
        activeRealGods:new BitSet(171,r.godIds),activeVirtualGodsMask:r.virtualMask,
        isPhaseOfMoon:r.isPhaseOfMoon??false,isYeargodDuty:r.isYeargodDuty??true});
      value=[[...r.godIds].sort((a,b)=>a-b),[...x.goodThings],[...x.badThings],x.thingLevel,x.maxLevel];
    } else {
      const x=evaluateAlmanacRules(r);
      value=[x.godIds,[...x.suitableIds].sort((a,b)=>a-b),[...x.tabooIds].sort((a,b)=>a-b),x.thingLevel,x.conflictLevel];
      for(const id of x.godIds)naturalGods.add(id);
    }
    for(const id of [...value[1],...value[2]])activities.add(id);
    digest.update(JSON.stringify(value)+'\n');count++;
  }
  assert.equal(count,expected.count,name);
  assert.equal(digest.digest('hex'),expected.dartSha256,name);
  total+=count;
  console.log(`${name}: ${count} / Dart fingerprint OK`);
}
assert.equal(total,703432);
console.log(JSON.stringify({total,naturalGods:naturalGods.size,activityIdsReturned:activities.size,
  godsNotNaturallyActivated:DATA.gods.flatMap(([key],id)=>naturalGods.has(id)?[]:[key]),
  activityIdsNotReturned:DATA.activities.flatMap(([key],id)=>activities.has(id)?[]:[key]),
}));

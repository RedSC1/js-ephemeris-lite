import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evaluateAlmanacRules, ALMANAC_GODS, ALMANAC_ACTIVITIES, ACTIVITY_MASKS } from '../src/rules.js';
import { BitSet } from '../src/bitset.js';
import { DATA } from '../src/data.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/rules-dart.json', import.meta.url)));
const signature = x => [x.godIds, [...x.suitableIds].sort((a,b)=>a-b), [...x.tabooIds].sort((a,b)=>a-b), x.thingLevel];

test('2,880 combinations reproduce the Dart rule-engine fingerprint', () => {
  const results = [];
  for (let m=0;m<12;m++) for (let d=0;d<60;d++) for (let k=0;k<4;k++) {
    results.push(signature(evaluateAlmanacRules({
      monthBranch:m, dayIndex:d, yearIndex:(d*7+m+k*17)%60,
      lunarMonth:(m+k)%12+1, lunarDay:(d+k*11)%30+1,
      mansion:DATA.mansions[(m+d+k)%28].fullName, nextSolarTermIndex:(m*2+k)%24,
      isSiJue:k===1, isSiLi:k===2, isTuWangYongShi:k===3, isPhaseOfMoon:d%7===0, isYeargodDuty:k!==3,
    })));
  }
  assert.equal(results.length, fixture.count);
  assert.equal(createHash('sha256').update(JSON.stringify(results)).digest('hex'), fixture.sha256);
  for (const {input,result} of fixture.samples) assert.deepEqual(signature(evaluateAlmanacRules(input)), result);
});

test('all 171 god bits, including high/sign bits, survive set operations', () => {
  const positions = [0,31,32,63,64,95,96,127,128,159,160,170];
  const a = new BitSet(171, positions), b = new BitSet(171, [31,63,127,170]);
  assert.equal(a.length, positions.length);
  assert.deepEqual([...a], positions);
  assert(a.containsAll(b));
  assert.deepEqual([...a.intersection(b)], [...b]);
  a.oppress(b);
  assert.equal(a.length, positions.length - 4);
  a.merge(b);
  assert.deepEqual([...a], positions);
  assert.throws(() => a.add(171), RangeError);
  assert.throws(() => a.merge(new BitSet(98)), RangeError);
  assert.equal(BitSet.fromChunks(33, [0xffffffff,0xffffffff]).length, 33);
});

test('720 historical month-13 inputs retain the actual Dart rule behavior',()=>{
  const expected=JSON.parse(readFileSync(new URL('./fixtures/month13-dart.json',import.meta.url)));
  const rows=[];
  for(let m=0;m<12;m++)for(let d=0;d<60;d++){
    const x=evaluateAlmanacRules({monthBranch:m,dayIndex:d,yearIndex:(m+d)%60,
      lunarMonth:13,lunarDay:d%30+1,mansion:'危月燕',nextSolarTermIndex:m*2});
    rows.push([x.godIds,[...x.suitableIds].sort((a,b)=>a-b),[...x.tabooIds].sort((a,b)=>a-b),x.thingLevel,x.conflictLevel]);
  }
  assert.equal(rows.length,expected.count);
  assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),expected.sha256);
});

test('activity masks filter only output, retain order and do not invent taboos', () => {
  const input=fixture.samples[0].input, all=evaluateAlmanacRules(input);
  for (const mask of Object.values(ACTIVITY_MASKS)) {
    const filtered=evaluateAlmanacRules({...input,activityMask:mask});
    assert.deepEqual(filtered.suitableIds,all.suitableIds.filter(id=>mask.includes(id)));
    assert.deepEqual(filtered.tabooIds,all.tabooIds.filter(id=>mask.includes(id)));
    assert.equal(filtered.thingLevel,all.thingLevel);
    assert.deepEqual(filtered.godIds,all.godIds);
  }
  const empty=evaluateAlmanacRules({...input,activityMask:[]});
  assert.deepEqual(empty.suitableActivities,[]);
  assert.deepEqual(empty.tabooActivities,[]);
});

test('catalogues are immutable, complete and validated', () => {
  assert.equal(ALMANAC_GODS.length,171);
  assert.equal(ALMANAC_ACTIVITIES.length,98);
  assert.equal(ALMANAC_GODS.filter(g=>g.auspicious).length,71);
  assert.throws(()=>{ ALMANAC_GODS[0].label='changed'; },TypeError);
  const input=fixture.samples[0].input;
  for(const patch of [{monthBranch:12},{dayIndex:60},{lunarMonth:14},{lunarDay:0},{nextSolarTermIndex:24},{mansion:'invalid'},{activityMask:[98]},{isSiLi:1}]) {
    assert.throws(()=>evaluateAlmanacRules({...input,...patch}));
  }
});

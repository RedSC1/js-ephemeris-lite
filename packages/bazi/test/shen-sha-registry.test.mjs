import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePillars, ShenShaRegistry, ShenShaRuleSet, collectTargetShenSha,
  shenShaIds, SHEN_SHA_NAMES } from '../dist/index.js';
const chart = analyzePillars({ year: 0x26, month: 0x62, day: 0x42, hour: 0x35 });
test('default registry reproduces all built-in target and gender results', () => {
  const registry = new ShenShaRegistry();
  assert.equal(registry.size, 66);
  for (const gender of [undefined, 0, 1]) {
    const bound = registry.bind(chart, { gender });
    for (let kind=0; kind<13; kind++) for (let p=0;p<60;p++) {
      const pillar=((p%10)<<4)|(p%12);
      const ids=shenShaIds(collectTargetShenSha(chart,pillar,kind,{gender}));
      assert.deepEqual(bound.forTarget(pillar,kind), ids.map(id=>({id:`builtin:${id}`,name:SHEN_SHA_NAMES[id],builtinId:id})));
    }
  }
});
test('register, replace, remove, clear and reset are local and snapshot-safe', () => {
  const registry = new ShenShaRegistry();
  const rule={id:'example:day',name:'日柱示例',test:c=>c.targetKind===2};
  registry.register(rule);
  const bound=registry.bind(chart);
  rule.name='changed';rule.test=()=>false;
  assert.equal(bound.natal().day.at(-1).name,'日柱示例');
  assert(!bound.natal().hour.some(r=>r.id==='example:day'));
  registry.replace({id:'example:day',name:'替换',test:()=>false});
  assert(!registry.bind(chart).natal().day.some(r=>r.id==='example:day'));
  registry.replace({id:'builtin:0',name:'自定天乙',test:()=>true});
  assert.deepEqual(registry.bind(chart).natal().hour[0],{id:'builtin:0',name:'自定天乙'});
  assert.equal(registry.remove('builtin:0'),true);
  assert.equal(registry.remove('builtin:0'),false);
  registry.clear();assert.equal(registry.bind(chart).natal().day.length,0);
  assert(bound.natal().day.some(r=>r.id==='example:day'));
  registry.reset();assert.equal(registry.size,66);
  assert.equal(new ShenShaRegistry().size,66);
  assert.doesNotThrow(()=>JSON.stringify(bound.natal()));
});
test('binding copies pillars; contexts/results cannot be mutated', () => {
  const source={pillars:{...chart.pillars}};
  const registry=new ShenShaRegistry({includeBuiltins:false});
  registry.register({id:'x',name:'x',test:c=>{
    assert.throws(()=>{c.pillars.day=0;},TypeError);
    return c.pillars.day===0x42;
  }});
  const b=registry.bind(source);source.pillars.day=0;
  assert.equal(b.natal().day.length,1);
  assert.throws(()=>b.natal().day.push({}),TypeError);
});
test('invalid rules/targets and asynchronous predicates fail explicitly', () => {
  const r=new ShenShaRegistry({includeBuiltins:false});
  for(const rule of [{id:'',name:'x',test:()=>true},{id:'x',name:'',test:()=>true},{id:'x',name:'x',test:1}]) assert.throws(()=>r.register(rule));
  assert.throws(()=>r.register({id:'builtin:66',name:'x',test:()=>true}));
  assert.throws(()=>r.replace({id:'missing',name:'x',test:()=>true}));
  r.register({id:'x',name:'x',test:()=>true});
  assert.throws(()=>r.register({id:'x',name:'x',test:()=>false}));
  assert.throws(()=>r.bind(chart,{gender:2}));
  assert.throws(()=>r.bind(chart).forTarget(1,0));
  assert.throws(()=>r.bind(chart).forTarget(0,13));
  assert.throws(()=>new ShenShaRuleSet([{id:'builtin:66',name:'x',builtinId:66}]));
  r.replace({id:'x',name:'x',test:async()=>true});
  assert.throws(()=>r.bind(chart).natal(),/boolean/);
});

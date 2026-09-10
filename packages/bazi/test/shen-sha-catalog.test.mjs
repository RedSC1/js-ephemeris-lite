import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePillars, BaziShenShaCatalog, BaziShenShaModule, collectTargetShenSha, shenShaIds } from '../dist/index.js';
const chart=analyzePillars({year:0x26,month:0x62,day:0x42,hour:0x35});
const yes=()=>true;
const module=()=>new BaziShenShaModule('school',[{id:'one',name:'First',test:yes},{id:'two',name:'Second',test:yes}]);
test('default catalog preserves all targets, genders and bitset IDs',()=>{
 const ctx=new BaziShenShaCatalog().createContext();
 for(const gender of [undefined,0,1]) for(let k=0;k<13;k++) for(let p=0;p<60;p++) {
 const target=((p%10)<<4)|(p%12);
 assert.deepEqual(ctx.evaluate(chart,target,k,gender),shenShaIds(collectTargetShenSha(chart,target,k,{gender})).map(id=>({id:`builtin:${id}`,name:'',builtinId:id})));
 }
});
test('module removal is immutable and removes every rule for every target',()=>{
 const base=new BaziShenShaCatalog(),extended=base.addModule(module()),ctx=extended.createContext(),removed=extended.removeModule('school');
 assert.equal(base.modules.length,0);assert.equal(extended.modules.length,1);assert.equal(removed.modules.length,0);
 for(let k=0;k<13;k++) {const defaults=base.createContext().evaluate(chart,chart.pillars.day,k);
 assert.equal(ctx.evaluate(chart,chart.pillars.day,k).length,defaults.length+2);
 assert.deepEqual(removed.createContext().evaluate(chart,chart.pillars.day,k),defaults);}
 assert.throws(()=>extended.modules.push(module()),TypeError);
});
test('selection is a snapshot, not deletion of definitions',()=>{
 const catalog=new BaziShenShaCatalog().addModule(module());
 const disabledIds=[...Array.from({length:66},(_,i)=>`builtin:${i}`),'school:one'];
 const ctx=catalog.createContext({disabledIds});disabledIds.length=0;
 assert.deepEqual(ctx.evaluate(chart,chart.pillars.day,2),[{id:'school:two',name:'Second',builtinId:-1}]);
 assert(catalog.createContext().evaluate(chart,chart.pillars.day,2).length>1);
 const empty=catalog.createContext({disabledIds:[...Array.from({length:66},(_,i)=>`builtin:${i}`),'school:one','school:two']});
 assert.deepEqual(empty.evaluate(chart,chart.pillars.day,2),[]);
 assert.throws(()=>empty.evaluate(chart,1,2));assert.throws(()=>empty.evaluate(chart,0,13));assert.throws(()=>empty.evaluate(chart,0,2,99));
});
test('definitions and complete rule-layer chart are copied and read-only',()=>{
 const rule={id:'one',name:'First',test:input=>{
 assert.equal(input.chart.extraPillars.taiXi,chart.extraPillars.taiXi);
 assert.deepEqual(input.chart.columns,chart.columns);
 assert.equal(input.chart.dayMaster,chart.dayMaster);
 assert.throws(()=>{input.chart.columns[0].hiddenStems.push(0);},TypeError);
 assert.throws(()=>{input.chart.extraPillars.taiXi=0;},TypeError);
 return true;
 }};
 const rules=[rule],m=new BaziShenShaModule('school',rules);
 rule.test=()=>false;rule.name='changed';rules.length=0;
 const ctx=new BaziShenShaCatalog().addModule(m).createContext();
 assert.equal(ctx.evaluate(chart,chart.pillars.day,2).at(-1).name,'First');
 assert.throws(()=>ctx.evaluate(chart,0,0).push({}),TypeError);
});
test('reserved/duplicate keys, bad selections and missing modules reject',()=>{
 const base=new BaziShenShaCatalog(),extended=base.addModule(module());
 for(const name of ['builtin','option1','a:b','a b','']) assert.throws(()=>new BaziShenShaModule(name,[{id:'x',name:'X',test:yes}]));
 assert.throws(()=>new BaziShenShaModule('x',[]));
 for(const r of [{id:'a:b',name:'X',test:yes},{id:'x',name:' ',test:yes},{id:'x',name:'X',test:null}]) assert.throws(()=>new BaziShenShaModule('x',[r]));
 assert.throws(()=>new BaziShenShaModule('x',[{id:'a',name:'A',test:yes},{id:'a',name:'B',test:yes}]));
 assert.throws(()=>extended.addModule(module()));
 for(const name of ['builtin','option1','missing']) assert.throws(()=>extended.removeModule(name));
 for(const ids of [['builtin:66'],['builtin:0','builtin:0'],['missing:x']]) assert.throws(()=>base.createContext({disabledIds:ids}));
 assert.equal(base.replace,undefined);assert.equal(base.clear,undefined);
});
test('callback failures propagate; disabled callbacks never run',()=>{
 const error=new Error('callback');
 const catalog=new BaziShenShaCatalog().addModule(new BaziShenShaModule('fail',[{id:'x',name:'X',test:()=>{throw error;}}]));
 assert.throws(()=>catalog.createContext().evaluate(chart,0,0),e=>e===error);
 assert.doesNotThrow(()=>catalog.createContext({disabledIds:['fail:x']}).evaluate(chart,0,0));
 const asyncCatalog=new BaziShenShaCatalog().addModule(new BaziShenShaModule('async',[{id:'x',name:'X',test:async()=>{throw error;}}]));
 assert.throws(()=>asyncCatalog.createContext().evaluate(chart,0,0),/synchronous boolean/);
});

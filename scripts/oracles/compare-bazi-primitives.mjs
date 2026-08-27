import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as bazi from '../../packages/bazi/dist/index.js';
import { writeNativeFixture } from './write-fixture.mjs';
const [binary, output] = process.argv.slice(2);
if (!binary || !output) throw new Error('usage: node compare-bazi-primitives.mjs BINARY OUTPUT_JSON');
const relation = fn => (...args) => { const r = fn(...args); return [r.flags, r.combinedElement ?? 255]; };
const functions = {
  tenGod: bazi.getTenGod, hiddenStems: bazi.getHiddenStems, kongWang: bazi.getKongWang,
  lifeStage: bazi.getLifeStage, stemRelation: relation(bazi.calculateStemRelation),
  branchRelation: relation(bazi.calculateBranchRelation), tripleRelation: relation(bazi.calculateBranchTripleRelation),
  flowMonth: bazi.calculateFlowMonth, flowHour: bazi.calculateFlowHour,
  siling: (...args) => bazi.getRenyuanSilingSegments(...args).map(s => [s.stem, s.origin, s.index, s.startDay, s.endDay]),
};
const rows = execFileSync(binary, [], { encoding: 'utf8', maxBuffer: 2e6 }).trim().split(/\r?\n/).map(JSON.parse);
const counts = {}, seen = new Set();
for (const [name, args, expected] of rows) {
  const key = JSON.stringify([name, args]); assert(!seen.has(key), `duplicate ${key}`); seen.add(key);
  assert.deepEqual(functions[name](...args), expected, key);
  counts[name] = (counts[name] ?? 0) + 1;
}
assert.deepEqual(counts, { tenGod: 100, stemRelation: 100, hiddenStems: 12, branchRelation: 144,
  tripleRelation: 1728, lifeStage: 240, siling: 24, kongWang: 60, flowMonth: 720, flowHour: 720 });
writeNativeFixture(output, { source: 'taiyin-ephemeris C++ / finite BaZi primitive domains', counts, rows }, binary, './bazi-primitives.cpp');
console.log(JSON.stringify({ total: rows.length, counts }));

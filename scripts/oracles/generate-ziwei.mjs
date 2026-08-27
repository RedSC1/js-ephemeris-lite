import { spawnSync } from 'node:child_process';
import { writeNativeFixture } from './write-fixture.mjs';
import assert from 'node:assert/strict';
import { ZiweiChart, ZiweiOptions, computeZiweiAnchors, makeFlowLayer } from '../../packages/ziwei/dist/index.js';
import { makeGanzhi } from '../../src/index.js';
const [binary, rules, output] = process.argv.slice(2);
if (!binary || !rules || !output) throw new Error('usage: node generate-ziwei.mjs BINARY RULES_TOML OUTPUT_JSON');
const rows = [];
for (let level = 0; level < 5; level++) for (let stem = 0; stem < 10; stem++) for (let branch = 0; branch < 12; branch++) for (let gender = 0; gender < 2; gender++) {
  const i = rows.length;
  rows.push({ input: [(i * 17) % 60, (i * 7) % 12 + 1, (i * 11) % 30 + 1, (i * 5) % 12, gender, level, stem, branch] });
}
const r = spawnSync(binary, [rules], { input: rows.map(r => r.input.join(' ')).join('\n') + '\n', encoding: 'utf8', maxBuffer: 32e6 });
assert.equal(r.status, 0, `${r.stderr} ${r.error ?? ''}`);
const expected = r.stdout.trim().split(/\r?\n/).map(JSON.parse);
assert.equal(expected.length, rows.length);
for (const [i, row] of rows.entries()) {
  const [y, m, d, h, gender, level, stem, branch] = row.input;
  const pillars = { year: makeGanzhi(y % 10, y % 12), month: makeGanzhi(((y % 10 % 5) * 2 + 2 + m - 1) % 10, (m + 1) % 12),
    day: makeGanzhi((d - 1) % 10, (d - 1) % 12), hour: makeGanzhi(((d - 1) % 10 % 5 * 2 + h) % 10, h) };
  const facts = { jdUT1: 0, virtualTime: { year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, gender,
    lunarDate: { year: 1984 + y, month: m, day: d, isLeap: false, monthName: 0 },
    effectiveLunarYear: 1984 + y, effectiveLunarMonth: m, solarDayFromPreviousJie: d, solarTermPillars: pillars, lunarPillars: pillars };
  const options = new ZiweiOptions({ gender });
  const chart = ZiweiChart.fromResolvedBirth({ facts, ...computeZiweiAnchors(facts, options), options });
  const flow = makeFlowLayer(chart, level, { stem, branch });
  const positions = a => a.map(p => p < 0 ? 255 : p);
  const actual = [chart.anchors.palacePositions[0], chart.bodyPalace, chart.anchors.bureau, positions(chart.starPositions),
    chart.transformationMasks, positions(flow.starPositions), Object.values(flow.transforms)];
  assert.deepEqual(actual, expected[i], `native ziwei ${i}`);
  row.expected = expected[i];
}
writeNativeFixture(output, { source: 'taiyin-ephemeris C++; default rules; 5 flow levels x 10 stems x 12 branches x 2 genders', rows }, binary, './ziwei.cpp');
console.log(`matched ${rows.length} C++ ziwei natal/flow pairs; wrote ${output}`);

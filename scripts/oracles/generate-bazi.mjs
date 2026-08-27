import { spawnSync } from 'node:child_process';
import { writeNativeFixture } from './write-fixture.mjs';
import assert from 'node:assert/strict';
import { baziSignature } from './bazi-signature.mjs';
const [binary, output] = process.argv.slice(2);
if (!binary || !output) throw new Error('usage: node generate-bazi.mjs BINARY OUTPUT_JSON');
let seed = 0x6a09e667;
const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 2 ** 32 * n); };
const pillar = i => ((i % 10) << 4) | i % 12;
const rows = [];
for (let i = 0; i < 512; i++) for (const mode of [0, 1]) rows.push({ mode, pillars: Array.from({ length: 4 }, () => pillar(random(60))) });
const result = spawnSync(binary, [], { input: rows.map(r => [r.mode, ...r.pillars].join(' ')).join('\n') + '\n', encoding: 'utf8', maxBuffer: 16e6 });
assert.equal(result.status, 0, `${result.stderr} ${result.error ?? ''}`);
const expected = result.stdout.trim().split(/\r?\n/).map(JSON.parse);
assert.equal(expected.length, rows.length);
for (const [i, row] of rows.entries()) {
  const actual = baziSignature(row);
  assert.deepEqual(actual, expected[i], `native chart ${i}`);
  row.expected = expected[i];
}
writeNativeFixture(output, { source: 'taiyin-ephemeris C++ bazi; seed 0x6a09e667; both earth-palace modes; neutral/female/male shen-sha', rows }, binary, './bazi.cpp');
console.log(`matched ${rows.length} C++ bazi charts, relations and shen-sha; wrote ${output}`);

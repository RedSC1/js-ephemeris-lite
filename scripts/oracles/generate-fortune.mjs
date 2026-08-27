import { spawnSync } from 'node:child_process';
import { writeNativeFixture } from './write-fixture.mjs';
import assert from 'node:assert/strict';
const [binary, bsp, output] = process.argv.slice(2);
if (!binary || !bsp || !output) throw new Error('usage: node generate-fortune.mjs BINARY DE441_BSP OUTPUT_JSON');
const rows = [];
for (const year of [1900, 2000, 2026, 2099]) for (const month of [2, 6]) for (const gender of [0, 1])
  for (let timeModel = 0; timeModel < 3; timeModel++) for (let boundary = 0; boundary < 3; boundary++)
    rows.push({ input: [year, month, gender, timeModel, boundary] });
const r = spawnSync(binary, [bsp], { input: rows.map(r => r.input.join(' ')).join('\n') + '\n', encoding: 'utf8', maxBuffer: 8e6 });
assert.equal(r.status, 0, `${r.stderr} ${r.error ?? ''}`);
const expected = r.stdout.trim().split(/\r?\n/).map(JSON.parse);
assert.equal(expected.length, rows.length);
rows.forEach((row, i) => { row.expected = expected[i]; });
writeNativeFixture(output, { source: 'taiyin-ephemeris C++ / DE441; UTC+8; next-day Zi; 3 Qi-Yun models x 3 decade boundary models', rows }, binary, './fortune.cpp');
console.log(`wrote ${rows.length} native fortune cases to ${output}`);

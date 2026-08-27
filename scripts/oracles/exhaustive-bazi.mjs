import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { baziFiniteRows, baziSignature } from './bazi-signature.mjs';

const [binary, reportPath] = process.argv.slice(2);
if (!binary || !reportPath) throw new Error('usage: node exhaustive-bazi.mjs BINARY REPORT_JSON');
const expectedHash = createHash('sha256'), actualHash = createHash('sha256');
const report = { complete: false, baseCharts: 0, comparedRows: 0, earthPalaceModes: [0, 1], shenShaGenders: ['neutral', 'female', 'male'],
  differences: 0, binarySha256: createHash('sha256').update(readFileSync(binary)).digest('hex') };
const started = Date.now();
let batch = [], lastProgress = 0;
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
function flush() {
  const r = spawnSync(binary, [], { input: batch.map(row => [row.mode, ...row.pillars].join(' ')).join('\n') + '\n', encoding: 'utf8', maxBuffer: 8e6 });
  assert.equal(r.status, 0, `${r.error ?? ''} ${r.stderr}`);
  const lines = r.stdout.trim().split(/\r?\n/);
  assert.equal(lines.length, batch.length, 'native batch row count');
  for (const [i, row] of batch.entries()) {
    const actual = baziSignature(row), serialized = JSON.stringify(actual);
    expectedHash.update(lines[i] + '\n'); actualHash.update(serialized + '\n');
    if (serialized !== lines[i]) {
      report.differences++;
      report.firstDifference = { index: report.comparedRows, input: row, expected: JSON.parse(lines[i]), actual };
      save();
      assert.deepEqual(actual, report.firstDifference.expected, `C++ bazi input ${JSON.stringify(row)}`);
    }
    report.comparedRows++;
  }
  batch = [];
  report.baseCharts = report.comparedRows / 2;
  if (Date.now() - lastProgress > 10000) {
    console.log(`bazi: ${report.baseCharts}/518400 base charts, ${report.comparedRows}/1036800 mode rows`);
    lastProgress = Date.now(); save();
  }
}
try {
  for (const row of baziFiniteRows()) { batch.push(row); if (batch.length === 2048) flush(); }
  if (batch.length) flush();
  assert.equal(report.comparedRows, 1036800);
  report.cppSha256 = expectedHash.digest('hex'); report.jsSha256 = actualHash.digest('hex');
  assert.equal(report.cppSha256, report.jsSha256);
  report.complete = true;
} finally { report.elapsedSeconds = (Date.now() - started) / 1000; save(); }
console.log(JSON.stringify(report));

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import {
  ZiweiChart,
  ZiweiOptions,
  computeZiweiAnchors,
} from '../dist/index.js';
import { makeGanzhi } from 'js-ephemeris-lite';

const binary = process.argv[2];
const count = Number(process.argv[3] ?? 1000);
const reportPath = process.argv[4];
if (!binary || !Number.isInteger(count) || count < 1 || count > 518400) {
  throw new Error('usage: node compare-cpp-oracle.mjs DUMP_BINARY [COUNT<=518400] [REPORT_JSON]');
}

const binarySha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
const child = spawn(binary, ['finite', '0', String(count)], { stdio: ['ignore', 'pipe', 'inherit'] });
// Attach listeners before reading stdout; an early exit must not be missed.
const closed = new Promise(resolve => {
  child.once('error', error => resolve({ error }));
  child.once('close', (code, signal) => resolve({ code, signal }));
});
const report = { complete: false, requested: count, comparedRows: 0, differences: 0,
  binarySha256 };
const cppHash = createHash('sha256'), jsHash = createHash('sha256');
const started = Date.now(); let lastProgress = 0, currentInput;
const save = () => { if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); };

function pillars(values, offset) {
  return Object.freeze({
    year: makeGanzhi(values[offset], values[offset + 1]),
    month: makeGanzhi(values[offset + 2], values[offset + 3]),
    day: makeGanzhi(values[offset + 4], values[offset + 5]),
    hour: makeGanzhi(values[offset + 6], values[offset + 7]),
  });
}

try {
  for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
    if (line.startsWith('#')) continue;
    const rowIndex = report.comparedRows;
    const values = line.split(',').map(Number);
    currentInput = values.slice(0, 8);
    assert.equal(values.length, 271, `native row ${rowIndex} field count`);
    assert(values.every(Number.isFinite), `native row ${rowIndex} non-finite value`);
    // Check the enumeration itself, so duplicates/missing inputs cannot pass by
    // simply producing the expected final count.
    assert.deepEqual(values.slice(0, 6), [1984 + Math.floor(rowIndex / 8640),
      Math.floor(rowIndex / 720) % 12 + 1, Math.floor(rowIndex / 24) % 30 + 1,
      Math.floor(rowIndex / 2) % 12, 0, rowIndex % 2], `native input order ${rowIndex}`);
    const options = new ZiweiOptions({ gender: values[5] });
    const facts = Object.freeze({
      jdUT1: 0,
      virtualTime: Object.freeze({ year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 }),
      gender: values[5],
      lunarDate: Object.freeze({
        year: values[0], month: values[1], day: values[2],
        isLeap: values[4] !== 0, monthName: 0,
      }),
      solarTermPillars: pillars(values, 8),
      lunarPillars: pillars(values, 16),
      effectiveLunarYear: values[6],
      effectiveLunarMonth: values[7],
      solarDayFromPreviousJie: values[2],
    });
    const resolved = computeZiweiAnchors(facts, options);
    const chart = ZiweiChart.fromResolvedBirth(Object.freeze({ facts, ...resolved, options }));
    const label = `finite oracle row ${rowIndex}, input ${JSON.stringify(currentInput)}`;
    assert.equal(chart.anchors.palacePositions[0], values[24], `${label} life`);
    assert.equal(chart.bodyPalace, values[25], `${label} body`);
    assert.equal(chart.anchors.bureau, values[26], `${label} bureau`);
    assert.deepEqual(chart.palaceStems, values.slice(27, 39), `${label} stems`);
    assert.equal(chart.lifeMaster, values[39], `${label} life master`);
    assert.equal(chart.bodyMaster, values[40], `${label} body master`);
    assert.deepEqual(chart.starPositions.slice(0, 115), values.slice(41, 156), `${label} positions`);
    assert.deepEqual(chart.transformationMasks.slice(0, 115), values.slice(156, 271), `${label} masks`);
    const actual = [chart.anchors.palacePositions[0], chart.bodyPalace, chart.anchors.bureau,
      ...chart.palaceStems, chart.lifeMaster, chart.bodyMaster,
      ...chart.starPositions.slice(0, 115), ...chart.transformationMasks.slice(0, 115)];
    cppHash.update(JSON.stringify(values.slice(24)) + '\n'); jsHash.update(JSON.stringify(actual) + '\n');
    report.comparedRows++;
    if (Date.now() - lastProgress > 10000) {
      console.log(`ziwei: ${report.comparedRows}/${count} natal charts`); lastProgress = Date.now(); save();
    }
  }
  const exit = await closed;
  assert.equal(exit.code, 0, `native process failed: ${exit.error ?? exit.signal ?? exit.code}`);
  assert.equal(report.comparedRows, count, 'native total row count');
  report.cppSha256 = cppHash.digest('hex'); report.jsSha256 = jsHash.digest('hex');
  assert.equal(report.cppSha256, report.jsSha256);
  report.complete = true;
} catch (error) {
  report.differences++;
  report.firstDifference = { index: report.comparedRows, input: currentInput, message: error.message, actual: error.actual, expected: error.expected };
  child.kill(); throw error;
} finally { report.elapsedSeconds = (Date.now() - started) / 1000; save(); }
console.log(`matched ${report.comparedRows} finite C++ natal charts`);

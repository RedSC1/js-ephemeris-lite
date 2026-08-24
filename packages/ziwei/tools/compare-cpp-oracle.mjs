import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import {
  ZiweiChart,
  ZiweiOptions,
  computeZiweiAnchors,
} from '../dist/index.js';
import { makeGanzhi } from 'js-ephemeris-lite';

const binary = process.argv[2];
const count = Number(process.argv[3] ?? 1000);
if (!binary || !Number.isInteger(count) || count < 1) {
  throw new Error('usage: node compare-cpp-oracle.mjs DUMP_BINARY [COUNT]');
}

const output = execFileSync(binary, ['finite', '0', String(count)], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const rows = output.trim().split(/\r?\n/).filter((line) => !line.startsWith('#'));

function pillars(values, offset) {
  return Object.freeze({
    year: makeGanzhi(values[offset], values[offset + 1]),
    month: makeGanzhi(values[offset + 2], values[offset + 3]),
    day: makeGanzhi(values[offset + 4], values[offset + 5]),
    hour: makeGanzhi(values[offset + 6], values[offset + 7]),
  });
}

for (const [rowIndex, line] of rows.entries()) {
  const values = line.split(',').map(Number);
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
  const label = `finite oracle row ${rowIndex}`;
  assert.equal(chart.anchors.palacePositions[0], values[24], `${label} life`);
  assert.equal(chart.bodyPalace, values[25], `${label} body`);
  assert.equal(chart.anchors.bureau, values[26], `${label} bureau`);
  assert.deepEqual(chart.palaceStems, values.slice(27, 39), `${label} stems`);
  assert.equal(chart.lifeMaster, values[39], `${label} life master`);
  assert.equal(chart.bodyMaster, values[40], `${label} body master`);
  assert.deepEqual(chart.starPositions.slice(0, 115), values.slice(41, 156), `${label} positions`);
  assert.deepEqual(chart.transformationMasks.slice(0, 115), values.slice(156, 271), `${label} masks`);
}

console.log(`matched ${rows.length} finite C++ natal charts`);

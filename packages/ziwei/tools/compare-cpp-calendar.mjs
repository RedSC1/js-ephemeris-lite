import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import {
  ZiweiChart,
  ZiweiOptions,
} from '../dist/index.js';
import { ZonedTime, ganzhiBranch, ganzhiStem } from 'js-ephemeris-lite';

const binary = process.argv[2];
const year = Number(process.argv[3] ?? 2003);
const count = Number(process.argv[4] ?? 1000);
if (!binary || !Number.isInteger(year) || !Number.isInteger(count) || count < 1) {
  throw new Error('usage: node compare-cpp-calendar.mjs DUMP_BINARY [YEAR] [COUNT]');
}
const output = execFileSync(binary, ['0', String(year), String(year), String(count)], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const rows = output.trim().split(/\r?\n/).filter((line) => !line.startsWith('#'));

function flattenPillars(pillars) {
  const result = [];
  for (const value of [pillars.year, pillars.month, pillars.day, pillars.hour]) {
    result.push(ganzhiStem(value), ganzhiBranch(value));
  }
  return result;
}

for (const [rowIndex, line] of rows.entries()) {
  const values = line.split(',').map(Number);
  const birth = new ZonedTime({
    year: values[0], month: values[1], day: values[2],
    hour: values[3], minute: values[4], second: 0, offsetMinutes: 480,
  });
  const chart = ZiweiChart.fromZonedTime(birth, new ZiweiOptions({ gender: values[5] }));
  const label = `calendar oracle row ${rowIndex}`;
  assert.deepEqual(
    [chart.facts.effectiveLunarYear, chart.facts.effectiveLunarMonth],
    values.slice(6, 8),
    `${label} effective lunar date`,
  );
  assert.deepEqual(flattenPillars(chart.anchors.solarTerm), values.slice(8, 16), `${label} solar pillars`);
  assert.deepEqual(flattenPillars(chart.anchors.lunar), values.slice(16, 24), `${label} lunar pillars`);
  assert.equal(chart.anchors.palacePositions[0], values[24], `${label} life`);
  assert.equal(chart.bodyPalace, values[25], `${label} body`);
  assert.equal(chart.anchors.bureau, values[26], `${label} bureau`);
  assert.deepEqual(chart.palaceStems, values.slice(27, 39), `${label} stems`);
  assert.equal(chart.lifeMaster, values[39], `${label} life master`);
  assert.equal(chart.bodyMaster, values[40], `${label} body master`);
  assert.deepEqual(chart.starPositions.slice(0, 115), values.slice(41, 156), `${label} positions`);
  assert.deepEqual(chart.transformationMasks.slice(0, 115), values.slice(156, 271), `${label} masks`);
}

console.log(`matched ${rows.length} physical-calendar C++ natal charts in ${year}`);

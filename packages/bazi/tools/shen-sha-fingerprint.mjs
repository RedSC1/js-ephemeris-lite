import assert from 'node:assert/strict';
import {
  GENDER,
  SHEN_SHA_TARGET,
  collectTargetShenSha,
  shenShaWords,
} from '../dist/index.js';
import { advanceGanzhi, getHourGanzhi, getMonthGanzhi, ganzhiStem } from 'js-ephemeris-lite';

const MASK64 = (1n << 64n) - 1n;
const FNV_PRIME = 0x100000001b3n;

function fnv1aWord(hash, word) {
  for (let shift = 0n; shift < 64n; shift += 8n) {
    hash ^= (word >> shift) & 0xffn;
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return hash;
}

let hash = 0xcbf29ce484222325n;
const genderHash = [0xcbf29ce484222325n, 0xcbf29ce484222325n];
let chartCount = 0;
const chart = { pillars: { year: 0, month: 0, day: 0, hour: 0 } };

for (let yearIndex = 0; yearIndex < 60; yearIndex += 1) {
  chart.pillars.year = advanceGanzhi(0x00, yearIndex);
  const yearStem = ganzhiStem(chart.pillars.year);
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    chart.pillars.month = getMonthGanzhi(yearStem, monthIndex);
    for (let dayIndex = 0; dayIndex < 60; dayIndex += 1) {
      chart.pillars.day = advanceGanzhi(0x00, dayIndex);
      const dayStem = ganzhiStem(chart.pillars.day);
      for (let hourIndex = 0; hourIndex < 12; hourIndex += 1) {
        chart.pillars.hour = getHourGanzhi(dayStem, hourIndex);
        const targets = [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour];
        for (let targetKind = SHEN_SHA_TARGET.YEAR; targetKind <= SHEN_SHA_TARGET.HOUR; targetKind += 1) {
          for (const word of shenShaWords(collectTargetShenSha(chart, targets[targetKind], targetKind))) {
            hash = fnv1aWord(hash, word);
          }
          for (const gender of [GENDER.FEMALE, GENDER.MALE]) {
            const bitset = collectTargetShenSha(chart, targets[targetKind], targetKind, { gender });
            for (const word of shenShaWords(bitset)) {
              genderHash[gender] = fnv1aWord(genderHash[gender], word);
            }
          }
        }
        chartCount += 1;
      }
    }
  }
}

assert.equal(chartCount, 518400);
assert.equal(hash, 0xf786d8f1fe672575n, `neutral fingerprint: ${hash.toString(16)}`);
assert.equal(genderHash[GENDER.MALE], 0xeadbdb6530c916a5n,
  `male fingerprint: ${genderHash[GENDER.MALE].toString(16)}`);
assert.equal(genderHash[GENDER.FEMALE], 0x15f9f46ec22459edn,
  `female fingerprint: ${genderHash[GENDER.FEMALE].toString(16)}`);

console.log(JSON.stringify({
  chartCount,
  neutral: hash.toString(16),
  male: genderHash[GENDER.MALE].toString(16),
  female: genderHash[GENDER.FEMALE].toString(16),
}));

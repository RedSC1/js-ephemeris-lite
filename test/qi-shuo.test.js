import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALENDAR_MODE,
  getQiShuoYear,
  solveLunarPhase,
  solveNewMoon,
} from '../src/index.js';

function phaseResidual(value, target) {
  return Math.atan2(Math.sin(value - target), Math.cos(value - target));
}

test('lunar phase solver preserves new moon behavior and solves quarters', () => {
  const newMoon = solveNewMoon(2451550);
  const genericNewMoon = solveLunarPhase(0, 2451550);
  assert.ok(Math.abs(newMoon.jdTT - genericNewMoon.jdTT) < 1e-12);

  const firstQuarter = solveLunarPhase(Math.PI / 2, 2451558);
  assert.ok(Number.isFinite(firstQuarter.jdUT1));
  assert.ok(Math.abs(phaseResidual(firstQuarter.residualRadians, 0)) < 1e-8);
});

test('annual qishuo table contains one civil year of terms and new moons', () => {
  const result = getQiShuoYear(2000);
  const terms = result.events.filter(event => event.kind === 'solar-term');
  const moons = result.events.filter(event => event.kind === 'lunar-phase');
  assert.equal(terms.length, 24);
  assert.ok(moons.length === 12 || moons.length === 13);
  assert.equal(terms[0].name, '小寒');
  assert.equal(terms.at(-1).name, '冬至');
  assert.ok(result.events.every((event, index, all) => index === 0 || event.jdUT1 >= all[index - 1].jdUT1));
  assert.ok(result.events.every(event => event.localTime.year === 2000));
  assert.ok(result.events.every(event => event.jdUT1 >= result.startJdUT1 && event.jdUT1 < result.endJdUT1));
});

test('annual qishuo table can combine four phases and 72 pentads without duplicate term roots', () => {
  const result = getQiShuoYear(2024, {
    includeSolarTerms: true,
    includePentads: true,
    lunarPhaseAnglesDeg: [0, 90, 180, 270],
    mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  });
  const solar = result.events.filter(event => event.kind === 'solar-term' || event.kind === 'pentad');
  const phases = result.events.filter(event => event.kind === 'lunar-phase');
  assert.equal(solar.length, 72);
  assert.ok(phases.length >= 48 && phases.length <= 52);
  assert.deepEqual([...new Set(phases.map(event => event.name))].sort(), ['上弦', '下弦', '朔', '望'].sort());
});

test('annual qishuo validates range, phase angles, and local meridian', () => {
  assert.throws(() => getQiShuoYear(10001), /within/);
  assert.throws(() => getQiShuoYear(2000, { lunarPhaseAnglesDeg: '0' }), /array/);
  assert.throws(() => getQiShuoYear(2000, { utcOffsetMinutes: 841 }), /14 hours/);
  assert.throws(() => getQiShuoYear(2000, {
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    meridianDeg: 181,
  }), /180 degrees/);
});

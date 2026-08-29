import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALENDAR_DAY_BOUNDARY_MODE,
  CALENDAR_MODE,
  getQiShuoYear,
  solveLunarPhase,
  solveNewMoon,
  solveSolarLongitude,
  elongationState,
  ZonedTime,
  JulianTime,
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
  assert.ok(Math.abs(phaseResidual(elongationState(firstQuarter.jdTT).value, Math.PI / 2)) < 1e-8);
  assert.equal('residualRadians' in firstQuarter, false);
});

test('annual qishuo table contains one civil year of terms and new moons', () => {
  const result = getQiShuoYear(2000);
  assert.ok(result.events.every(event => event.time instanceof JulianTime && !('jdTT' in event)));
  const terms = result.events.filter(event => event.kind === 'solar-term');
  const moons = result.events.filter(event => event.kind === 'lunar-phase');
  assert.equal(terms.length, 24);
  assert.ok(moons.length === 12 || moons.length === 13);
  assert.equal(terms[0].name, '小寒');
  assert.equal(terms.at(-1).name, '冬至');
  assert.ok(result.events.every((event, index, all) => index === 0 || event.time.jdUT1 >= all[index - 1].time.jdUT1));
  assert.ok(result.events.every(event => event.localTime.year === 2000));
  assert.ok(result.events.every(event => event.time.jdUT1 >= result.startJdUT1 && event.time.jdUT1 < result.endJdUT1));
  assert.ok(result.events.every(event => !('residualRadians' in event) && !('iterations' in event)));
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
  assert.equal(solar.length, 73);
  assert.ok(phases.length >= 48 && phases.length <= 52);
  assert.deepEqual([...new Set(phases.map(event => event.name))].sort(), ['上弦', '下弦', '朔', '望'].sort());
});

test('a civil year retains both occurrences of a pentad spanning consecutive solar cycles', () => {
  for (const includeSolarTerms of [false, true]) {
    const result = getQiShuoYear(2024, {
      utcOffsetMinutes: 480,
      includeSolarTerms,
      includePentads: true,
      lunarPhaseAnglesDeg: [],
    });
    const thirds = result.events.filter(event => event.name === '冬至·三候');
    assert.equal(result.events.length, 73);
    assert.deepEqual(thirds.map(event => event.localDate), [
      { year: 2024, month: 1, day: 1 },
      { year: 2024, month: 12, day: 31 },
    ]);
    assert.equal(thirds[0].index, thirds[1].index); // An angle index is not a unique occurrence ID.
    assert.ok(thirds[1].time.jdUT1 - thirds[0].time.jdUT1 > 365);
    assert.ok(result.events.every((event, index, all) => index === 0 || event.time.jdUT1 > all[index - 1].time.jdUT1));
    assert.ok(result.events.every(event => event.time.jdUT1 >= result.startJdUT1 && event.time.jdUT1 < result.endJdUT1));
  }
});

test('winter third-pentad roots are assigned to the correct civil year at different offsets', () => {
  const roots = [2023, 2024, 2025, 2026, 2027].map(year => {
    const near = new ZonedTime({ year, month: 12, day: 31, offsetMinutes: 0 }).toJulianTime();
    return solveSolarLongitude(280 / 360 * 2 * Math.PI, near.jdTT);
  });
  for (const utcOffsetMinutes of [-840, 0, 480, 840]) {
    for (const year of [2024, 2025, 2026, 2027]) {
      const result = getQiShuoYear(year, {
        utcOffsetMinutes,
        includeSolarTerms: false,
        includePentads: true,
        lunarPhaseAnglesDeg: [],
      });
      const expected = roots.filter(root => root.jdUT1 >= result.startJdUT1 && root.jdUT1 < result.endJdUT1);
      const actual = result.events.filter(event => event.name === '冬至·三候');
      assert.equal(actual.length, expected.length, `${year}, UTC offset ${utcOffsetMinutes}`);
      actual.forEach((event, index) => assert.ok(Math.abs(event.time.jdUT1 - expected[index].jdUT1) < 1e-7));
      assert.ok(result.events.every(event => event.localTime.year === year));
    }
  }
});

test('annual qishuo validates range, phase angles, and local meridian', () => {
  assert.throws(() => getQiShuoYear(10001), /within/);
  assert.throws(() => getQiShuoYear(2000, { lunarPhaseAnglesDeg: '0' }), /array/);
  assert.throws(() => getQiShuoYear(2000, { utcOffsetMinutes: 841 }), /14 hours/);
  assert.throws(() => getQiShuoYear(2000, {
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN,
    meridianDeg: 181,
  }), /180 degrees/);
  assert.throws(() => getQiShuoYear(2000, {
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    meridianDeg: 105,
  }), /only valid/);
});

test('annual qishuo distinguishes display timezone from its calendar day boundary', () => {
  const clock = getQiShuoYear(1800, {
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET,
    utcOffsetMinutes: 420,
  });
  const meridian = getQiShuoYear(1800, {
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN,
    utcOffsetMinutes: 420,
    meridianDeg: 105,
  });
  assert.equal(clock.dayBoundaryMode, CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET);
  assert.equal(meridian.dayBoundaryMode, CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN);
  assert.deepEqual(
    clock.events.map(event => [event.time.jdUT1, event.assignedCivilDayNumber]),
    meridian.events.map(event => [event.time.jdUT1, event.assignedCivilDayNumber]),
  );
});

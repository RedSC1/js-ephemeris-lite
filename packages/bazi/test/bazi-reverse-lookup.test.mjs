import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BAZI_DATE_PHASE,
  BaziChart,
  packPillar,
  reverseLookupBazi,
  searchBaziDates,
  searchBaziTimesForDate,
} from '../dist/index.js';
import {
  CALENDAR_MODE,
  PILLAR_HISTORICAL_MODE,
  RAT_HOUR_MODE,
  ZonedTime,
} from 'js-ephemeris-lite';

const DATE_2026_02_04 = Object.freeze({ year: 2026, month: 2, day: 4 });

function clock(year, month, day, hour = 0, minute = 0, second = 0) {
  return new ZonedTime({ year, month, day, hour, minute, second, offsetMinutes: 480 });
}

test('date reverse lookup returns a normal matching candidate', () => {
  const chart = BaziChart.fromZonedTime(clock(2026, 2, 19, 12));
  const results = searchBaziDates({
    ...chart.pillars,
    startDate: { year: 2026, month: 2, day: 19 },
    endDate: { year: 2026, month: 2, day: 19 },
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].phase, BAZI_DATE_PHASE.NORMAL);
  assert.deepEqual(results[0].date, { year: 2026, month: 2, day: 19 });
  assert.equal(results[0].isJieBoundaryDay, false);
});

test('date reverse lookup splits a Jie boundary day', () => {
  const results = searchBaziDates({
    startDate: DATE_2026_02_04,
    endDate: DATE_2026_02_04,
  });

  assert.deepEqual(results.map((item) => item.phase), [
    BAZI_DATE_PHASE.BEFORE_JIE,
    BAZI_DATE_PHASE.AFTER_JIE,
  ]);
  assert.ok(results.every((item) => item.jieName === '立春' && item.isJieBoundaryDay));
});

test('historical reverse lookup uses the same assigned Jie day as forward charts', () => {
  const historicalOptions = { mode: CALENDAR_MODE.HISTORICAL };
  const astronomicalDate = searchBaziDates({
    startDate: { year: 500, month: 2, day: 2 },
    endDate: { year: 500, month: 2, day: 2 },
    options: historicalOptions,
  });
  const assignedDate = searchBaziDates({
    startDate: { year: 500, month: 2, day: 3 },
    endDate: { year: 500, month: 2, day: 3 },
    options: historicalOptions,
  });
  assert.deepEqual(astronomicalDate.map((item) => item.phase), [BAZI_DATE_PHASE.NORMAL]);
  // The assigned boundary is exactly 00:00, so that local date has no
  // representable "before" segment; the previous date remains normal.
  assert.deepEqual(assignedDate.map((item) => item.phase), [BAZI_DATE_PHASE.AFTER_JIE]);

  const preciseDate = searchBaziDates({
    startDate: { year: 500, month: 2, day: 2 },
    endDate: { year: 500, month: 2, day: 2 },
    options: {
      mode: CALENDAR_MODE.HISTORICAL,
      pillarHistoricalMode: PILLAR_HISTORICAL_MODE.OFF,
    },
  });
  assert.deepEqual(preciseDate.map((item) => item.phase), [
    BAZI_DATE_PHASE.BEFORE_JIE,
    BAZI_DATE_PHASE.AFTER_JIE,
  ]);
});

test('date reverse lookup rejects an impossible year-month pair', () => {
  assert.throws(() => searchBaziDates({
    year: packPillar(0, 0),
    month: packPillar(0, 2),
    startDate: { year: 1984, month: 1, day: 1 },
    endDate: { year: 1984, month: 12, day: 31 },
  }), /Wu-Hu-Dun/);
});

test('date reverse lookup resolves Zi month across the civil year boundary', () => {
  const chart = BaziChart.fromZonedTime(clock(2025, 12, 20, 12));
  const results = searchBaziDates({
    year: chart.pillars.year,
    month: chart.pillars.month,
    day: chart.pillars.day,
    startDate: { year: 2025, month: 1, day: 1 },
    endDate: { year: 2026, month: 2, day: 28 },
  });

  assert.equal(results.length, 1);
  assert.deepEqual(results[0].date, { year: 2025, month: 12, day: 20 });
});

test('day-only lookup returns every 60-day recurrence in a long range', () => {
  const target = BaziChart.fromZonedTime(clock(2026, 1, 1, 12)).pillars.day;
  const results = searchBaziDates({
    day: target,
    startDate: { year: 2026, month: 1, day: 1 },
    endDate: { year: 2026, month: 7, day: 31 },
  });

  assert.ok(results.length >= 4);
  for (let index = 1; index < results.length; index += 1) {
    const days = Math.round(
      results[index].sampleTime.toJulianTime().jdUT1
      - results[index - 1].sampleTime.toJulianTime().jdUT1,
    );
    assert.equal(days, 60);
  }
});

test('time reverse lookup follows all three Zi-hour conventions', () => {
  const nextDayDate = searchBaziDates({
    startDate: { year: 2026, month: 2, day: 19 },
    endDate: { year: 2026, month: 2, day: 19 },
    options: { ratHourMode: RAT_HOUR_MODE.NEXT_DAY },
  })[0] ?? null;
  assert.ok(nextDayDate);
  const twelve = searchBaziTimesForDate({ dateCandidate: nextDayDate });
  assert.equal(twelve.length, 12);
  assert.equal(twelve.some((item) => item.isLateZi), false);

  for (const ratHourMode of [RAT_HOUR_MODE.CURRENT_DAY, RAT_HOUR_MODE.CURRENT_DAY_TOMORROW_STEM]) {
    const dateCandidate = searchBaziDates({
      startDate: { year: 2026, month: 2, day: 19 },
      endDate: { year: 2026, month: 2, day: 19 },
      options: { ratHourMode },
    })[0];
    const thirteen = searchBaziTimesForDate({ dateCandidate });
    assert.equal(thirteen.length, 13);
    assert.equal(thirteen.filter((item) => item.label === '晚子时').length, 1);
  }
});

test('full reverse lookup resolves an ordinary four-pillar chart', () => {
  const source = clock(2026, 2, 19, 10, 30);
  const chart = BaziChart.fromZonedTime(source);
  const results = reverseLookupBazi({
    year: chart.pillars.year,
    month: chart.pillars.month,
    day: chart.pillars.day,
    hour: chart.pillars.hour,
    startDate: { year: 2026, month: 2, day: 19 },
    endDate: { year: 2026, month: 2, day: 19 },
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].chart.pillars.hour, chart.pillars.hour);
  assert.ok(results[0].timeCandidate);
});

test('full reverse lookup preserves Li-Chun and late-Zi boundaries', () => {
  const todayGan = reverseLookupBazi({
    year: packPillar(2, 6),
    month: packPillar(6, 2),
    day: packPillar(5, 9),
    hour: packPillar(0, 0),
    startDate: DATE_2026_02_04,
    endDate: DATE_2026_02_04,
    options: { ratHourMode: RAT_HOUR_MODE.CURRENT_DAY },
  });
  assert.equal(todayGan.length, 1);
  assert.equal(todayGan[0].dateCandidate.phase, BAZI_DATE_PHASE.AFTER_JIE);
  assert.equal(todayGan[0].timeCandidate.label, '晚子时');

  const tomorrowStem = reverseLookupBazi({
    year: packPillar(2, 6),
    month: packPillar(6, 2),
    day: packPillar(5, 9),
    hour: packPillar(2, 0),
    startDate: DATE_2026_02_04,
    endDate: DATE_2026_02_04,
    options: { ratHourMode: RAT_HOUR_MODE.CURRENT_DAY_TOMORROW_STEM },
  });
  assert.equal(tomorrowStem.length, 1);
  assert.equal(tomorrowStem[0].timeCandidate.label, '晚子时');
});

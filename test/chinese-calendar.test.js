import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CALENDAR_DAY_BOUNDARY_MODE,
  CALENDAR_MODE,
  HISTORICAL_PROFILE_INFO,
  MONTH_NAME,
  calculateChineseCalendarYear,
  findSolarTerm,
  getLunarMonthDays,
  getNextJie,
  getNextQi,
  getPreviousJie,
  getPreviousQi,
  getSpecificSolarTerm,
  historicalEventCivilDay,
  instantToLunar,
  lunarToSolar,
  solarToLunar,
} from '../src/chinese-calendar.js';
import { JulianTime, ZonedTime, julianDay } from '../src/time.js';
import { HISTORICAL_CALENDAR_DATA as HISTORY } from '../src/generated/historical-calendar-data.js';
import { setEventAccuracy, getEventAccuracy, solveSolarLongitude } from '../src/calendar-events.js';
import { fourPillarsForZonedTime, ganzhiName } from '../src/ganzhi.js';

test('global accuracy reaches calendar events and BaZi year/month boundaries', () => {
  const saved = getEventAccuracy(), options = { mode: CALENDAR_MODE.CHINA_ASTRONOMICAL };
  const dates = [];
  try {
    for (const accuracy of ['fast', 'mid', 'accurate']) {
      setEventAccuracy(accuracy);
      const lichun = getSpecificSolarTerm(2026, 21, options);
      const explicit = solveSolarLongitude(315 * Math.PI / 180, lichun.time.jdTT, { accuracy });
      assert.ok(Math.abs(lichun.time.jdTT - explicit.jdTT) * 86400 < 0.02);
      dates.push(lichun.time.jdTT);
      const before = fourPillarsForZonedTime(ZonedTime.fromJulianTime(lichun.time.jdUT1 - 1 / 86400, 480), options);
      const after = fourPillarsForZonedTime(ZonedTime.fromJulianTime(lichun.time.jdUT1 + 1 / 86400, 480), options);
      assert.equal(ganzhiName(before.year), '乙巳');
      assert.equal(ganzhiName(after.year), '丙午');
      assert.notEqual(before.month, after.month);
      const lunar = solarToLunar({ year: 2033, month: 12, day: 22 }, options);
      assert.equal(lunar.month, 11);
      assert.equal(lunar.isLeap, true);
    }
    assert.notEqual(dates[0], dates[1], 'Fast setting must reach the calendar event solver');
    assert.notEqual(dates[1], dates[2], 'Accurate setting must reach the calendar event solver');
  } finally { setEventAccuracy(saved); }
});

function phaseEstimate(kind, phaseIndex) {
  if (kind === 'newMoon') return 2451551 - 14 + (phaseIndex + 0.5) * 29.5306;
  return 2451259 - 7 + (phaseIndex + 0.5) * 365.2422 / 24;
}

test('historical linear-plus-sparse-residual profiles preserve their C++ endpoints', () => {
  assert.equal(HISTORICAL_PROFILE_INFO.sha256, '61f195de0c39d86083ee85e090ea5d955e0ed81759d8f24d15cb9f4029975529');
  assert.equal(HISTORICAL_PROFILE_INFO.packedBitBytes, 3648);

  for (const [kind, profile] of [['newMoon', HISTORY.newMoon], ['solarTerm', HISTORY.solarTerm]]) {
    const first = phaseEstimate(kind, profile.firstPhaseIndex);
    const last = phaseEstimate(kind, profile.firstPhaseIndex + profile.eventCount - 1);
    const after = phaseEstimate(kind, profile.firstPhaseIndex + profile.eventCount);
    assert.equal(historicalEventCivilDay(kind, first), profile.firstCivilDay);
    assert.equal(historicalEventCivilDay(kind, last), profile.lastCivilDay);
    assert.equal(historicalEventCivilDay(kind, after), null);
  }
});

test('modern conversion, month size and 2033 leap-eleven round trip', () => {
  assert.deepEqual(solarToLunar({ year: 2025, month: 1, day: 29 }), {
    year: 2025, historicalYear: 2025, month: 1, day: 1, isLeap: false, monthDays: 30, monthName: MONTH_NAME.NORMAL,
  });
  assert.deepEqual(solarToLunar({ year: 2026, month: 3, day: 15 }), {
    year: 2026, historicalYear: 2026, month: 1, day: 27, isLeap: false, monthDays: 30, monthName: MONTH_NAME.NORMAL,
  });

  const leapEleven = solarToLunar({ year: 2033, month: 12, day: 22 });
  assert.deepEqual(leapEleven, {
    year: 2033, historicalYear: 2033, month: 11, day: 1, isLeap: true, monthDays: 29, monthName: MONTH_NAME.NORMAL,
  });
  assert.deepEqual(lunarToSolar(leapEleven), { year: 2033, month: 12, day: 22 });
  assert.equal(getLunarMonthDays(2033, 11, true), 29);

  const layout = calculateChineseCalendarYear(julianDay({ year: 2034, month: 1, day: 15 }));
  assert.equal(layout.leapMonthIndex, 1);
  assert.deepEqual(layout.months.slice(0, 2).map(month => [month.month, month.isLeap]), [[11, false], [11, true]]);
  assert.equal(layout.solarTerms[24].indexFromWinterSolstice, 24);
});

test('calendar queries accept JulianTime and return typed event instants', () => {
  const probe = new ZonedTime({
    year: 2025, month: 3, day: 1, hour: 12, minute: 0, offsetMinutes: 480,
  }).toJulianTime();
  const layout = calculateChineseCalendarYear(probe);
  assert.ok(layout.solarTerms[0].time instanceof JulianTime);
  assert.ok(layout.newMoons[0].time instanceof JulianTime);
  for (const event of [...layout.solarTerms, ...layout.newMoons]) {
    assert.equal('jdTT' in event, false);
    assert.equal('jdUT1' in event, false);
    assert.equal('deltaTSeconds' in event, false);
    assert.ok(event.time instanceof JulianTime);
  }
  layout.months.forEach((month, index) => {
    assert.equal(month.newMoon, layout.newMoons[index].time);
    assert.equal('astronomicalNewMoonJdUT1' in month, false);
  });
  assert.equal(findSolarTerm(probe, { direction: 'next' }).indexFromWinterSolstice, 5);
});

test('instant conversion uses the requested civil offset without changing the China calendar structure', () => {
  const instant = JulianTime.fromUT1(julianDay({
    year: 2025, month: 1, day: 28, hour: 16, minute: 30,
  }));

  assert.deepEqual(instantToLunar(instant, { utcOffsetMinutes: 480 }), {
    year: 2025, historicalYear: 2025, month: 1, day: 1, isLeap: false, monthDays: 30, monthName: MONTH_NAME.NORMAL,
  });
  assert.deepEqual(instantToLunar(instant, { utcOffsetMinutes: 0 }), {
    year: 2024, historicalYear: 2024, month: 12, day: 29, isLeap: false, monthDays: 29, monthName: MONTH_NAME.NORMAL,
  });
});

test('China-standard and local-astronomical lunar calendars stay distinct at a new-moon boundary', () => {
  const instant = JulianTime.fromUT1(julianDay({
    year: 2026, month: 8, day: 12, hour: 17, minute: 40,
  }));
  const indiaChina = instantToLunar(instant, {
    mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
    utcOffsetMinutes: 330,
  });
  const indiaLocal = instantToLunar(instant, {
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN,
    meridianDeg: 82.5,
    utcOffsetMinutes: 330,
  });

  assert.deepEqual([indiaChina.month, indiaChina.day], [6, 30]);
  assert.deepEqual([indiaLocal.month, indiaLocal.day], [7, 1]);
});

test('local astronomical calendar makes clock and meridian day boundaries explicit', () => {
  const clockOptions = {
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET,
    utcOffsetMinutes: 7 * 60,
  };
  const meridianOptions = {
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN,
    utcOffsetMinutes: 7 * 60,
    meridianDeg: 105,
  };
  const probe = julianDay({ year: 1800, month: 6, day: 1, hour: 12 });
  const clock = calculateChineseCalendarYear(probe, clockOptions);
  const meridian = calculateChineseCalendarYear(probe, meridianOptions);

  assert.equal(clock.dayBoundaryMode, CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET);
  assert.equal(meridian.dayBoundaryMode, CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN);
  assert.deepEqual(
    clock.newMoons.map(event => event.civilDayNumber),
    meridian.newMoons.map(event => event.civilDayNumber),
  );
  assert.ok(clock.newMoons.every((event, index) => event.time.jdUT1 === meridian.newMoons[index].time.jdUT1));

  assert.throws(() => calculateChineseCalendarYear(probe, {
    ...clockOptions,
    meridianDeg: 105,
  }), /only valid/);
  assert.throws(() => calculateChineseCalendarYear(probe, {
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN,
    utcOffsetMinutes: 7 * 60,
  }), /required/);
});

test('historical month reforms match the C++ regression fixtures', () => {
  const fixtures = [
    [{ year: -456, month: 4, day: 4 }, [-456, -456, 5, 12, false, 30, MONTH_NAME.NORMAL]],
    [{ year: -104, month: 1, day: 3 }, [-105, -104, 11, 27, false, 29, MONTH_NAME.NORMAL]],
    [{ year: -103, month: 1, day: 20 }, [-104, -103, 11, 27, false, 30, MONTH_NAME.NORMAL]],
    [{ year: 10, month: 6, day: 1 }, [10, 10, 6, 1, false, 30, MONTH_NAME.NORMAL]],
    [{ year: 238, month: 6, day: 1 }, [238, 238, 6, 2, false, 29, MONTH_NAME.NORMAL]],
    [{ year: 690, month: 6, day: 1 }, [690, 690, 4, 19, false, 29, MONTH_NAME.NORMAL]],
    [{ year: 23, month: 12, day: 2 }, [23, 23, 12, 1, false, 29, MONTH_NAME.ALT_TWELVE]],
    [{ year: 690, month: 2, day: 15 }, [690, 690, 1, 1, false, 29, MONTH_NAME.ALT_ONE]],
  ];
  for (const [solar, expected] of fixtures) {
    const lunar = solarToLunar(solar);
    assert.deepEqual(
      [lunar.year, lunar.historicalYear, lunar.month, lunar.day, lunar.isLeap, lunar.monthDays, lunar.monthName],
      expected,
    );
    assert.deepEqual(lunarToSolar(lunar), solar);
  }
});

test('previous/next solar-term searches preserve filters and exact-boundary semantics', () => {
  const probe = julianDay({ year: 2025, month: 3, day: 1, hour: 4 });
  assert.equal(findSolarTerm(probe, { direction: 'previous' }).indexFromWinterSolstice, 4);
  assert.equal(findSolarTerm(probe, { direction: 'next' }).indexFromWinterSolstice, 5);
  assert.equal(getPreviousJie(probe).indexFromWinterSolstice, 3);
  assert.equal(getNextJie(probe).indexFromWinterSolstice, 5);
  assert.equal(getPreviousQi(probe).indexFromWinterSolstice, 4);
  assert.equal(getNextQi(probe).indexFromWinterSolstice, 6);

  const lichun = getPreviousJie(probe);
  assert.equal(findSolarTerm(lichun.time.jdUT1, { direction: 'previous' }).indexFromWinterSolstice, 3);
  assert.equal(findSolarTerm(lichun.time.jdUT1, { direction: 'next' }).indexFromWinterSolstice, 4);
});

test('direct terms agree with the materialized 2044 cycle', () => {
  const layout = calculateChineseCalendarYear(julianDay({ year: 2044, month: 6, day: 1, hour: 4 }));
  for (let index = 0; index < 24; index += 1) {
    const direct = getSpecificSolarTerm(2044, index);
    const expected = index <= 18 ? layout.solarTerms[index + 6] : layout.solarTerms[index - 18];
    assert.ok(Math.abs(direct.time.jdUT1 - expected.time.jdUT1) < 1 / 86400);
    assert.equal(direct.civilDayNumber, expected.civilDayNumber);
  }
});

test('calendar layout remains finite and ordered over the intended long interval', () => {
  for (const yearNumber of [-6000, 0, 3000, 10000]) {
    const layout = calculateChineseCalendarYear(
      julianDay({ year: yearNumber, month: 6, day: 1 }),
      { mode: CALENDAR_MODE.CHINA_ASTRONOMICAL },
    );
    assert.equal(layout.solarTerms.length, 25);
    assert.equal(layout.newMoons.length, 15);
    assert.equal(layout.months.length, 14);
    assert.ok(layout.solarTerms.every((event, index, all) => index === 0 || event.time.jdUT1 > all[index - 1].time.jdUT1));
    assert.ok(layout.newMoons.every((event, index, all) => index === 0 || event.time.jdUT1 > all[index - 1].time.jdUT1));
    assert.ok(layout.months.every(month => month.dayCount === 29 || month.dayCount === 30));
  }
});

test('astronomical solar/lunar conversion round-trips across the long interval', () => {
  const options = { mode: CALENDAR_MODE.CHINA_ASTRONOMICAL };
  for (const year of [-4712, -3000, -1000, 0, 1582, 2033, 5000, 9999]) {
    for (const month of [1, 7]) {
      const solar = { year, month, day: 15 };
      const lunar = solarToLunar(solar, options);
      assert.deepEqual(lunarToSolar(lunar, options), solar);
    }
  }
});

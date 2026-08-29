import test from 'node:test';
import assert from 'node:assert/strict';

import { CALENDAR_MODE, getSpecificSolarTerm } from '../src/chinese-calendar.js';
import {
  RAT_HOUR_MODE,
  WUXING,
  advanceGanzhi,
  calculateDayPillar,
  calculateFourPillars,
  describeFourPillars,
  fourPillarsForZonedTime,
  ganzhiIndex,
  getHourGanzhi,
  getMonthGanzhi,
  getNayinElement,
  getNayinId,
  makeGanzhi,
  normalizeChartVirtualTime,
} from '../src/ganzhi.js';
import {
  localApparentToMeanSolarTime,
  meanSolarTime,
  trueSolarTime,
} from '../src/solar-time.js';
import { JulianTime, ZonedTime, julianDay } from '../src/time.js';

const ASTRONOMICAL_CHINA = { mode: CALENDAR_MODE.CHINA_ASTRONOMICAL };

test('Ganzhi encoding, cycle advance, Wu-Hu-Dun and Wu-Shu-Dun match C++ rules', () => {
  assert.equal(makeGanzhi(4, 6), 0x46);
  assert.equal(advanceGanzhi(0x46, 1), 0x57);
  assert.throws(() => makeGanzhi(0, 1), RangeError);

  for (let stem = 0; stem < 10; stem += 1) {
    for (let month = 0; month < 12; month += 1) {
      assert.equal(getMonthGanzhi(stem, month),
        (((stem % 5) * 2 + 2 + month) % 10 << 4) | ((month + 2) % 12));
    }
    for (let hour = 0; hour < 12; hour += 1) {
      assert.equal(getHourGanzhi(stem, hour),
        (((stem % 5) * 2 + hour) % 10 << 4) | hour);
    }
  }
});

test('all sexagenary indices and Nayin mappings are stable', () => {
  for (let index = 0; index < 60; index += 1) {
    const value = makeGanzhi(index % 10, index % 12);
    assert.equal(ganzhiIndex(value), index);
    assert.equal(getNayinId(value), Math.floor(index / 2));
    assert.ok(Object.values(WUXING).includes(getNayinElement(value)));
  }
  assert.equal(getNayinElement(0x00), WUXING.METAL);
  assert.equal(getNayinElement(0x28), WUXING.FIRE);
});

test('day-pillar anchors match the C++ layer', () => {
  assert.equal(calculateDayPillar({ year: 2000, month: 1, day: 7 }), 0x00);
  assert.equal(calculateDayPillar({ year: 2000, month: 1, day: 9 }), 0x22);
});

test('modern four-pillar regression vectors match the C++ layer', () => {
  const fixtures = [
    [{ year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0 }, [0x66, 0x75, 0x64, 0x97]],
    [{ year: 1900, month: 1, day: 1, hour: 12, minute: 0, second: 0 }, [0x5b, 0x20, 0x0a, 0x66]],
    [{ year: 2000, month: 1, day: 1, hour: 0, minute: 30, second: 0 }, [0x53, 0x20, 0x46, 0x80]],
    [{ year: 2026, month: 3, day: 5, hour: 10, minute: 4, second: 0 }, [0x26, 0x62, 0x42, 0x35]],
  ];
  for (const [fields, expected] of fixtures) {
    const time = new ZonedTime({ ...fields, offsetMinutes: 480 });
    const pillars = fourPillarsForZonedTime(time, ASTRONOMICAL_CHINA);
    assert.deepEqual([pillars.year, pillars.month, pillars.day, pillars.hour], expected);
  }
});

test('the three late-Zi conventions remain independent', () => {
  assert.deepEqual(RAT_HOUR_MODE, {
    NEXT_DAY: 'next-day',
    CURRENT_DAY: 'current-day',
    CURRENT_DAY_TOMORROW_STEM: 'current-day-tomorrow-stem',
  });
  const time = new ZonedTime({
    year: 2000, month: 1, day: 1, hour: 23, minute: 30, second: 0, offsetMinutes: 480,
  });
  const expected = new Map([
    [RAT_HOUR_MODE.NEXT_DAY, [0x57, 0x00]],
    [RAT_HOUR_MODE.CURRENT_DAY_TOMORROW_STEM, [0x46, 0x00]],
    [RAT_HOUR_MODE.CURRENT_DAY, [0x46, 0x80]],
  ]);
  for (const [ratHourMode, [day, hour]] of expected) {
    const pillars = fourPillarsForZonedTime(time, { ...ASTRONOMICAL_CHINA, ratHourMode });
    assert.equal(pillars.day, day);
    assert.equal(pillars.hour, hour);
  }
});

test('exact Shi-Chen boundaries enter the new branch after a JD round trip', () => {
  const starts = [
    [1, 1], [3, 2], [5, 3], [7, 4], [9, 5], [11, 6],
    [13, 7], [15, 8], [17, 9], [19, 10], [21, 11], [23, 0],
  ];
  for (const [hour, expectedBranch] of starts) {
    const source = new ZonedTime({
      year: 2026, month: 4, day: 8, hour, minute: 0, second: 0, offsetMinutes: 480,
    });
    const reconstructed = ZonedTime.fromJulianTime(source.toJulianTime(), 480);
    const normalized = normalizeChartVirtualTime(reconstructed);
    assert.deepEqual(
      [normalized.year, normalized.month, normalized.day,
        normalized.hour, normalized.minute, normalized.second],
      [2026, 4, 8, hour, 0, 0],
    );
    const pillars = fourPillarsForZonedTime(reconstructed, ASTRONOMICAL_CHINA);
    assert.equal(pillars.hour & 0x0f, expectedBranch, `${hour}:00 entered the wrong Shi-Chen`);
  }

  const before = new ZonedTime({
    year: 2026, month: 4, day: 8, hour: 10, minute: 59, second: 59.999,
    offsetMinutes: 480,
  });
  const at = new ZonedTime({
    year: 2026, month: 4, day: 8, hour: 11, minute: 0, second: 0,
    offsetMinutes: 480,
  });
  assert.equal(fourPillarsForZonedTime(before, ASTRONOMICAL_CHINA).hour & 0x0f, 5);
  assert.equal(fourPillarsForZonedTime(at, ASTRONOMICAL_CHINA).hour & 0x0f, 6);
  const genuineBefore = normalizeChartVirtualTime({
    year: 2026, month: 4, day: 8, hour: 10, minute: 59, second: 59.99998,
  });
  assert.deepEqual(
    [genuineBefore.hour, genuineBefore.minute, genuineBefore.second],
    [10, 59, 59.99998],
  );
});

test('mean and apparent solar clocks share the exact 11:00 chart boundary', () => {
  const longitudeDeg = 118.5;
  const exactLocalJd = julianDay({
    year: 2003, month: 3, day: 13, hour: 11, minute: 0, second: 0,
  });
  for (const [name, clock, instantForLocalJd] of [
    ['mean', meanSolarTime, (value) => value - longitudeDeg / 360],
    ['apparent', trueSolarTime, (value) => (
      localApparentToMeanSolarTime(value, longitudeDeg) - longitudeDeg / 360
    )],
  ]) {
    for (const [offsetSeconds, expectedBranch] of [[-0.001, 5], [0, 6]]) {
      const jdUT1 = instantForLocalJd(exactLocalJd + offsetSeconds / 86400);
      const instant = JulianTime.fromUT1(jdUT1);
      const virtualTime = clock(instant, longitudeDeg);
      const pillars = calculateFourPillars(instant, virtualTime, ASTRONOMICAL_CHINA);
      assert.equal(
        pillars.hour & 0x0f,
        expectedBranch,
        `${name} solar clock mishandled ${offsetSeconds}s from 11:00`,
      );
    }
  }
});

test('Li-Chun and monthly Jie switch pillars at the solved instant', () => {
  const term = getSpecificSolarTerm(2024, 21, ASTRONOMICAL_CHINA);
  const beforeInstant = JulianTime.fromUT1(term.time.jdUT1 - 0.5 / 86400);
  const afterInstant = JulianTime.fromUT1(term.time.jdUT1 + 0.5 / 86400);
  const beforeClock = beforeInstant.toZonedTime(480);
  const afterClock = afterInstant.toZonedTime(480);
  const before = calculateFourPillars(beforeInstant, beforeClock, ASTRONOMICAL_CHINA);
  const after = calculateFourPillars(afterInstant, afterClock, ASTRONOMICAL_CHINA);
  assert.deepEqual([before.year, before.month], [0x93, 0x11]);
  assert.deepEqual([after.year, after.month], [0x04, 0x22]);
  assert.deepEqual(describeFourPillars(after), {
    year: '甲辰', month: '丙寅', day: describeFourPillars(after).day, hour: describeFourPillars(after).hour,
  });
});

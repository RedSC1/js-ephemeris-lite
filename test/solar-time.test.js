import test from 'node:test';
import assert from 'node:assert/strict';

import { CALENDAR_MODE } from '../src/chinese-calendar.js';
import {
  RAT_HOUR_MODE,
  calculateFourPillars,
} from '../src/ganzhi.js';
import {
  SolarClock,
  equationOfTime,
  localApparentToMeanSolarTime,
  localMeanToApparentSolarTime,
  meanSolarTime,
  trueSolarTime,
} from '../src/solar-time.js';
import { ZonedTime } from '../src/time.js';

function near(actual, expected, tolerance, message = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} != ${expected} (tol ${tolerance})`);
}

test('equation of time follows the C++/Swiss modern regression oracles', () => {
  const oracles = [
    [2451545.0, -197.11531440430917],
    [2460311.0, -198.9342282623329],
    [2460409.0, -102.17101941988405],
    [2460676.5, -206.5203796885362],
  ];
  for (const [jdUT1, expectedSeconds] of oracles) {
    const result = equationOfTime(jdUT1);
    near(result.equationSeconds, expectedSeconds, 0.02, `${jdUT1}`);
    near(result.equationDays * 86400, result.equationSeconds, 1e-12);
  }
});

test('mean and true solar clocks follow the C++ convention and round trip', () => {
  const jdUT1 = 2460311.0;
  const longitudeDeg = 116.3833;
  const mean = meanSolarTime(jdUT1, longitudeDeg);
  const apparent = trueSolarTime(jdUT1, longitudeDeg);
  assert.ok(mean instanceof SolarClock);
  assert.ok(apparent instanceof SolarClock);
  assert.equal(mean.sourceClock, null);
  assert.equal(apparent.sourceClock, null);
  assert.equal(mean.mode, 'mean');
  assert.equal(apparent.mode, 'apparent');
  near(mean.jdSolar, jdUT1 + longitudeDeg / 360, 0);
  near((apparent.jdSolar - mean.jdSolar) * 86400, apparent.equationOfTimeSeconds, 2e-5);
  const converted = localMeanToApparentSolarTime(mean.jdSolar, longitudeDeg);
  near(converted, apparent.jdSolar, 0);
  near(localApparentToMeanSolarTime(converted, longitudeDeg), mean.jdSolar, 5e-10);
  assert.equal('offsetMinutes' in apparent, false);
  assert.equal('toJulianTime' in apparent, false);
});

test('solar clocks naturally cross into the previous or next calendar date', () => {
  const lateUtc = new ZonedTime({
    year: 2024, month: 1, day: 1, hour: 23, minute: 30, second: 0, offsetMinutes: 0,
  });
  const earlyUtc = new ZonedTime({
    year: 2024, month: 1, day: 2, hour: 0, minute: 30, second: 0, offsetMinutes: 0,
  });
  const next = trueSolarTime(lateUtc, 180);
  const previous = trueSolarTime(earlyUtc, -180);
  assert.deepEqual([next.year, next.month, next.day], [2024, 1, 2]);
  assert.deepEqual([previous.year, previous.month, previous.day], [2024, 1, 1]);
  assert.equal(next.sourceClock, lateUtc);
  assert.equal(previous.sourceClock, earlyUtc);
});

test('four pillars keep the physical instant while using the true-solar virtual day and hour', () => {
  const civilClock = new ZonedTime({
    year: 2000, month: 1, day: 1, hour: 23, minute: 10, second: 0, offsetMinutes: 480,
  });
  const instant = civilClock.toJulianTime();
  const solarClock = trueSolarTime(civilClock, 116.4);
  assert.equal(solarClock.sourceClock, civilClock);
  assert.deepEqual(
    [solarClock.year, solarClock.month, solarClock.day, solarClock.hour],
    [2000, 1, 1, 22],
  );
  const options = {
    mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
    ratHourMode: RAT_HOUR_MODE.NEXT_DAY,
  };
  const civil = calculateFourPillars(instant, civilClock, options);
  const apparent = calculateFourPillars(instant, solarClock, options);
  assert.notEqual(civil.day, apparent.day);
  assert.equal(civil.year, apparent.year);
  assert.equal(civil.month, apparent.month);
});

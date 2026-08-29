import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DELTA_T_INFO,
  JulianTime,
  TIME_INFO,
  ZonedTime,
  asUt1JulianDay,
  decimalYearFromJulianDay,
  deltaTSeconds,
  deltaTSecondsFromTt,
  deltaTSecondsFromUt1,
  ttToUt1,
  ut1ToTt,
} from '../src/time.js';

function near(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected} (tol ${tolerance})`);
}

test('Delta T decimal-year model matches the C++ regression vectors', () => {
  const vectors = [
    [-1000, 25427.68], [-720, 20371.848], [-719.5, 20363.7843227998],
    [-100, 11557.668], [0, 10441.312575999998], [399.999, 6535.125452533171],
    [400, 6535.116], [1000, 1650.393], [1150, 1056.647],
    [1500, 292.343], [1600, 109.127], [1800, 18.367],
    [1850, 9.338], [1900, -1.977], [1952.999, 30.00175459878804],
    [1953, 30], [1953.25, 30.049765625], [1961.5, 33.486875],
    [1972.5, 42.765625], [2000, 63.83], [2016.5, 68.35],
    [2024.25, 69.171171875], [2049.5, 71.329375], [2050, 71.44],
    [2050.5, 72.56600000000005], [2100, 191.95999999999998], [2200, 442.08],
  ];
  for (const [year, expected] of vectors) near(deltaTSeconds(year), expected);
  assert.equal(DELTA_T_INFO.annualInterpolation, 'Catmull-Rom cubic Hermite');
});

test('the repaired -720 join is continuous in value and first derivative', () => {
  const h = 1e-4;
  for (const boundary of [-820, -720]) {
    near(deltaTSeconds(boundary - 1e-9), deltaTSeconds(boundary + 1e-9), 1e-6);
    const leftRate = (deltaTSeconds(boundary) - deltaTSeconds(boundary - h)) / h;
    const rightRate = (deltaTSeconds(boundary + h) - deltaTSeconds(boundary)) / h;
    near(leftRate, rightRate, 2e-5);
  }
  assert.equal(DELTA_T_INFO.earlyJoinStartYear, -820);
});

test('JD conversion and TT/UT1 estimates match the C++ regression vectors', () => {
  near(decimalYearFromJulianDay(2451545), 2000 + 0.5 / 366, 1e-14);
  const ut1Vectors = [
    [2451545, 63.83042335736016],
    [2460409.5, 69.17035296181177],
    [2460409.262037037, 69.17037911418967],
    [2448001.75, 57.06055072295038],
    [2086302.5, 1650.4617878426973],
  ];
  for (const [jd, expected] of ut1Vectors) near(deltaTSecondsFromUt1(jd), expected, 1e-11);
  near(deltaTSecondsFromTt(2451545), 63.830422732032133, 1e-11);
  near(deltaTSecondsFromTt(2460409.262837778), 69.17037911417232, 1e-11);
});

test('TT and UT1 helpers round trip', () => {
  for (const jdTT of [2086302.5, 2451545, 2460409.262837778, 5373484.5]) {
    const jdUT1 = ttToUt1(jdTT);
    near(ut1ToTt(jdUT1), jdTT, 2e-10);
  }
});

test('JulianTime preserves TT event roots and restores JSON without a timezone', () => {
  for (const jdTT of [-450135.9998242189, 2086302.5, 2451545, 2461212.85, 5373484.5]) {
    const time = JulianTime.fromTT(jdTT);
    assert.equal(time.jdTT, jdTT);
    assert.equal(time.deltaTSeconds, deltaTSecondsFromTt(jdTT));
    assert.equal('offsetMinutes' in time, false);
    assert.ok(Object.isFrozen(time));
    assert.deepEqual(new JulianTime(JSON.parse(JSON.stringify(time))), time);
    for (const offset of [-720, 0, 345, 480, 840]) {
      const clock = time.toZonedTime(offset);
      assert.equal(clock.offsetMinutes, offset);
      near(clock.toJulianTime().jdUT1, time.jdUT1, 1e-9);
    }
  }
  for (const invalid of [null, {}, { jdTT: NaN, jdUT1: 0, deltaTSeconds: 0 }]) {
    assert.throws(() => new JulianTime(invalid), TypeError);
  }
  assert.throws(() => new JulianTime({ jdTT: 2451546, jdUT1: 2451545, deltaTSeconds: 0 }), RangeError);
});

test('JulianTime converts JavaScript Date through its Unix timestamp', () => {
  const epoch = JulianTime.fromDate(new Date(0));
  near(epoch.jdUT1, 2440587.5, 0);
  assert.equal(epoch.toUnixMilliseconds(), 0);

  const date = new Date('2025-01-29T04:30:15.250Z');
  const time = JulianTime.fromDate(date);
  near(time.jdUT1, 2440587.5 + date.getTime() / 86400000, 0);
  assert.ok(Math.abs(time.toDate().getTime() - date.getTime()) <= 1);
  assert.equal(asUt1JulianDay(time), time.jdUT1);
  assert.equal(TIME_INFO.utcConvention, 'UTC is treated as UT1 in the lite runtime');
});

test('ZonedTime requires an offset and preserves the represented instant', () => {
  assert.throws(() => new ZonedTime({
    year: 2025, month: 1, day: 29, hour: 12, minute: 30,
  }), /offsetMinutes/);

  const zoned = new ZonedTime({
    year: 2025,
    month: 1,
    day: 29,
    hour: 12,
    minute: 30,
    second: 15.25,
    offsetMinutes: 480,
  });
  const expected = new Date('2025-01-29T04:30:15.250Z');
  assert.ok(Math.abs(zoned.toDate().getTime() - expected.getTime()) <= 1);

  const reconstructed = ZonedTime.fromDate(expected, 480);
  assert.deepEqual(
    [reconstructed.year, reconstructed.month, reconstructed.day,
      reconstructed.hour, reconstructed.minute, Math.round(reconstructed.second * 1000)],
    [2025, 1, 29, 12, 30, 15250],
  );
  near(reconstructed.toJulianTime().jdUT1, JulianTime.fromDate(expected).jdUT1, 1e-12);
});

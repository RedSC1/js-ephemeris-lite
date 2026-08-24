import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUREAU,
  PALACE,
  STAR_TRANSFORM_MARK,
  ZIWEI_CLOCK_MODE,
  ZIWEI_GENDER,
  ZIWEI_RULE_OPTION,
  ZiweiChart,
  ZiweiOptions,
  computeZiweiAnchors,
  findStarId,
} from '../dist/index.js';
import { ZonedTime, makeGanzhi } from 'js-ephemeris-lite';

function pillars(year, month, day, hour) {
  return Object.freeze({ year, month, day, hour });
}

test('finite natal rule core matches the native C++ oracle fixture', () => {
  const options = new ZiweiOptions({ gender: ZIWEI_GENDER.MALE });
  const cycle0 = makeGanzhi(0, 0);
  const month1 = makeGanzhi(2, 2);
  const facts = Object.freeze({
    jdUT1: 0,
    virtualTime: Object.freeze({ year: 1984, month: 1, day: 1, hour: 0, minute: 0, second: 0 }),
    gender: ZIWEI_GENDER.MALE,
    lunarDate: Object.freeze({ year: 1984, month: 1, day: 1, isLeap: false, monthName: 0 }),
    solarTermPillars: pillars(cycle0, month1, cycle0, cycle0),
    lunarPillars: pillars(cycle0, month1, cycle0, cycle0),
    effectiveLunarYear: 1984,
    effectiveLunarMonth: 1,
    solarDayFromPreviousJie: 1,
  });
  const resolved = computeZiweiAnchors(facts, options);
  const chart = ZiweiChart.fromResolvedBirth(Object.freeze({ facts, ...resolved, options }));

  assert.equal(chart.anchors.palacePositions[PALACE.LIFE], 2);
  assert.equal(chart.bodyPalace, 2);
  assert.equal(chart.anchors.bureau, BUREAU.FIRE_6);
  assert.deepEqual(chart.palaceStems, [2, 3, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1]);
  assert.equal(chart.lifeMaster, 20);
  assert.equal(chart.bodyMaster, 25);
  assert.deepEqual(chart.starPositions.slice(0, 14), [9, 8, 6, 5, 4, 1, 7, 8, 9, 10, 11, 0, 1, 5]);
  assert.deepEqual(chart.transformationMasks.slice(0, 14), [0, 512, 24, 20, 0, 1, 0, 0, 128, 0, 0, 0, 0, 2]);
});

test('calendar-backed chart matches the native 2003 historical-China fixture', () => {
  const birth = new ZonedTime({
    year: 2003, month: 1, day: 1, hour: 0, minute: 30, second: 0, offsetMinutes: 480,
  });
  const chart = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
  );

  assert.deepEqual(
    [chart.facts.effectiveLunarYear, chart.facts.effectiveLunarMonth],
    [2002, 11],
  );
  assert.equal(chart.anchors.palacePositions[PALACE.LIFE], 0);
  assert.equal(chart.bodyPalace, 0);
  assert.equal(chart.anchors.bureau, BUREAU.WOOD_3);
  assert.deepEqual(chart.palaceStems, [8, 9, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(chart.lifeMaster, 8);
  assert.equal(chart.bodyMaster, 24);
  assert.deepEqual(chart.starPositions.slice(0, 14), [10, 9, 7, 6, 5, 2, 6, 7, 8, 9, 10, 11, 0, 4]);
  assert.deepEqual(chart.transformationMasks.slice(0, 14), [2, 0, 0, 2056, 0, 0, 0, 1040, 16, 512, 0, 513, 0, 32]);
});

test('chart helpers expose palaces, stars, brightness and transformation marks', () => {
  const birth = new ZonedTime({
    year: 2003, month: 3, day: 13, hour: 14, minute: 15, second: 0, offsetMinutes: 480,
  });
  const chart = ZiweiChart.fromZonedTime(birth, new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }));
  const ziwei = findStarId('ziwei');
  assert.notEqual(ziwei, undefined);
  const placement = chart.getStarPosition(ziwei);
  assert.equal(placement.key, 'ziwei');
  assert.ok(chart.getStarsInPalace(placement.palaceId).some((star) => star.id === ziwei));
  assert.equal(
    chart.hasTransform(ziwei, STAR_TRANSFORM_MARK.BIRTH_YEAR_LU),
    (placement.transformMask & 1) !== 0,
  );
  assert.deepEqual(
    [...chart.palaces].map((palace) => palace.palaceId).sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, index) => index),
  );
});

test('ZiweiOptions validates gender and solar-clock longitude', () => {
  assert.throws(() => new ZiweiOptions({ gender: 2 }), /gender/);
  assert.throws(
    () => new ZiweiOptions({
      gender: ZIWEI_GENDER.FEMALE,
      clockMode: ZIWEI_CLOCK_MODE.TRUE_SOLAR,
    }),
    /longitudeDeg/,
  );
  const original = new ZiweiOptions({ gender: ZIWEI_GENDER.FEMALE });
  const updated = original.with({ clockMode: ZIWEI_CLOCK_MODE.CIVIL });
  assert.notEqual(updated, original);
  assert.equal(updated.gender, ZIWEI_GENDER.FEMALE);
});

test('rule families switch independently and preserve unrelated placements', () => {
  const birth = new ZonedTime({
    year: 1990, month: 1, day: 13, hour: 14, minute: 0, second: 0, offsetMinutes: 480,
  });
  const defaultChart = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
  );
  const alternateChart = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { longevity: ZIWEI_RULE_OPTION.OPTION_2 },
    }),
  );

  assert.equal(defaultChart.anchors.bureau, BUREAU.EARTH_5);
  assert.deepEqual(defaultChart.starPositions.slice(0, 103), alternateChart.starPositions.slice(0, 103));
  assert.deepEqual(defaultChart.starPositions.slice(103, 115), [8, 7, 6, 5, 4, 3, 2, 1, 0, 11, 10, 9]);
  assert.deepEqual(alternateChart.starPositions.slice(103, 115), [2, 1, 0, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  assert.equal(alternateChart.options.rules.longevity, ZIWEI_RULE_OPTION.OPTION_2);
});

test('rule options merge deeply and unavailable variants fail clearly', () => {
  const original = new ZiweiOptions({
    gender: ZIWEI_GENDER.FEMALE,
    rules: {
      placement: { ziwei: ZIWEI_RULE_OPTION.OPTION_1 },
      brightness: { taiyang: ZIWEI_RULE_OPTION.OPTION_1 },
    },
  });
  const updated = original.with({ rules: { longevity: ZIWEI_RULE_OPTION.OPTION_2 } });
  assert.equal(updated.rules.placement.ziwei, ZIWEI_RULE_OPTION.OPTION_1);
  assert.equal(updated.rules.brightness.taiyang, ZIWEI_RULE_OPTION.OPTION_1);
  assert.equal(updated.rules.longevity, ZIWEI_RULE_OPTION.OPTION_2);

  const birth = new ZonedTime({
    year: 2003, month: 1, day: 1, hour: 0, minute: 30, second: 0, offsetMinutes: 480,
  });
  assert.throws(
    () => ZiweiChart.fromZonedTime(birth, new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { brightnessDefault: ZIWEI_RULE_OPTION.OPTION_2 },
    })),
    /brightness option "option2" is unavailable/,
  );
});

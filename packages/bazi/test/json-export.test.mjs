import assert from 'node:assert/strict';
import test from 'node:test';
import { ZonedTime, RAT_HOUR_MODE } from 'js-ephemeris-lite';
import { BaziChart, BaziOptions, GENDER } from '../dist/index.js';

test('JSON keeps source offset separate from calendar offset and solar clock', () => {
  const clock = new ZonedTime({ year: 2000, month: 1, day: 1, hour: 0, minute: 5,
    second: 12.5, offsetMinutes: 345 });
  for (const clockMode of ['civil', 'mean-solar', 'true-solar']) {
    const chart = BaziChart.fromZonedTime(clock, { clockMode, longitudeDeg: 75,
      gender: GENDER.FEMALE, utcOffsetMinutes: 480, ratHourMode: RAT_HOUR_MODE.CURRENT_DAY });
    const json = JSON.parse(JSON.stringify(chart));
    assert.equal(json.schemaVersion, 'bazi-chart-v1');
    assert.deepEqual(json.birth.clockTime, clock.toJSON());
    assert.deepEqual(json.birth.virtualTime, chart.birthCivilTime);
    assert.equal(json.birth.jdUT1, chart.birthJdUT1);
    assert.equal(json.birth.gender, 'female');
    assert.equal(json.options.utcOffsetMinutes, 480);
    assert.equal(json.birth.clockTime.offsetMinutes, 345);
    if (clockMode !== 'civil') assert.notEqual(json.birth.virtualTime.day, clock.day);
    const rebuilt = BaziChart.fromZonedTime(new ZonedTime(json.birth.clockTime), new BaziOptions(json.options));
    assert.deepEqual(rebuilt.pillars, chart.pillars);
    assert.deepEqual(json.fortune.decades.map((entry) => entry.pillar), chart.getDaYunTable().map((entry) => entry.pillar));
    assert.ok(json.columns.every((column) => Array.isArray(column.shenSha)));
  }
});

test('instant-only export never invents the original birth clock or gender', () => {
  const clock = new ZonedTime({ year: 0, month: 2, day: 29, offsetMinutes: -210 });
  const chart = BaziChart.fromInstant(clock.toJulianTime(), clock);
  const json = JSON.parse(JSON.stringify(chart));
  assert.equal(json.birth.clockTime, null);
  assert.equal(json.birth.gender, null);
  assert.equal(json.fortune, null);
  assert.equal(json.birth.virtualTime.year, 0);
  assert.equal(json.birth.yearNumbering, 'astronomical');
  assert.deepEqual(BaziChart.fromInstant(json.birth.jdUT1, json.birth.virtualTime, json.options).pillars, chart.pillars);
});

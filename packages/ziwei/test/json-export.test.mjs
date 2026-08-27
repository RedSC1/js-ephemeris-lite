import assert from 'node:assert/strict';
import test from 'node:test';
import { ZonedTime } from 'js-ephemeris-lite';
import { ZiweiChart, ZiweiConfigLoader, ZiweiOptions, ZiweiRuleset, ZiweiRuleModule,
  resolveZiweiBirth, resolveZiweiBirthFromInstant } from '../dist/index.js';

test('JSON preserves source clock, solar clock and late-zi logical date separately', () => {
  const clock = new ZonedTime({ year: 2000, month: 1, day: 1, hour: 23, minute: 35,
    second: 0.5, offsetMinutes: 420 });
  for (const clockMode of ['civil', 'mean-solar', 'true-solar']) {
    const options = new ZiweiOptions({ gender: 0, clockMode, longitudeDeg: 90, utcOffsetMinutes: 480 });
    const chart = ZiweiChart.fromResolvedBirth(resolveZiweiBirth(clock, options));
    const json = JSON.parse(JSON.stringify(chart));
    assert.equal(json.schemaVersion, 'ziwei-chart-v1');
    assert.deepEqual(json.birth.clockTime, clock.toJSON());
    assert.deepEqual(json.birth.virtualTime, chart.facts.virtualTime);
    assert.equal(json.birth.jdUT1, chart.facts.jdUT1);
    assert.equal(json.birth.gender, 'male');
    assert.equal(json.options.utcOffsetMinutes, 480);
    assert.equal(json.birth.clockTime.offsetMinutes, 420);
    assert.equal(json.palaces.length, 12);
    assert.ok(json.palaces.flatMap((p) => p.stars).every((star) => Array.isArray(star.transformations)));
    assert.ok(json.palaces.some((p) => p.isBodyPalace));
  }
});

test('lunar and instant entries preserve known inputs without inventing a birth clock', () => {
  const lunar = { year: 2000, month: 1, day: 1, isLeap: false, hour: 12, minute: 3, second: 4 };
  const chart = ZiweiChart.fromLunar(lunar, { gender: 1 });
  const json = JSON.parse(JSON.stringify(chart));
  assert.deepEqual(json.birth.lunarInput, lunar);
  assert.equal(json.birth.clockTime.hour, 12);
  const resolved = resolveZiweiBirthFromInstant(chart.facts.jdUT1, chart.facts.virtualTime, chart.options);
  const withoutClock = JSON.parse(JSON.stringify(ZiweiChart.fromResolvedBirth(resolved)));
  assert.equal(withoutClock.birth.clockTime, null);
  assert.equal(withoutClock.birth.lunarInput, null);
});

test('custom stars, brightness and labelled rule order survive JSON export', () => {
  const ruleset = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'export-custom',
    starsJson: JSON.stringify([{ key: 'my_star', category: 'minor', rule: { type: 'constant', value: 0 } }]),
    brightnessJson: JSON.stringify({ brightness_labels: { 6: '超亮' }, static_stars: { my_star: Array(12).fill(6) } }),
  });
  const clock = new ZonedTime({ year: 0, month: 1, day: 1, hour: 12, offsetMinutes: 480 });
  const chart = ZiweiChart.fromZonedTime(clock, { gender: 1, rules: { ruleset } });
  const json = JSON.parse(JSON.stringify(chart));
  const custom = json.palaces.flatMap((p) => p.stars).find((star) => star.key === 'my_star');
  assert.ok(custom.id >= 159);
  assert.equal(custom.brightnessLabel, '超亮');
  assert.equal(json.birth.clockTime.year, 0);
  const restoredRuleset = new ZiweiRuleset(json.options.rules.ruleset.modules.map((m) => new ZiweiRuleModule(m)));
  const restored = ZiweiChart.fromZonedTime(new ZonedTime(json.birth.clockTime), {
    ...json.options, rules: { ...json.options.rules, ruleset: restoredRuleset },
  });
  assert.deepEqual(restored.starPositions, chart.starPositions);
  assert.deepEqual(restored.toJSON().palaces, chart.toJSON().palaces);
});

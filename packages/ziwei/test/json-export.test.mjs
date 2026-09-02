import assert from 'node:assert/strict';
import test from 'node:test';
import { ZonedTime } from 'js-ephemeris-lite';
import { ZiweiCastingChart, ZiweiChart, ZiweiConfigLoader, ZiweiOptions, ZiweiRuleset, ZiweiRuleModule,
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


test('casting JSON preserves its source, custom rules and omitted placements without birth placeholders', () => {
  const ruleset = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'casting-custom',
    starsJson: JSON.stringify([{ key: 'casting_star', category: 'minor', rule: { type: 'constant', value: 11 } }]),
    brightnessJson: JSON.stringify({ brightness_labels: { 6: '自定亮度' }, static_stars: { casting_star: Array(12).fill(6) } }),
    sihuaJson: JSON.stringify({ jia: { lu: 'casting_star' } }),
  }).with(new ZiweiRuleModule({ label: 'requires-real-day', patch: {
    natalPlacements: { ziwei: { inputs: ['lunar.day_stem'], shape: [10], positions: Array.from({ length: 10 }, (_, i) => i) } },
  } }));
  const original = ZiweiCastingChart.fromInput({ yearGanIndex: 0, yearZhiIndex: 0, month: 2, day: 30, hourZhiIndex: 0 },
    { gender: 1, rules: { ruleset } });
  const chart = original.modify({ month: 5, updateBureau: true }).shiftLifePalace(1);
  const json = JSON.parse(JSON.stringify(chart));
  assert.equal(json.schemaVersion, 'ziwei-casting-chart-v1');
  assert.equal(json.kind, 'ziwei-casting');
  for (const absent of ['birth', 'facts', 'jdUT1', 'birthYearTransformations']) assert.equal(absent in json, false);
  assert.deepEqual(json.casting, { method: 'manual' });
  assert.deepEqual(json.originalInput, original.placementInput);
  assert.deepEqual(json.placementInput, chart.placementInput);
  assert.equal(json.omittedPlacements.some(x => x.missingInputs.includes('lunar.day_stem')), true);
  assert.equal(chart.getStarPosition(chart.findStarId('ziwei')), null);
  const custom = json.palaces.flatMap(p => p.stars).find(star => star.key === 'casting_star');
  assert.equal(custom.brightnessLabel, '自定亮度');
  assert.ok(custom.transformations.some(x => x.scope === 'year' && x.kind === 'lu'));
  const restoredRules = new ZiweiRuleset(json.options.rules.ruleset.modules.map(m => new ZiweiRuleModule(m)));
  const restored = ZiweiCastingChart.fromInput(json.originalInput,
    { ...json.options, rules: { ...json.options.rules, ruleset: restoredRules } }, json.originalBureau)
    .modify({ ...json.modification.overrides, updateBureau: json.modification.updateBureau })
    .shiftLifePalace(json.modification.lifePalaceShift);
  assert.deepEqual(restored.toJSON(), chart.toJSON());
});

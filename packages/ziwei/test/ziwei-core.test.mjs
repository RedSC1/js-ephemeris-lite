import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUREAU,
  arrangeZiweiStars,
  getEffectiveBirthYear,
  getStartDecadeYear,
  makeDecadeForYear,
  bureauNumber,
  makeDecadeByIndex,
  makeFlowMonth,
  PALACE,
  STAR_TRANSFORM_MARK,
  ZIWEI_CLOCK_MODE,
  ZIWEI_GENDER,
  ZIWEI_RULE_OPTION,
  ZiweiChart,
  ZiweiCastingChart,
  ZiweiPlate,
  ZIWEI_CASTING_SPACE_SIZE,
  ZiweiConfigLoader,
  ZiweiOptions,
  compileZiweiJsonPlacement,
  computeZiweiAnchors,
  findStarId,
  selectZiweiRules,
} from '../dist/index.js';
import {
  CALENDAR_DAY_BOUNDARY_MODE,
  CALENDAR_MODE,
  ZonedTime,
  makeGanzhi,
} from 'js-ephemeris-lite';

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

test('runtime rulesets patch former Dart JSON profiles without mutating defaults', () => {
  const defaults = ZiweiConfigLoader.getDefault();
  const custom = ZiweiConfigLoader.overrideWith(defaults, {
    label: 'runtime-json-profile',
    starsJson: JSON.stringify([{ key: 'ziwei', rule: { type: 'constant', value: 0 } }]),
    brightnessJson: JSON.stringify({
      brightness_labels: { 6: '超亮' },
      static_stars: { ziwei: Array(12).fill(6) },
    }),
    sihuaJson: JSON.stringify({ jia: { lu: 'ziwei' } }),
  });
  const birth = new ZonedTime({
    year: 2004, month: 8, day: 1, hour: 12, minute: 0, second: 0, offsetMinutes: 480,
  });
  const baseChart = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, rules: { ruleset: defaults } }),
  );
  const chart = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, rules: { ruleset: custom } }),
  );
  const ziwei = findStarId('ziwei');
  assert.notEqual(baseChart.starPositions[ziwei], 0);
  assert.equal(chart.starPositions[ziwei], 0);
  assert.equal(chart.getStarPosition(ziwei).brightness, 6);
  assert.equal(chart.getBrightnessLabel(6), '超亮');
  assert.equal(chart.birthYearTransformations.lu, ziwei);
  assert.equal(chart.birthYearTransformations.quan, baseChart.birthYearTransformations.quan);
  assert.equal(selectZiweiRules(new ZiweiOptions({ gender: 0 }).rules).natalPlacements[ziwei].positions.length > 1, true);
});

test('legacy JSON rules preserve offsets, branch lookups, categories and empty brightness', () => {
  const branchLookup = compileZiweiJsonPlacement({
    type: 'lookup',
    anchor: 'ziwei',
    table: Object.fromEntries(
      ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai']
        .map((key, index) => [key, index]),
    ),
  });
  assert.deepEqual(branchLookup.positions, Array.from({ length: 12 }, (_, index) => index));

  const offsetLookup = compileZiweiJsonPlacement({
    type: 'lookup_offset',
    anchor: 'year_branch',
    shift_anchor: 'hour',
    offset: 5,
    table: Object.fromEntries(
      ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai']
        .map((key) => [key, 1]),
    ),
  });
  assert.equal(offsetLookup.positions[0], 6);
  assert.throws(
    () => compileZiweiJsonPlacement({ type: 'anchor_offset', anchor: 'ziwei', direction: 'shnu' }),
    /direction/,
  );

  const ruleset = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'legacy-cycle-star',
    starsJson: JSON.stringify([{
      key: 'legacy_cycle_star',
      type: 'boshi12',
      rule: { type: 'constant', value: 0 },
    }]),
    brightnessJson: JSON.stringify({ brightness_labels: ['陷', '不', '平', '利', '得', '旺', '庙'] }),
  });
  const chart = ZiweiChart.fromZonedTime(
    new ZonedTime({
      year: 2004, month: 8, day: 1, hour: 12, minute: 0, second: 0, offsetMinutes: 480,
    }),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, rules: { ruleset } }),
  );
  const id = chart.findStarId('legacy_cycle_star');
  assert.equal(chart.starCatalog[id].category, 'cycle');
  assert.equal(chart.getStarPosition(id).brightness, -1);
  assert.equal(chart.getBrightnessLabel(6), '庙');

  assert.throws(
    () => ZiweiConfigLoader.compileJson({
      label: 'malformed-brightness',
      brightnessJson: JSON.stringify({ static_stars: { ziwei: '6,6,6' } }),
    }),
    /brightness must be an array/,
  );
  const categoryOverride = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'catalog-category-override',
    starsJson: JSON.stringify([{
      key: 'ziwei',
      type: 'minor',
      rule: { type: 'constant', value: 0 },
    }]),
  });
  assert.throws(
    () => selectZiweiRules(new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { ruleset: categoryOverride },
    }).rules),
    /cannot change a catalog star category/,
  );
});

test('labelled compiled modules merge in explicit order and reject duplicate labels', () => {
  const birth = new ZonedTime({
    year: 2004, month: 8, day: 1, hour: 12, minute: 0, second: 0, offsetMinutes: 480,
  });
  const customInput = {
    label: 'fixed-ziwei',
    starsJson: JSON.stringify([{ key: 'ziwei', rule: { type: 'constant', value: 0 } }]),
  };
  const optionFirst = ZiweiConfigLoader.withOptions(ZiweiConfigLoader.getDefault(), {
    label: 'builtin-ziwei',
    placement: { ziwei: 'option1' },
  });
  const customLast = ZiweiConfigLoader.overrideWith(optionFirst, customInput);
  const customFirst = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), customInput);
  const optionLast = ZiweiConfigLoader.withOptions(customFirst, {
    label: 'builtin-ziwei',
    placement: { ziwei: 'option1' },
  });
  const chartFor = (ruleset) => ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, rules: { ruleset } }),
  );
  const ziwei = findStarId('ziwei');
  assert.equal(chartFor(customLast).starPositions[ziwei], 0);
  assert.notEqual(chartFor(optionLast).starPositions[ziwei], 0);
  assert.throws(() => ZiweiConfigLoader.overrideWith(customLast, customInput), /duplicate rule module label/);
  assert.throws(
    () => ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), { ...customInput, label: 'option2' }),
    /reserved by a built-in option/,
  );

  const gengOption = {
    label: 'geng-option4',
    sihua: { geng: 'option4' },
  };
  const gengJson = {
    label: 'geng-custom-ke',
    sihuaJson: JSON.stringify({ geng: { ke: 'tianfu' } }),
  };
  const optionThenJson = ZiweiConfigLoader.overrideWith(
    ZiweiConfigLoader.withOptions(ZiweiConfigLoader.getDefault(), gengOption),
    gengJson,
  );
  const jsonThenOption = ZiweiConfigLoader.withOptions(
    ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), gengJson),
    gengOption,
  );
  const selected = (ruleset) => selectZiweiRules(
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, rules: { ruleset } }).rules,
  ).sihua[6];
  assert.equal(selected(optionThenJson).ke, findStarId('tianfu'));
  assert.equal(selected(jsonThenOption).ke, findStarId('tiantong'));
  assert.deepEqual(
    [selected(optionThenJson).lu, selected(optionThenJson).quan, selected(optionThenJson).ji],
    [findStarId('taiyang'), findStarId('wuqu'), findStarId('tianxiang')],
  );
});

test('custom natal stars receive ruleset-local ids and participate in BigInt palace bitsets', () => {
  const ruleset = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'extra-stars',
    starsJson: JSON.stringify([{
      key: 'custom_star',
      type: 'minor',
      rule: { type: 'constant', value: 11 },
    }]),
    brightnessJson: JSON.stringify({ custom_star: Array(12).fill(6) }),
    sihuaJson: JSON.stringify({ jia: { lu: 'custom_star' } }),
  });
  const chart = ZiweiChart.fromZonedTime(
    new ZonedTime({
      year: 2004, month: 8, day: 1, hour: 12, minute: 0, second: 0, offsetMinutes: 480,
    }),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, rules: { ruleset } }),
  );
  const id = chart.findStarId('custom_star');
  assert.equal(id, 159);
  assert.equal(findStarId('custom_star'), undefined);
  assert.equal(chart.starCatalog[id].category, 'minor');
  assert.equal(chart.starPositions[id], 11);
  assert.equal(chart.getStarPosition(id).brightness, 6);
  assert.equal(chart.birthYearTransformations.lu, id);
  assert.ok((chart.palaces[11].starBitset & (1n << BigInt(id))) !== 0n);
  assert.ok(chart.palaces[11].starIds.includes(id));
});

test('numeric references cannot target ruleset-local stars whose ids may be reassigned', () => {
  const customStar = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'numeric-reference-star',
    starsJson: JSON.stringify([{
      key: 'numeric_reference_star',
      type: 'minor',
      rule: { type: 'constant', value: 0 },
    }]),
  });
  const unstableReference = ZiweiConfigLoader.overrideWith(customStar, {
    label: 'numeric-reference-user',
    sihuaJson: JSON.stringify({ jia: { lu: 159 } }),
  });
  assert.throws(
    () => selectZiweiRules(new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { ruleset: unstableReference },
    }).rules),
    /unstable numeric id.*use its star key/i,
  );

  const stableReference = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'numeric-reference-builtin',
    sihuaJson: JSON.stringify({ jia: { lu: 0 } }),
  });
  assert.equal(
    selectZiweiRules(new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { ruleset: stableReference },
    }).rules).sihua[0].lu,
    0,
  );
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
  assert.equal(original.eventAccuracy, 'mid');
  assert.equal(original.toCalendarOptions().eventAccuracy, 'mid');
  assert.equal(original.with({ eventAccuracy: 'accurate' }).eventAccuracy, 'accurate');
  assert.throws(
    () => new ZiweiOptions({ gender: ZIWEI_GENDER.FEMALE, eventAccuracy: 'unknown' }),
    /eventAccuracy/,
  );

  const meridian = new ZiweiOptions({
    gender: ZIWEI_GENDER.FEMALE,
    mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
    dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN,
    utcOffsetMinutes: 420,
    meridianDeg: 105,
  });
  assert.equal(
    meridian.toCalendarOptions().dayBoundaryMode,
    CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN,
  );
  assert.throws(
    () => new ZiweiOptions({ gender: ZIWEI_GENDER.FEMALE, meridianDeg: 105 }),
    /only valid/,
  );
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

test('Tian-Shang, Tian-Shi and master option2 conventions remain independent', () => {
  const birth = new ZonedTime({
    year: 2003, month: 3, day: 13, hour: 14, minute: 15, second: 0, offsetMinutes: 480,
  });
  const tianShang = findStarId('tianshang');
  const tianShi = findStarId('tianshi');
  const defaults = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
  );
  const tianShangOnly = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { placement: { tianshang: ZIWEI_RULE_OPTION.OPTION_2 } },
    }),
  );
  const tianShiOnly = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { placement: { tianshi: ZIWEI_RULE_OPTION.OPTION_2 } },
    }),
  );
  const mastersOnly = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { masters: ZIWEI_RULE_OPTION.OPTION_2 },
    }),
  );

  assert.equal(tianShangOnly.starPositions[tianShang], defaults.starPositions[tianShi]);
  assert.equal(tianShangOnly.starPositions[tianShi], defaults.starPositions[tianShi]);
  assert.equal(tianShiOnly.starPositions[tianShang], defaults.starPositions[tianShang]);
  assert.equal(tianShiOnly.starPositions[tianShi], defaults.starPositions[tianShang]);
  assert.equal(tianShangOnly.lifeMaster, defaults.lifeMaster);
  assert.equal(mastersOnly.starPositions[tianShang], defaults.starPositions[tianShang]);
  assert.equal(mastersOnly.starPositions[tianShi], defaults.starPositions[tianShi]);
  assert.equal(defaults.lifeMaster, 5);
  assert.equal(mastersOnly.lifeMaster, 3);
  assert.equal(mastersOnly.bodyMaster, defaults.bodyMaster);

  const yinFemale = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({
      gender: ZIWEI_GENDER.FEMALE,
      rules: {
        placement: {
          tianshang: ZIWEI_RULE_OPTION.OPTION_2,
          tianshi: ZIWEI_RULE_OPTION.OPTION_2,
        },
      },
    }),
  );
  assert.equal(yinFemale.starPositions[tianShang], defaults.starPositions[tianShang]);
  assert.equal(yinFemale.starPositions[tianShi], defaults.starPositions[tianShi]);
});

test('Four Transform variants are selected independently by heavenly stem', () => {
  const stemIndex = Object.freeze({ wu: 4, geng: 6, ren: 8, gui: 9 });
  const expected = [
    ['wu', 'option1', ['tanlang', 'taiyin', 'youbi', 'tianji']],
    ['wu', 'option2', ['tanlang', 'taiyin', 'taiyang', 'tianji']],
    ['geng', 'option1', ['taiyang', 'wuqu', 'taiyin', 'tiantong']],
    ['geng', 'option2', ['taiyang', 'wuqu', 'tiantong', 'taiyin']],
    ['geng', 'option3', ['taiyang', 'wuqu', 'tianfu', 'tiantong']],
    ['geng', 'option4', ['taiyang', 'wuqu', 'tiantong', 'tianxiang']],
    ['ren', 'option1', ['tianliang', 'ziwei', 'zuofu', 'wuqu']],
    ['ren', 'option2', ['tianliang', 'ziwei', 'tianfu', 'wuqu']],
    ['gui', 'option1', ['pojun', 'jumen', 'taiyin', 'tanlang']],
    ['gui', 'option2', ['pojun', 'jumen', 'taiyang', 'tanlang']],
  ];

  for (const [stem, option, keys] of expected) {
    const options = new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { sihua: { [stem]: option } },
    });
    const transforms = selectZiweiRules(options.rules).sihua[stemIndex[stem]];
    assert.deepEqual(
      [transforms.lu, transforms.quan, transforms.ke, transforms.ji],
      keys.map((key) => findStarId(key)),
      `${stem}.${option}`,
    );
  }

  const birth = new ZonedTime({
    year: 2003, month: 3, day: 13, hour: 14, minute: 15, second: 0, offsetMinutes: 480,
  });
  const chart = ZiweiChart.fromZonedTime(
    birth,
    new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      rules: { sihua: { gui: ZIWEI_RULE_OPTION.OPTION_2 } },
    }),
  );
  assert.equal(chart.birthYearTransformations.ke, findStarId('taiyang'));
});


function manualBase(options = {}) {
  return ZiweiChart.fromZonedTime(new ZonedTime({
    year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0, offsetMinutes: 480,
  }), { gender: ZIWEI_GENDER.MALE, ...options });
}

test('manual overrides preserve birth, palace frame and limit chronology while replacing placement', () => {
  const base = manualBase();
  const before = JSON.stringify(base);
  const unchanged = base.modify({});
  assert.deepEqual(unchanged.starPositions, base.starPositions);
  assert.deepEqual(unchanged.transformationMasks, base.transformationMasks);
  const changed = base.modify({ yearGanIndex: 9, yearZhiIndex: 7, month: 3, day: 30, hourZhiIndex: 2 });
  assert.deepEqual(changed.placementInput, {
    yearGanIndex: 9, yearZhiIndex: 7, month: 3, day: 30, hourZhiIndex: 2,
  });
  const raw = arrangeZiweiStars(changed.placementInput, base.options, base.anchors.bureau);
  for (const rule of selectZiweiRules(base.options.rules).natalPlacements) {
    if (!rule.inputs.some(source => source === 'anchor.life' || source === 'anchor.body')) {
      assert.equal(changed.starPositions[rule.starId], raw.starPositions[rule.starId]);
    }
  }
  const life = base.anchors.palacePositions[PALACE.LIFE];
  assert.equal(changed.starPositions[findStarId('tiancai')], (life + 7) % 12);
  for (const key of ['tianshang', 'tianshi']) {
    assert.equal(changed.starPositions[findStarId(key)], base.starPositions[findStarId(key)]);
  }
  assert.deepEqual(changed.birthYearTransformations, raw.yearTransformations);
  assert.notDeepEqual(changed.starPositions, base.starPositions);
  assert.notDeepEqual(changed.birthYearTransformations, base.birthYearTransformations);
  assert.equal(changed.anchors.bureau, base.anchors.bureau);
  assert.strictEqual(changed.facts, base.facts);
  assert.deepEqual(changed.toJSON().birth, base.toJSON().birth);
  assert.deepEqual(changed.anchors.palacePositions, base.anchors.palacePositions);
  assert.deepEqual(changed.palaceStems, base.palaceStems);
  assert.equal(changed.bodyPalace, base.bodyPalace);
  for (let index = 1; index <= 12; index++) {
    assert.deepEqual(makeDecadeByIndex(changed, getEffectiveBirthYear(changed), index),
      makeDecadeByIndex(base, getEffectiveBirthYear(base), index));
  }
  assert.deepEqual(makeFlowMonth(changed, 2026, 3), makeFlowMonth(base, 2026, 3));
  assert.equal(JSON.stringify(base), before);
  assert.equal(changed.resetModification(), base);
  assert.ok(Object.isFrozen(changed.modification.overrides));
});

test('bureau toggle reschedules limits while preserving the original birth year', () => {
  const base = manualBase();
  const first = base.modify({ yearGanIndex: 9, yearZhiIndex: 7, updateBureau: true });
  assert.notEqual(first.anchors.bureau, base.anchors.bureau);
  const second = first.modify({ day: 30 });
  assert.deepEqual(second.placementInput, { ...first.placementInput, day: 30 });
  assert.equal(second.modification.updateBureau, true);
  assert.equal(second.anchors.bureau, first.anchors.bureau);
  assert.equal(getEffectiveBirthYear(second), getEffectiveBirthYear(base));
  const age = bureauNumber(second.anchors.bureau);
  const firstLimit = makeDecadeByIndex(second, getEffectiveBirthYear(second), 1);
  assert.equal(firstLimit.startAge, age);
  assert.equal(firstLimit.endAge, age + 9);
  assert.equal(firstLimit.startYear, getEffectiveBirthYear(base) + age - 1);
  assert.notEqual(firstLimit.startYear, getStartDecadeYear(base));
  const retained = second.modify({ updateBureau: false });
  assert.equal(retained.anchors.bureau, base.anchors.bureau);
  assert.deepEqual(makeDecadeByIndex(retained, getEffectiveBirthYear(retained), 1),
    makeDecadeByIndex(base, getEffectiveBirthYear(base), 1));
  assert.deepEqual(retained.starPositions, arrangeZiweiStars(retained.placementInput,
    base.options, base.anchors.bureau).starPositions);
  assert.equal(second.resetModification(), base);
  assert.deepEqual(JSON.parse(JSON.stringify(second)).modification, second.modification);
});

test('moving palace roles leaves stars fixed and moves decade locations without changing dates', () => {
  const base = manualBase().modify({ yearGanIndex: 9, yearZhiIndex: 7, updateBureau: true });
  const shifted = base.shiftLifePalace(1);
  assert.deepEqual(shifted.starPositions, base.starPositions);
  assert.deepEqual(shifted.transformationMasks, base.transformationMasks);
  assert.equal(shifted.anchors.bureau, base.anchors.bureau);
  assert.equal(shifted.bodyPalace, base.bodyPalace);
  assert.deepEqual(shifted.anchors.palacePositions, base.anchors.palacePositions.map(x => (x + 1) % 12));
  for (let index = 1; index <= 12; index++) {
    const old = makeDecadeByIndex(base, getEffectiveBirthYear(base), index);
    const next = makeDecadeByIndex(shifted, getEffectiveBirthYear(shifted), index);
    for (const key of ['startAge', 'endAge', 'startYear', 'endYear']) assert.equal(next[key], old[key]);
    assert.equal(next.limit.coordinate.branch, (old.limit.coordinate.branch + 1) % 12);
  }
  assert.deepEqual(shifted.shiftLifePalace(-1).starPositions, base.starPositions);
  assert.deepEqual(shifted.shiftLifePalace(-1).anchors.palacePositions, base.anchors.palacePositions);
  const a = shifted.modify({ month: 5 });
  const b = base.modify({ month: 5 }).shiftLifePalace(1);
  assert.deepEqual(a.toJSON(), b.toJSON());
});

test('direct placement accepts independent year indices and reports undefined Ganzhi-dependent rules', () => {
  const base = manualBase();
  const input = { yearGanIndex: 0, yearZhiIndex: 1, month: 2, day: 30, hourZhiIndex: 11 };
  const raw = arrangeZiweiStars(input, base.options);
  assert.deepEqual(raw.omittedPlacements.map(x => raw.starCatalog[x.starId].key), ['xunkong', 'fuxun']);
  for (const omitted of raw.omittedPlacements) assert.equal(raw.starPositions[omitted.starId], -1);
  const modified = base.modify(input);
  assert.deepEqual(modified.omittedPlacements, raw.omittedPlacements);
  for (const omitted of modified.omittedPlacements) assert.equal(modified.getStarPosition(omitted.starId), null);
  assert.equal(modified.modify({ yearZhiIndex: 0 }).omittedPlacements.length, 0);
  for (const bad of [{ month: 0 }, { day: 31 }, { hourZhiIndex: 12 }, { yearGanIndex: NaN },
    { yearZhiIndex: 1.5 }, { updateBureau: 1 }, { year: 2003 }]) {
    assert.throws(() => base.modify(bad));
  }
  assert.throws(() => base.modify(null), TypeError);
  assert.throws(() => arrangeZiweiStars({ month: 3 }, base.options), /missing/);
  assert.throws(() => arrangeZiweiStars(input, base.options, 5), /bureau/);
  assert.throws(() => base.shiftLifePalace(Infinity), RangeError);
  assert.equal(base.modify({ month: undefined }).placementInput.month, base.placementInput.month);
});

test('manual recalculation preserves boundary-specific facts and supports custom placement tables', () => {
  const ruleset = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'manual-placement',
    starsJson: JSON.stringify([{ key: 'ziwei', rule: { type: 'constant', value: 0 } }]),
  });
  // Lunar and solar-term years differ between Chinese New Year and Li Chun.
  const chart = ZiweiChart.fromZonedTime(new ZonedTime({
    year: 2023, month: 1, day: 25, hour: 12, offsetMinutes: 480,
  }), { gender: 0, rules: { ruleset } });
  assert.notEqual(chart.facts.lunarPillars.year, chart.facts.solarTermPillars.year);
  assert.deepEqual(chart.modify({}).starPositions, chart.starPositions);
  assert.deepEqual(chart.modify({}).transformationMasks, chart.transformationMasks);
  const changed = chart.modify({ yearGanIndex: 9 });
  assert.equal(changed.starPositions[findStarId('ziwei')], 0);
  assert.deepEqual(changed.placementInput, { ...chart.placementInput, yearGanIndex: 9 });
  assert.equal(changed.facts.lunarPillars.day, chart.facts.lunarPillars.day);
  assert.equal(changed.facts.lunarPillars.hour, chart.facts.lunarPillars.hour);
});


test('modified charts keep flow dates unless a changed bureau reschedules the decade', () => {
  const target = new ZonedTime({ year: 2026, month: 8, day: 29, hour: 12, offsetMinutes: 480 });
  for (const gender of [0, 1]) {
    for (const boundary of [0, 1]) {
      for (const chartMode of [0, 1, 2]) {
        const base = manualBase({ gender, chartMode, flowLimitBoundary: boundary,
          wuHuDunYearBoundary: boundary, sihuaYearBoundary: boundary });
        assert.deepEqual(base.modify({}).starPositions, base.starPositions);
        const modified = base.modify({ yearGanIndex: 9, yearZhiIndex: 7, month: 6,
          day: 30, hourZhiIndex: 0, updateBureau: false });
        assert.deepEqual(modified.resolveFlow(target), base.resolveFlow(target));
        const rebased = modified.modify({ updateBureau: true });
        const { decade, ...otherLayers } = rebased.resolveFlow(target);
        const { decade: originalDecade, ...originalLayers } = base.resolveFlow(target);
        assert.deepEqual(otherLayers, originalLayers);
        assert.equal(decade.startAge, bureauNumber(rebased.anchors.bureau) + (decade.index - 1) * 10);
        assert.deepEqual(modified.timeline().getMonths(2026), base.timeline().getMonths(2026));
        const dynamic = modified.dynamicForTime(target);
        assert.strictEqual(dynamic.natal, modified);
        assert.equal(dynamic.flowStack.length, 5);
      }
    }
  }
});


test('all five modified bureaus update childhood and decade boundaries in both directions', () => {
  for (const gender of [0, 1]) {
    const base = manualBase({ gender });
    const seen = new Set();
    for (const yearGanIndex of [1, 3, 5, 7, 9]) {
      const chart = base.modify({ yearGanIndex, yearZhiIndex: 7, updateBureau: true });
      seen.add(chart.anchors.bureau);
      const birthYear = getEffectiveBirthYear(base);
      const age = bureauNumber(chart.anchors.bureau);
      const start = birthYear + age - 1;
      assert.equal(getStartDecadeYear(chart), start);
      assert.equal(makeDecadeForYear(chart, birthYear, start - 1).isChildhood, true);
      const first = makeDecadeForYear(chart, birthYear, start);
      assert.equal(first.isChildhood, false);
      assert.equal(first.index, 1);
      assert.equal(first.startAge, age);
      assert.equal(first.endAge, age + 9);
      assert.equal(first.endYear, start + 9);
      assert.equal(makeDecadeForYear(chart, birthYear, start + 9).index, 1);
      assert.equal(makeDecadeForYear(chart, birthYear, start + 10).index, 2);
      const shifted = chart.shiftLifePalace(1);
      assert.equal(getStartDecadeYear(shifted), start);
      assert.equal(makeDecadeForYear(shifted, birthYear, start).limit.coordinate.branch,
        (first.limit.coordinate.branch + 1) % 12);
    }
    assert.equal(seen.size, 5);
  }
});


test('reset restores the original chart after accumulated placement and palace edits', () => {
  const base = manualBase();
  const before = JSON.stringify(base);
  assert.strictEqual(base.reset(), base);
  const changed = base.modify({ yearGanIndex: 9, yearZhiIndex: 7, updateBureau: true })
    .modify({ month: 3, day: 30 }).shiftLifePalace(2);
  const changedSnapshot = JSON.stringify(changed);
  const restored = changed.reset();
  assert.strictEqual(restored, base);
  assert.strictEqual(changed.resetModification(), restored);
  assert.equal(JSON.stringify(restored), before);
  assert.equal(restored.modification, null);
  assert.deepEqual(restored.placementInput, base.placementInput);
  assert.equal(getStartDecadeYear(restored), getStartDecadeYear(base));
  assert.equal(JSON.stringify(changed), changedSnapshot);
  assert.deepEqual(restored.modify({ day: 1 }).toJSON(), base.modify({ day: 1 }).toJSON());
});


test('casting plates assemble independent inputs without inheriting a fictitious birth or timeline', () => {
  const input = { yearGanIndex: 9, yearZhiIndex: 7, month: 2, day: 30, hourZhiIndex: 6 };
  const chart = ZiweiCastingChart.fromInput(input, { gender: 0 });
  assert.ok(chart instanceof ZiweiPlate);
  assert.equal(chart instanceof ZiweiChart, false);
  const raw = arrangeZiweiStars(input, chart.options);
  assert.deepEqual(chart.starPositions, raw.starPositions);
  assert.deepEqual(chart.yearTransformations, raw.yearTransformations);
  assert.equal(chart.anchors.bureau, raw.bureau);
  assert.equal(chart.getPalace(PALACE.LIFE).branch, raw.palacePositions[0]);
  assert.deepEqual(chart.getStarsInPalace(PALACE.LIFE), chart.getStarsAtBranch(raw.palacePositions[0]));
  assert.ok(chart.hasTransform(chart.yearTransformations.lu, STAR_TRANSFORM_MARK.BIRTH_YEAR_LU));
  for (const key of ['facts', 'birthClockTime', 'lunarInput', 'timeline', 'resolveFlow', 'dynamicForTime', 'createLimitManager']) {
    assert.equal(key in chart, false, key);
  }
  assert.ok(Object.isFrozen(chart));
  input.month = 10;
  assert.equal(chart.placementInput.month, 2);
  const independent = ZiweiCastingChart.fromInput({ ...input, yearGanIndex: 0, yearZhiIndex: 1 }, chart.options);
  assert.equal(independent.omittedPlacements.length, 2);
  for (const omitted of independent.omittedPlacements) {
    assert.equal(independent.getStarPosition(omitted.starId), null);
    assert.equal(independent.palaces.some(p => p.starIds.includes(omitted.starId)), false);
  }
});

test('casting modifications preserve the frame, support bureau changes, and reset the entire edit chain', () => {
  const chart = ZiweiCastingChart.fromInput({ yearGanIndex: 0, yearZhiIndex: 0, month: 1, day: 1, hourZhiIndex: 0 }, { gender: 0 });
  const original = JSON.stringify(chart);
  assert.deepEqual(chart.modify({}).starPositions, chart.starPositions);
  const retained = chart.modify({ yearGanIndex: 3, yearZhiIndex: 3, month: 8, day: 30 });
  assert.equal(retained.anchors.bureau, chart.anchors.bureau);
  const updated = retained.modify({ updateBureau: true });
  assert.equal(updated.anchors.bureau, arrangeZiweiStars(updated.placementInput, updated.options).bureau);
  assert.notEqual(updated.anchors.bureau, chart.anchors.bureau);
  assert.deepEqual(updated.anchors.palacePositions, chart.anchors.palacePositions);
  assert.deepEqual(updated.palaceStems, chart.palaceStems);
  assert.equal(updated.bodyPalace, chart.bodyPalace);
  const shifted = updated.shiftLifePalace(-1);
  assert.deepEqual(shifted.starPositions, updated.starPositions);
  assert.deepEqual(shifted.transformationMasks, updated.transformationMasks);
  assert.deepEqual(shifted.anchors.palacePositions, updated.anchors.palacePositions.map(x => (x + 11) % 12));
  assert.deepEqual(shifted.modify({ day: 3 }).toJSON(), updated.modify({ day: 3 }).shiftLifePalace(-1).toJSON());
  assert.strictEqual(shifted.reset(), chart);
  assert.strictEqual(shifted.resetModification(), chart);
  assert.equal(JSON.stringify(chart), original);
  assert.equal(shifted.modify({ updateBureau: false }).anchors.bureau, chart.anchors.bureau);
  assert.throws(() => chart.modify({ updateBureau: 'yes' }), TypeError);
  assert.throws(() => chart.modify({ month: 13 }), RangeError);
  assert.throws(() => chart.shiftLifePalace(0.5), RangeError);
});

test('casting index decoding crosses every radix boundary and spans all sixty year pairs', () => {
  const opts = { gender: 0 };
  assert.deepEqual(ZiweiCastingChart.fromIndex(0, opts).placementInput,
    { yearGanIndex: 0, yearZhiIndex: 0, month: 1, day: 1, hourZhiIndex: 0 });
  assert.deepEqual(ZiweiCastingChart.fromIndex(259199, opts).placementInput,
    { yearGanIndex: 9, yearZhiIndex: 11, month: 12, day: 30, hourZhiIndex: 11 });
  for (let year = 0; year < 60; year++) {
    for (const local of [0, 11, 12, 359, 360, 4319]) {
      const index = year * 4320 + local;
      const chart = ZiweiCastingChart.fromIndex(index, opts);
      const input = chart.placementInput;
      assert.equal(input.yearGanIndex, year % 10);
      assert.equal(input.yearZhiIndex, year % 12);
      assert.equal(input.month, Math.floor(local / 360) + 1);
      assert.equal(input.day, Math.floor(local % 360 / 12) + 1);
      assert.equal(input.hourZhiIndex, local % 12);
      assert.equal(chart.casting.index, index);
    }
  }
  for (const bad of [-1, 259200, Infinity, NaN, 0.5]) assert.throws(() => ZiweiCastingChart.fromIndex(bad, opts), RangeError);
});

test('reported numbers use a stable versioned mapping rather than directly treating small numbers as year-zero indices', () => {
  const opts = { gender: 1 };
  for (const [number, expected] of [[0, 101426], [1, 143127], [2, 87285], [3, 63092], [123456, 209225],
    ['123456789012345678901234567890', 201997]]) {
    const chart = ZiweiCastingChart.fromNumber(number, opts);
    assert.equal(chart.casting.index, expected);
    assert.equal(chart.casting.algorithm, 'number-v1');
    assert.deepEqual(chart.starPositions, ZiweiCastingChart.fromIndex(expected, opts).starPositions);
    assert.deepEqual(chart.toJSON(), ZiweiCastingChart.fromNumber(BigInt(number), opts).toJSON());
  }
  assert.deepEqual(ZiweiCastingChart.fromNumber('000123456', opts).toJSON(),
    ZiweiCastingChart.fromNumber(123456, opts).toJSON());
  for (const bad of [-1, -1n, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '', '1e3', '12.5', 'abc', null]) {
    assert.throws(() => ZiweiCastingChart.fromNumber(bad, opts));
  }
});

test('random casting rejects modulo-biased tail values and reports a replayable index', () => {
  const opts = { gender: 0 };
  const size = ZIWEI_CASTING_SPACE_SIZE;
  const limit = Math.floor(0x100000000 / size) * size;
  const sequence = [limit, 0xffffffff, 259199];
  let draws = 0;
  const chart = ZiweiCastingChart.random(opts, () => sequence[draws++]);
  assert.equal(draws, 3);
  assert.equal(chart.casting.method, 'random');
  assert.equal(chart.casting.index, 259199);
  assert.deepEqual(chart.starPositions, ZiweiCastingChart.fromIndex(chart.casting.index, opts).starPositions);
  assert.strictEqual(chart.modify({ day: 1 }).reset(), chart);
  assert.equal(ZiweiCastingChart.random(opts, () => 0).casting.index, 0);
  assert.equal(ZiweiCastingChart.random(opts, () => limit - 1).casting.index, size - 1);
  for (const bad of [-1, 0x100000000, NaN, 0.5]) assert.throws(() => ZiweiCastingChart.random(opts, () => bad), RangeError);
  assert.throws(() => ZiweiCastingChart.random(opts, () => 0xffffffff), /repeatedly/);
  assert.throws(() => ZiweiCastingChart.random(opts, null), TypeError);
});

test('random casting uses Web Crypto by default and requires an explicit source when unavailable', () => {
  const opts = { gender: 0 };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  if (globalThis.crypto?.getRandomValues) {
    const chart = ZiweiCastingChart.random(opts);
    assert.ok(chart.casting.index >= 0 && chart.casting.index < ZIWEI_CASTING_SPACE_SIZE);
  }
  try {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    assert.throws(() => ZiweiCastingChart.random(opts), /Web Crypto/);
    assert.equal(ZiweiCastingChart.random(opts, () => 0).casting.index, 0);
    assert.equal(ZiweiCastingChart.fromNumber(1, opts).casting.index, 143127);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});

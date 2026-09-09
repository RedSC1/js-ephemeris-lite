import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  getNextJie, getPreviousJie, julianDay, calendarDateFromJulianDay, MONTH_NAME, RAT_HOUR_MODE, ZonedTime, makeGanzhi,
} from 'js-ephemeris-lite';
import {
  solarDayFromPreviousJie, resolveEffectiveLunarMonth, resolveZiweiVirtualTime, ZIWEI_CLOCK_MODE,
  compileZiweiJsonPlacement, ZiweiRuleModule, ZiweiRuleset,
  PILLAR_BOUNDARY,
  FLOW_LEVEL,
  arrangeZiweiStars,
  FLOW_MONTH_PALACE_STRATEGY,
  LEAP_MONTH_STRATEGY,
  RAT_HOUR_SEGMENT,
  ZIWEI_GENDER,
  ZiweiChart,
  ZiweiCastingChart,
  ZiweiConfigLoader,
  ZiweiLimitManager,
  ZiweiOptions,
  ZiweiTimelineProvider,
  dynamicChartForTime,
  findStarId,
  getEffectiveBirthYear,
  resolveZiweiFlow,
  makeFlowMonthFromBuildingBranch,
  makeFlowMonth,
  makeFlowLayer,
  computeZiweiAnchors,
  reverseLookupZiweiTier1,
} from '../dist/index.js';

test('C++ natal and flow fixtures cover five levels, all 120 coordinates and both genders', () => {
  const { rows } = JSON.parse(readFileSync(process.env.TAIYIN_ZIWEI_ORACLE_JSON
    ?? new URL('./fixtures/flows-cpp.json', import.meta.url)));
  assert.equal(rows.length, 1200);
  for (const [i, row] of rows.entries()) {
    const [y, m, d, h, gender, level, stem, branch] = row.input;
    const pillars = {
      year: makeGanzhi(y % 10, y % 12), month: makeGanzhi(((y % 10 % 5) * 2 + 2 + m - 1) % 10, (m + 1) % 12),
      day: makeGanzhi((d - 1) % 10, (d - 1) % 12), hour: makeGanzhi(((d - 1) % 10 % 5 * 2 + h) % 10, h),
    };
    const facts = {
      jdUT1: 0, virtualTime: { year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, gender,
      lunarDate: { year: 1984 + y, month: m, day: d, isLeap: false, monthName: 0 },
      effectiveLunarYear: 1984 + y, effectiveLunarMonth: m, solarDayFromPreviousJie: d,
      solarTermPillars: pillars, lunarPillars: pillars,
    };
    const options = new ZiweiOptions({ gender });
    const chart = ZiweiChart.fromResolvedBirth({ facts, ...computeZiweiAnchors(facts, options), options });
    const direct = arrangeZiweiStars({
      yearGanIndex: y % 10, yearZhiIndex: y % 12, month: m, day: d, hourZhiIndex: h,
    }, options);
    assert.deepEqual(direct.starPositions, chart.starPositions, `direct placement / C++ row ${i}`);
    assert.deepEqual(direct.yearTransformations, chart.birthYearTransformations);
    const casting = ZiweiCastingChart.fromInput(direct.input, options);
    assert.deepEqual(casting.starPositions, chart.starPositions);
    assert.deepEqual(casting.transformationMasks, chart.transformationMasks);
    assert.deepEqual(casting.palaces, chart.palaces);
    assert.equal(casting.lifeMaster, chart.lifeMaster);
    assert.equal(casting.bodyMaster, chart.bodyMaster);
    const flow = makeFlowLayer(chart, level, { stem, branch });
    const positions = a => a.map(p => p < 0 ? 255 : p);
    assert.deepEqual([
      chart.anchors.palacePositions[0], chart.bodyPalace, chart.anchors.bureau, positions(chart.starPositions),
      chart.transformationMasks, positions(flow.starPositions), Object.values(flow.transforms),
    ], row.expected, `C++ natal/flow pair ${i}`);
  }
});

function zoned(year, month, day, hour = 12, minute = 0) {
  return new ZonedTime({ year, month, day, hour, minute, second: 0, offsetMinutes: 480 });
}

function ancientChart(options = {}) {
  return ZiweiChart.fromZonedTime(
    zoned(-200, 6, 1, 8),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, ...options }),
  );
}

test('calendar-backed flow keeps written month, sequence and physical month-building separate', () => {
  const chart = ancientChart();
  const leapEleven = resolveZiweiFlow(chart, zoned(2033, 12, 22));
  assert.deepEqual(
    [
      leapEleven.effectiveTargetYear,
      leapEleven.targetMonth,
      leapEleven.targetMonthSequence,
      leapEleven.targetMonthIsLeap,
      leapEleven.targetMonthBuildingBranch,
    ],
    [2033, 11, 12, true, 0],
  );
  // Split leap months expose two timeline nodes: days 1..15 inherit the
  // previous effective month, while day 16 onward inherits the next one.
  const months = new ZiweiTimelineProvider(chart).getMonths(2033);
  assert.deepEqual(months.slice(10).map((month) => [
    month.month,
    month.sequence,
    month.isLeap,
    month.monthBuildingBranch,
    month.stem,
    month.branch,
    month.displayBranch,
  ]), [
    [11, 11, false, 0, 0, 0, 0],
    [11, 12, true, 0, 0, 1, 0],
    [11, 12, true, 0, 1, 1, 1],
    [12, 13, false, 1, 1, 2, 1],
  ]);

  const normalEleven = months.find((month) => month.month === 11 && !month.isLeap);
  const leapElevenNodes = months.filter((month) => month.month === 11 && month.isLeap);
  assert.ok(normalEleven);
  assert.equal(leapElevenNodes.length, 2);
  assert.deepEqual(leapElevenNodes.map((month) => [month.effectiveYear, month.effectiveMonth, month.dayStart, month.dayEnd]), [
    [2033, 11, 1, 15],
    [2033, 12, 16, leapElevenNodes[1].dayEnd],
  ]);
  assert.equal(leapElevenNodes[0].stem, normalEleven.stem);
  assert.notEqual(leapElevenNodes[0].branch, normalEleven.branch);
  assert.equal(leapElevenNodes[0].branch, leapElevenNodes[1].branch);
  assert.equal(leapElevenNodes[0].displayBranch, normalEleven.displayBranch);
  assert.notEqual(leapElevenNodes[1].stem, leapElevenNodes[0].stem);
  assert.notEqual(leapElevenNodes[1].displayBranch, leapElevenNodes[0].displayBranch);

  const months2023 = new ZiweiTimelineProvider(chart).getMonths(2023);
  const normalTwo = months2023.find((month) => month.month === 2 && !month.isLeap);
  const leapTwos = months2023.filter((month) => month.month === 2 && month.isLeap);
  assert.ok(normalTwo);
  assert.equal(leapTwos.length, 2);
  assert.deepEqual(
    leapTwos.map((month) => [
      month.effectiveYear,
      month.effectiveMonth,
      month.stem,
      month.branch,
      month.displayBranch,
      month.dayStart,
      month.dayEnd,
    ]),
    [[2023, 2, 1, 6, 3, 1, 15], [2023, 3, 2, 6, 4, 16, 29]],
  );
  const earlyDays = new ZiweiTimelineProvider(chart).getDays(2023, 2, true, 2);
  const lateDays = new ZiweiTimelineProvider(chart).getDays(2023, 2, true, 3);
  assert.deepEqual([earlyDays[0].day, earlyDays.at(-1).day], [1, 15]);
  assert.deepEqual([lateDays[0].day, lateDays.at(-1).day], [16, 29]);

  const earlyLeap = makeFlowMonthFromBuildingBranch(chart, 2033, 11, 12, true, 0, 1);
  const lateLeap = makeFlowMonthFromBuildingBranch(chart, 2033, 11, 12, true, 0, 16);
  assert.equal(earlyLeap.effectiveMonth, 11);
  assert.equal(lateLeap.effectiveMonth, 12);
  assert.equal(earlyLeap.palaceMonthIndex, 12);
  assert.equal(lateLeap.palaceMonthIndex, 12);
  assert.equal(earlyLeap.limit.coordinate.branch, lateLeap.limit.coordinate.branch);
  assert.notEqual(earlyLeap.limit.coordinate.stem, lateLeap.limit.coordinate.stem);

  // Month 12 assigned to its next month must carry the next year too. Its
  // palace, stem, transformations and flow stars therefore share the exact
  // month coordinate of the following year's first month.
  const lateLeapTwelve = makeFlowMonthFromBuildingBranch(chart, 2033, 12, 13, true, 1, 16);
  const nextYearOne = makeFlowMonthFromBuildingBranch(chart, 2034, 1, 1, false, 2);
  assert.deepEqual(
    [lateLeapTwelve.effectiveYear, lateLeapTwelve.effectiveMonth],
    [2034, 1],
  );
  assert.deepEqual(lateLeapTwelve.limit.coordinate, nextYearOne.limit.coordinate);

  const nextMonthChart = ZiweiChart.fromZonedTime(
    zoned(-200, 6, 1, 8),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, leapMonthStrategy: LEAP_MONTH_STRATEGY.AS_NEXT }),
  );
  const nextLeap = makeFlowMonthFromBuildingBranch(nextMonthChart, 2033, 11, 12, true, 0);
  assert.equal(nextLeap.effectiveMonth, 12);

  const effectivePalaceChart = ancientChart({
    flowMonthPalaceStrategy: FLOW_MONTH_PALACE_STRATEGY.EFFECTIVE_MONTH,
  });
  const effectiveEarly = makeFlowMonthFromBuildingBranch(
    effectivePalaceChart, 2033, 11, 12, true, 0, 1,
  );
  const effectiveLate = makeFlowMonthFromBuildingBranch(
    effectivePalaceChart, 2033, 11, 12, true, 0, 16,
  );
  assert.deepEqual(
    [effectiveEarly.palaceMonthIndex, effectiveLate.palaceMonthIndex],
    [11, 12],
  );
  assert.notEqual(effectiveEarly.limit.coordinate.branch, effectiveLate.limit.coordinate.branch);

  // The sequence-based constructor does not apply lunar month strategies;
  // isLeap records a label without changing the supplied sequence.
  const sequenceThirteenNormal = makeFlowMonth(effectivePalaceChart, 2025, 12, 13, false);
  const sequenceThirteenLeap = makeFlowMonth(effectivePalaceChart, 2025, 12, 13, true);
  assert.equal(sequenceThirteenLeap.palaceMonthIndex, 13);
  assert.equal(
    sequenceThirteenLeap.limit.coordinate.branch,
    (sequenceThirteenLeap.doujun + 12) % 12,
  );
  assert.deepEqual(
    [sequenceThirteenNormal.limit.coordinate.stem, sequenceThirteenLeap.limit.coordinate.stem],
    [6, 6],
  );
});

test('MonthNode separates displayed month Ganzhi from the actual flow-month palace', () => {
  const chart = ZiweiChart.fromZonedTime(
    zoned(2003, 3, 13, 14),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
  );
  const january = new ZiweiTimelineProvider(chart).getMonths(2026)
    .find((month) => month.displayLabel === '正月');
  assert.ok(january);
  assert.deepEqual(
    [january.branch, january.displayBranch],
    [0, 2],
  );
});

test('lunar flow age starts from effective historical birth year', () => {
  const chart = ancientChart();
  assert.deepEqual(
    [chart.facts.lunarDate.year, chart.facts.lunarDate.historicalYear, chart.facts.effectiveLunarYear],
    [-201, -200, -200],
  );
  assert.equal(getEffectiveBirthYear(chart), -200);

  // A historical Thirteen Month is normalized as the twelfth logical month;
  // AS_NEXT therefore carries both the effective month and year across the
  // year boundary. Flow age must start from that carried year as well.
  const carriedBirth = ZiweiChart.fromZonedTime(
    zoned(-717, 11, 23, 8),
    new ZiweiOptions({
      gender: ZIWEI_GENDER.MALE,
      leapMonthStrategy: LEAP_MONTH_STRATEGY.AS_NEXT,
    }),
  );
  assert.deepEqual(
    [
      carriedBirth.facts.lunarDate.month,
      carriedBirth.facts.lunarDate.isLeap,
      carriedBirth.facts.effectiveLunarYear,
      getEffectiveBirthYear(carriedBirth),
    ],
    [13, true, -716, -716],
  );
});

test('historical repeated month names split without losing their label or cross-year period', () => {
  const timeline = new ZiweiTimelineProvider(ancientChart());

  const laterNines = timeline.getMonths(-217).filter((month) => month.displayLabel === '后九月'
    && month.lunarYear === -218);
  const carriedLaterNines = timeline.getMonths(-216).filter((month) => month.displayLabel === '后九月'
    && month.lunarYear === -218);
  assert.equal(laterNines.length, 1);
  assert.equal(carriedLaterNines.length, 1);
  assert.deepEqual(
    [...laterNines, ...carriedLaterNines].map((month) => [
      month.lunarYear,
      month.effectiveYear,
      month.effectiveMonth,
      month.dayStart,
      month.dayEnd,
    ]),
    [[-218, -217, 9, 1, 15], [-218, -216, 10, 16, 29]],
  );

  const thirteens = timeline.getMonths(-717).filter((month) => month.displayLabel === '十三月');
  const carriedThirteens = timeline.getMonths(-716).filter((month) => month.displayLabel === '十三月');
  assert.equal(thirteens.length, 1);
  assert.equal(carriedThirteens.length, 1);
  assert.deepEqual(
    [...thirteens, ...carriedThirteens].map((month) => [
      month.lunarYear,
      month.effectiveYear,
      month.effectiveMonth,
      month.dayStart,
      month.dayEnd,
    ]),
    [[-717, -717, 12, 1, 15], [-717, -716, 1, 16, 29]],
  );
  const earlyDays = timeline.getDays(-717, 12, true, 12, -717);
  const lateDays = timeline.getDays(-716, 12, true, 1, -716);
  assert.deepEqual([earlyDays[0].day, earlyDays.at(-1).day], [1, 15]);
  assert.deepEqual([lateDays[0].day, lateDays.at(-1).day], [16, 29]);

  const previousTimeline = new ZiweiTimelineProvider(ancientChart({
    leapMonthStrategy: LEAP_MONTH_STRATEGY.AS_PREVIOUS,
  }));
  const previousThirteen = previousTimeline.getMonths(-717)
    .filter((month) => month.displayLabel === '十三月');
  assert.deepEqual(
    previousThirteen.map((month) => [month.effectiveYear, month.effectiveMonth, month.dayStart, month.dayEnd]),
    [[-717, 12, 1, 29]],
  );

  const nextTimeline = new ZiweiTimelineProvider(ancientChart({
    leapMonthStrategy: LEAP_MONTH_STRATEGY.AS_NEXT,
  }));
  const nextThirteen = nextTimeline.getMonths(-717)
    .filter((month) => month.displayLabel === '十三月');
  const carriedNextThirteen = nextTimeline.getMonths(-716)
    .filter((month) => month.displayLabel === '十三月');
  assert.deepEqual(
    nextThirteen.map((month) => [month.effectiveYear, month.effectiveMonth, month.dayStart, month.dayEnd]),
    [],
  );
  assert.deepEqual(
    carriedNextThirteen.map((month) => [month.effectiveYear, month.effectiveMonth, month.dayStart, month.dayEnd]),
    [[-716, 1, 1, 29]],
  );
});

test('a carried later-nine segment rebuilds year, small limit and decade at the boundary', () => {
  const chart = ZiweiChart.fromZonedTime(
    zoned(-300, 6, 1, 8),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
  );
  const manager = new ZiweiLimitManager(chart);
  const timeline = manager.timeline;
  const early = timeline.getMonths(-217).find((month) => month.displayLabel === '后九月'
    && month.lunarYear === -218);
  const late = timeline.getMonths(-216).find((month) => month.displayLabel === '后九月'
    && month.lunarYear === -218);
  assert.ok(early);
  assert.ok(late);

  manager.setYear(-217);
  manager.selectMonth(early);
  const earlyState = {
    year: manager.context.year.year,
    decade: manager.context.decade.index,
    smallLimit: manager.context.smallLimit.coordinate.branch,
    yearStem: manager.context.year.limit.coordinate.stem,
  };

  manager.setYear(-216);
  manager.selectMonth(late);
  const lateState = {
    year: manager.context.year.year,
    decade: manager.context.decade.index,
    smallLimit: manager.context.smallLimit.coordinate.branch,
    yearStem: manager.context.year.limit.coordinate.stem,
  };
  assert.deepEqual([earlyState.year, earlyState.decade], [-217, 8]);
  assert.deepEqual([lateState.year, lateState.decade], [-216, 9]);
  assert.notEqual(lateState.smallLimit, earlyState.smallLimit);
  assert.notEqual(lateState.yearStem, earlyState.yearStem);
  assert.deepEqual(
    [manager.context.month.year, manager.context.month.effectiveYear, manager.context.month.effectiveMonth],
    [-218, -216, 10],
  );
});

test('Taichu reform months share one Ding-Chou flow year without changing the calendar engine', () => {
  const chart = ancientChart();
  const timeline = new ZiweiTimelineProvider(chart);
  const reformMonths = timeline.getMonths(-103)
    .filter((month) => month.lunarYear === -104 || month.lunarYear === -103);

  assert.equal(reformMonths.length, 15);
  assert.deepEqual(
    reformMonths.map((month) => [month.displayLabel, month.lunarYear]),
    [
      ['十月', -104], ['冬月', -104], ['腊月', -104],
      ['正月', -103], ['二月', -103], ['三月', -103], ['四月', -103],
      ['五月', -103], ['六月', -103], ['七月', -103], ['八月', -103],
      ['九月', -103], ['十月', -103], ['冬月', -103], ['腊月', -103],
    ],
  );
  assert.ok(reformMonths.every((month) => month.effectiveYear === -103));

  // The previous historical year is still present as a full timeline row;
  // only its source labels differ because the old calendar began at month 10.
  assert.ok(timeline.getMonths(-104).length >= 12);

  const manager = new ZiweiLimitManager(chart);
  const oldCalendarMonth = reformMonths.find((month) => month.lunarYear === -104);
  const reformedCalendarMonth = reformMonths.find((month) => month.lunarYear === -103);
  assert.ok(oldCalendarMonth);
  assert.ok(reformedCalendarMonth);
  manager.setYear(-103);
  manager.selectMonth(oldCalendarMonth);
  const oldAnnualLayer = manager.dynamicChart.flowStack[FLOW_LEVEL.YEAR];
  manager.selectMonth(reformedCalendarMonth);
  const newAnnualLayer = manager.dynamicChart.flowStack[FLOW_LEVEL.YEAR];
  assert.equal(manager.context.year.year, -103);
  assert.deepEqual(manager.context.year.limit.coordinate, { stem: 3, branch: 1 });
  assert.deepEqual(newAnnualLayer, oldAnnualLayer);
});

test('all supported calendar reforms keep month rows inside one historical annual layer', () => {
  const chart = ZiweiChart.fromZonedTime(
    zoned(-700, 6, 1, 8),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
  );
  const manager = new ZiweiLimitManager(chart);
  const cases = [
    // Qin calendar begins at month 10: the duplicated source label at the
    // switchover must become two real historical years, not one 24-month row.
    [-221, 11],
    [-220, 13],
    // Wang Mang, Jingchu, Wu-Zhou and Tang restoration naming reforms.
    [23, 13],
    [237, 11],
    [239, 13],
    [690, 12],
    [700, 16],
    [761, 10],
    [762, 14],
  ];

  for (const [year, expectedCardCount] of cases) {
    const months = manager.timeline.getMonths(year);
    assert.equal(months.length, expectedCardCount, `${year} month-card count`);
    assert.ok(months.every((month) => month.effectiveYear === year), `${year} effective year`);
    assert.ok(months.every((month) => month.sequence >= 1 && month.sequence <= 15), `${year} sequence`);

    manager.setYear(year);
    manager.selectMonth(months[0]);
    const firstAnnualLayer = manager.dynamicChart.flowStack[FLOW_LEVEL.YEAR];
    manager.selectMonth(months.at(-1));
    assert.equal(manager.context.year.year, year);
    assert.deepEqual(manager.dynamicChart.flowStack[FLOW_LEVEL.YEAR], firstAnnualLayer, `${year} annual layer`);
  }

  assert.equal(
    manager.timeline.getMonths(690).find((month) => month.monthName === MONTH_NAME.ALT_ONE)?.displayLabel,
    '一月',
  );
  assert.equal(
    manager.timeline.getMonths(700).find((month) => month.monthName === MONTH_NAME.LATER_SAME_NAME)?.displayLabel,
    '十二月',
  );
  assert.equal(
    manager.timeline.getMonths(762).find((month) => month.monthName === MONTH_NAME.LATER_SAME_NAME)?.displayLabel,
    '五月',
  );
});

test('runtime flow JSON patches placement and brightness together', () => {
  const ruleset = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'runtime-flow-profile',
    flowJson: JSON.stringify([{
      key: 'flow_lucun',
      rule: { type: 'constant', value: 4 },
      brightness: Array(12).fill(6),
    }]),
  });
  const chart = ZiweiChart.fromZonedTime(
    zoned(2003, 3, 13, 14),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, rules: { ruleset } }),
  );
  const dynamic = dynamicChartForTime(chart, zoned(2033, 12, 22)).chart;
  const lucun = dynamic.getFlowStar(findStarId('flow_lucun'));
  assert.equal(lucun.branch, 4);
  assert.equal(lucun.brightness, 6);
});

test('custom flow stars use ruleset-local ids in every dynamic layer', () => {
  const ruleset = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label: 'extra-flow-stars',
    flowJson: JSON.stringify([{
      key: 'flow_custom_star',
      type: 'other',
      rule: { type: 'constant', value: 7 },
      brightness: Array(12).fill(5),
    }]),
  });
  const chart = ZiweiChart.fromZonedTime(
    zoned(2003, 3, 13, 14),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, rules: { ruleset } }),
  );
  const dynamic = dynamicChartForTime(chart, zoned(2033, 12, 22)).chart;
  const id = chart.findStarId('flow_custom_star');
  const star = dynamic.getFlowStar(id);
  assert.equal(id, 159);
  assert.equal(star.key, 'flow_custom_star');
  assert.equal(star.branch, 7);
  assert.equal(star.brightness, 5);
  assert.ok((dynamic.flowStack.at(-1).starBitsets[7] & (1n << BigInt(id))) !== 0n);
});

test('historical month names do not replace winter-solstice-anchored month building', () => {
  const chart = ancientChart();
  const cases = [
    [[-104, 1, 3], [-104, 0, 6]],
    [[-103, 1, 20], [-103, 0, 8]],
    [[23, 12, 2], [23, 0, 0]],
    [[24, 1, 12], [23, 1, 1]],
    [[690, 2, 15], [690, 2, 4]],
    [[762, 3, 30], [762, 4, 0]],
  ];
  for (const [[year, month, day], expected] of cases) {
    const flow = resolveZiweiFlow(chart, zoned(year, month, day));
    assert.deepEqual(
      [flow.effectiveTargetYear, flow.targetMonthBuildingBranch, flow.month.limit.coordinate.stem],
      expected,
      `${year}-${month}-${day}`,
    );
  }
});

test('resolved flow installs five contiguous dynamic layers and all 44 flow stars', () => {
  const chart = ancientChart();
  const result = dynamicChartForTime(chart, zoned(2033, 12, 22));
  assert.equal(result.chart.flowStack.length, 5);
  assert.deepEqual(result.chart.flowStack.map((layer) => layer.level), [0, 1, 2, 3, 4]);
  const flowIds = result.chart.flowStack[FLOW_LEVEL.HOUR].starPositions
    .map((branch, id) => branch >= 0 ? id : -1)
    .filter((id) => id >= 0);
  assert.equal(flowIds.length, 44);
  assert.notEqual(result.chart.getFlowStarPosition(findStarId('flow_lucun')), null);
  assert.notEqual(result.chart.smallLimitLayer, null);
  const smallLucun = result.chart.getSmallLimitStar(findStarId('flow_lucun'));
  assert.notEqual(smallLucun, null);
  assert.equal(
    result.chart.getRoleAtBranch(result.flow.smallLimit.coordinate.branch, 'small-limit'),
    0,
  );
});

test('timeline and limit manager preserve cascade semantics', () => {
  const chart = ancientChart();
  const manager = new ZiweiLimitManager(chart);
  manager.setYear(2033);
  const leap = manager.manifest.currentYearMonths.find((month) => month.isLeap);
  assert.ok(leap);
  manager.selectMonth(leap);
  manager.setDay(1);
  const hours = manager.manifest.currentDayHours;
  manager.selectHour(hours[0]);
  assert.equal(manager.dynamicChart.flowStack.length, 5);
  assert.notEqual(manager.dynamicChart.smallLimitLayer, null);
  manager.clearHour();
  assert.equal(manager.context.hour, undefined);
  manager.setHour(hours[0].hourIndex);
  manager.clear(FLOW_LEVEL.MONTH);
  assert.equal(manager.context.month, undefined);
  assert.equal(manager.context.day, undefined);
  assert.equal(manager.context.hour, undefined);
  assert.equal(manager.dynamicChart.flowStack.length, 2);

  manager.setYear(2033);
  manager.setMonth(11);
  manager.addMonth(1);
  assert.equal(manager.context.month.isLeap, true);
  assert.equal(manager.context.month.sequence, 12);

  manager.clear(FLOW_LEVEL.YEAR);
  assert.equal(manager.timelineYear, undefined);
  assert.equal(manager.manifest.currentYearMonths, undefined);

  manager.setYear(2033);
  manager.clear(FLOW_LEVEL.DECADE);
  assert.equal(manager.timelineYear, undefined);
  assert.equal(manager.manifest.currentDecadeYears, undefined);
});

test('childhood selection exposes its timeline before a year is selected', () => {
  const manager = new ZiweiLimitManager(ancientChart());
  const childhood = manager.timeline.getChildhood();
  assert.ok(childhood.length > 0);
  manager.setDecadeIndex(0, childhood[0].year);
  assert.deepEqual(manager.manifest.currentDecadeYears, childhood);
  assert.equal(manager.context.year, undefined);
  for (const node of childhood) {
    manager.setYear(node.year);
    assert.equal(manager.context.decade.index, 0);
    assert.equal(manager.manifest.currentDecadeYears[0].year, node.year);
    manager.clearYear();
    assert.deepEqual(manager.manifest.currentDecadeYears, childhood);
  }
  manager.setDecadeIndex(1);
  assert.equal(manager.manifest.currentDecadeYears.length, 10);
  manager.reset();
  assert.equal(manager.manifest.currentDecadeYears, undefined);
});

test('split Zi exposes both rat-hour slots and physical stepping visits each one', () => {
  const sameDayChart = ancientChart({ ratHourMode: RAT_HOUR_MODE.CURRENT_DAY });
  const sameDayHours = sameDayChart.timeline()
    .getHours(sameDayChart.facts.solarTermPillars.day);
  assert.equal(sameDayHours.length, 13);
  assert.deepEqual(
    [
      sameDayHours[0].label,
      sameDayHours[0].hourIndex,
      sameDayHours[0].isEarlyRat,
      sameDayHours.at(-1).label,
      sameDayHours.at(-1).hourIndex,
      sameDayHours.at(-1).isLateRat,
    ],
    ['早子', 0, true, '晚子', 12, true],
  );
  assert.equal(sameDayHours[0].stem, sameDayHours.at(-1).stem);

  const tomorrowStemChart = ancientChart({
    ratHourMode: RAT_HOUR_MODE.CURRENT_DAY_TOMORROW_STEM,
  });
  const tomorrowStemHours = tomorrowStemChart.timeline()
    .getHours(tomorrowStemChart.facts.solarTermPillars.day);
  assert.notEqual(tomorrowStemHours[0].stem, tomorrowStemHours.at(-1).stem);

  const manager = tomorrowStemChart.createLimitManager();
  manager.setPhysicalTime(zoned(2023, 5, 1, 22, 30));
  manager.nextHour();
  assert.deepEqual(
    [manager.currentTarget.virtualTime.hour, manager.currentTarget.virtualTime.minute,
      manager.context.hour.ratHourSegment],
    [23, 30, RAT_HOUR_SEGMENT.LATE],
  );
  manager.nextHour();
  assert.deepEqual(
    [manager.currentTarget.virtualTime.hour, manager.currentTarget.virtualTime.minute,
      manager.context.hour.ratHourSegment],
    [0, 30, RAT_HOUR_SEGMENT.EARLY],
  );

  manager.setPhysicalTime(zoned(2023, 5, 1, 22, 15));
  manager.nextHour();
  assert.deepEqual(
    [manager.currentTarget.virtualTime.hour, manager.currentTarget.virtualTime.minute,
      manager.currentTarget.virtualTime.second, manager.context.hour.ratHourSegment],
    [23, 15, 0, RAT_HOUR_SEGMENT.LATE],
  );
  manager.nextHour();
  assert.deepEqual(
    [manager.currentTarget.virtualTime.hour, manager.currentTarget.virtualTime.minute,
      manager.context.hour.ratHourSegment],
    [0, 15, RAT_HOUR_SEGMENT.EARLY],
  );
  manager.previousHour();
  assert.deepEqual(
    [manager.currentTarget.virtualTime.hour, manager.currentTarget.virtualTime.minute,
      manager.context.hour.ratHourSegment],
    [23, 15, RAT_HOUR_SEGMENT.LATE],
  );
});

test('tier-1 reverse lookup verifies candidates through the forward chart engine', () => {
  const start = zoned(2003, 3, 13, 14);
  const options = new ZiweiOptions({ gender: ZIWEI_GENDER.MALE });
  const chart = ZiweiChart.fromZonedTime(start, options);
  const lucun = findStarId('lucun');
  const candidates = reverseLookupZiweiTier1({
    start,
    end: zoned(2003, 3, 13, 16),
    options,
    query: { lucunBranch: chart.starPositions[lucun] },
  });
  assert.ok(candidates.length >= 1);
  assert.equal(candidates[0].chart.starPositions[lucun], chart.starPositions[lucun]);
});

test('complete tier-1 constraints use the direct inverse across a century', () => {
  const birth = zoned(2000, 1, 1, 12);
  const options = new ZiweiOptions({ gender: ZIWEI_GENDER.MALE });
  const chart = ZiweiChart.fromZonedTime(birth, options);
  const branchOf = (key) => chart.starPositions[findStarId(key)];
  const candidates = reverseLookupZiweiTier1({
    start: zoned(1950, 1, 1, 0),
    end: zoned(2050, 12, 31, 23, 59),
    options,
    query: {
      lucunBranch: branchOf('lucun'),
      hongluanBranch: branchOf('hongluan'),
      zuofuBranch: branchOf('zuofu'),
      wenchangBranch: branchOf('wenchang'),
      santaiBranch: branchOf('santai'),
    },
  });
  assert.ok(candidates.some((candidate) => Math.abs(
    candidate.jdUT1 - birth.toJulianTime().jdUT1,
  ) < 1e-7));
});

test('a 33rd civil day after Jie remains a valid natal chart day', () => {
  const chart = ZiweiChart.fromZonedTime(
    zoned(1999, 8, 8, 0),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
  );
  assert.equal(chart.facts.solarDayFromPreviousJie, 33);
});


test('reverse fallback includes partially overlapping hour segments', () => {
  for (const ratHourMode of Object.values(RAT_HOUR_MODE)) {
    const options = new ZiweiOptions({ gender: ZIWEI_GENDER.MALE, ratHourMode });
    const expected = ZiweiChart.fromZonedTime(zoned(2026, 3, 1, 1), options);
    const rows = reverseLookupZiweiTier1({
      start: zoned(2026, 3, 1, 0, 30), end: zoned(2026, 3, 1, 1, 30), options,
      query: { wenchangBranch: expected.starPositions[findStarId('wenchang')] },
    });
    assert.equal(rows.length, 1, ratHourMode);
    assert.equal(rows[0].virtualTime.hour, 1);
    assert.equal(rows[0].virtualTime.minute, 0);
    const midnight = reverseLookupZiweiTier1({
      start: zoned(2026, 3, 1, 23, 30), end: zoned(2026, 3, 2, 0, 30), options,
      query: { lucunBranch: expected.starPositions[findStarId('lucun')] },
    });
    assert.deepEqual(midnight.map(r => r.virtualTime.hour), ratHourMode === RAT_HOUR_MODE.NEXT_DAY ? [23] : [23, 0]);
    const endpoint = reverseLookupZiweiTier1({
      start: zoned(2026, 3, 1, 0, 30), end: zoned(2026, 3, 1, 1), options,
      query: { wenchangBranch: expected.starPositions[findStarId('wenchang')] },
    });
    assert.equal(endpoint.length, 1);

  }
});

test('solar month timeline contains both sides of a Jie civil date', () => {
  const chart = ZiweiChart.fromZonedTime(zoned(2000, 1, 1, 12), new ZiweiOptions({
    gender: ZIWEI_GENDER.MALE, flowLimitBoundary: PILLAR_BOUNDARY.SOLAR_TERM,
  }));
  const timeline = new ZiweiTimelineProvider(chart);
  for (const month of timeline.getMonths(2026)) {
    for (const delta of [-1 / 86400, 1 / 86400]) {
      const instant = ZonedTime.fromJulianTime(month.solarEndJdExclusive + delta, 480);
      const flow = resolveZiweiFlow(chart, instant);
      const logical = calendarDateFromJulianDay(instant.toJulianTime().jdUT1 + 480 / 1440 + 1 / 24);
      const days = timeline.getDays(flow.effectiveTargetYear, flow.targetMonth);
      assert.ok(days.some(d => d.day === flow.targetDay && d.solarDate.year === logical.year
        && d.solarDate.month === logical.month && d.solarDate.day === logical.day),
        `month ${month.month}, delta ${delta}`);
    }
  }
});


test('review: direct reverse includes a partial matching segment', () => {
  const options = new ZiweiOptions({ gender: ZIWEI_GENDER.MALE });
  const chart = ZiweiChart.fromZonedTime(zoned(2026, 3, 1, 2), options);
  const query = Object.fromEntries(['lucun', 'hongluan', 'zuofu', 'wenchang', 'santai']
    .map(key => [`${key}Branch`, chart.starPositions[findStarId(key)]]));
  for (const [h, a, b] of [[1, 10, 30], [2, 30, 45]]) {
    const rows = reverseLookupZiweiTier1({start: zoned(2026, 3, 1, h, a), end: zoned(2026, 3, 1, h, b), options, query});
    assert.equal(rows.length, 1);
  }
});

test('review: later-nine advance changes effective year', () => {
  for (const strategy of [LEAP_MONTH_STRATEGY.AS_NEXT, LEAP_MONTH_STRATEGY.SPLIT_AFTER_FIFTEENTH]) {
    assert.deepEqual(resolveEffectiveLunarMonth({year: -200, month: 9, day: 16, isLeap: true, monthName: MONTH_NAME.LATER_NINE}, strategy), {year: -199, month: 10});
  }
});

test('review: physical steps retain true-solar conversion and rat metadata', () => {
  const options = new ZiweiOptions({gender: ZIWEI_GENDER.MALE, clockMode: ZIWEI_CLOCK_MODE.TRUE_SOLAR, longitudeDeg: 116.4, ratHourMode: RAT_HOUR_MODE.CURRENT_DAY});
  const chart = ZiweiChart.fromZonedTime(zoned(2000, 1, 1), options);
  const m = chart.createLimitManager();
  m.setPhysicalTime(zoned(2026, 3, 1, 23, 40));
  assert.equal(m.currentTarget.ratHourSegment, m.resolvedFlow.targetRatHourSegment);
  for (const action of ['nextDay', 'nextHour', 'previousHour', 'previousDay']) {
    m[action]();
    const t = m.currentTarget;
    const actual = resolveZiweiVirtualTime(ZonedTime.fromJulianTime(t.jdUT1, 480), options);
    assert.ok(Math.abs(julianDay(actual) - julianDay(t.virtualTime)) * 86400 < 0.001);
    assert.equal(t.ratHourSegment, m.resolvedFlow.targetRatHourSegment);
  }
});

test('review: selecting a month from another year synchronizes timeline', () => {
  const chart = ZiweiChart.fromZonedTime(zoned(2000, 1, 1), new ZiweiOptions({gender: ZIWEI_GENDER.MALE}));
  const m = chart.createLimitManager();
  m.setYear(2023);
  m.selectMonth(new ZiweiTimelineProvider(chart).getMonths(2024)[0]);
  assert.equal(m.context.year.year, 2024);
  assert.ok(m.manifest.currentMonthDays.length > 0);
  assert.equal(m.manifest.currentMonthDays[0].solarDate.year, 2024);
});

test('review: flow JSON rejects unavailable month input', () => {
  assert.throws(() => ZiweiConfigLoader.compileJson({label: 'invalid-flow', flowJson: JSON.stringify([
    {key: 'flow_lucun', rule: {type: 'anchor_offset', anchor: 'month', offset: 0}},
  ])}));
});


test('review: previous Jie uses its own apparent-solar offset', () => {
  const options = new ZiweiOptions({gender: ZIWEI_GENDER.MALE, clockMode: ZIWEI_CLOCK_MODE.TRUE_SOLAR, longitudeDeg: 153.07804249718785, ratHourMode: RAT_HOUR_MODE.CURRENT_DAY});
  const target = zoned(2026,3,20,20), jd = target.toJulianTime().jdUT1;
  const v = resolveZiweiVirtualTime(target,options);
  const jie = getPreviousJie(jd, options.toCalendarOptions()).time.jdUT1;
  const jv = resolveZiweiVirtualTime(ZonedTime.fromJulianTime(jie,480),options);
  const expected = Math.floor(julianDay(v)+0.5)-Math.floor(julianDay(jv)+0.5)+1;
  assert.equal(expected,16);
  assert.equal(solarDayFromPreviousJie(jd,v,options),expected);
  assert.equal(ZiweiChart.fromZonedTime(target,options).facts.solarDayFromPreviousJie,expected);
  const birth = ZiweiChart.fromZonedTime(zoned(2000,1,1),options);
  assert.equal(resolveZiweiFlow(birth,target,PILLAR_BOUNDARY.SOLAR_TERM).targetDay,expected);
});

test('review: historical later-nine birth agrees with flow effective year', () => {
  for (const leapMonthStrategy of [LEAP_MONTH_STRATEGY.AS_NEXT, LEAP_MONTH_STRATEGY.SPLIT_AFTER_FIFTEENTH]) {
    const options = new ZiweiOptions({gender: ZIWEI_GENDER.MALE, leapMonthStrategy});
    const target=zoned(-217,11,1,12), birth=ZiweiChart.fromZonedTime(target,options);
    assert.equal(birth.facts.lunarDate.monthName,MONTH_NAME.LATER_NINE);
    assert.equal(birth.facts.effectiveLunarYear,-216);
    const earlier=ZiweiChart.fromZonedTime(zoned(-230,1,1),options);
    assert.equal(resolveZiweiFlow(earlier,target).effectiveTargetYear,birth.facts.effectiveLunarYear);
  }
});


test('review3: civil clock normalizes input offset without changing instant', () => {
  const utc = new ZonedTime({year:2026,month:3,day:20,hour:18,offsetMinutes:0});
  const options = new ZiweiOptions({gender:ZIWEI_GENDER.MALE});
  const a = ZiweiChart.fromZonedTime(utc,options);
  const b = ZiweiChart.fromZonedTime(ZonedTime.fromJulianTime(utc.toJulianTime().jdUT1,480),options);
  assert.equal(a.facts.virtualTime.hour,b.facts.virtualTime.hour);
  assert.equal(a.facts.virtualTime.day,b.facts.virtualTime.day);
  assert.equal(a.facts.solarDayFromPreviousJie,b.facts.solarDayFromPreviousJie);
  assert.deepEqual(a.starPositions,b.starPositions);
});

test('review3: late Zi selectable index round trips physical flow', () => {
  for (const ratHourMode of [RAT_HOUR_MODE.CURRENT_DAY,RAT_HOUR_MODE.CURRENT_DAY_TOMORROW_STEM]) {
    const c=ZiweiChart.fromZonedTime(zoned(2000,1,1),new ZiweiOptions({gender:ZIWEI_GENDER.MALE,ratHourMode}));
    const m=c.createLimitManager(); m.setPhysicalTime(zoned(2026,3,20,23,30));
    const f=m.resolvedFlow, old=f.hour.limit.coordinate;
    assert.equal(f.targetHourIndex,12);
    m.setHour(f.targetHourIndex);
    assert.equal(m.context.hour.ratHourSegment,RAT_HOUR_SEGMENT.LATE);
    assert.deepEqual(m.context.hour.limit.coordinate,old);
  }
});

test('review3: custom solar placement reverse detects mid-hour Jie', () => {
  const module=new ZiweiRuleModule({label:'solar-month',patch:{natalPlacements:{wenchang:{inputs:['solar.month_branch'],shape:[12],positions:Array.from({length:12},(_,i)=>i)}}}});
  const options=new ZiweiOptions({gender:ZIWEI_GENDER.MALE,rules:{ruleset:new ZiweiRuleset([module])}});
  const jie=getNextJie(zoned(2026,3,1).toJulianTime().jdUT1,options.toCalendarOptions()).time.jdUT1;
  const at=delta=>ZonedTime.fromJulianTime(jie+delta/86400,480);
  const post=ZiweiChart.fromZonedTime(at(30),options),pre=ZiweiChart.fromZonedTime(at(-30),options),id=findStarId('wenchang');
  assert.notEqual(pre.starPositions[id],post.starPositions[id]);
  const rows=reverseLookupZiweiTier1({start:at(-30),end:at(30),options,query:{wenchangBranch:post.starPositions[id]}});
  assert.ok(rows.length>0);
  assert.ok(Math.abs(rows[0].jdUT1-jie)<1e-8);
});


test('selected day rejects stale nodes without mutating state', () => {
  const c=ZiweiChart.fromZonedTime(zoned(2000,1,1),new ZiweiOptions({gender:ZIWEI_GENDER.MALE}));
  const m=c.createLimitManager();m.setYear(2026);m.setMonth(1);
  const old=m.manifest.currentMonthDays[0];m.setMonth(3);m.setDay(1);const before=m.context;
  assert.throws(()=>m.selectDay(old),RangeError);assert.equal(m.context,before);
  const fresh=m.manifest.currentMonthDays[0];m.selectDay({...fresh,solarDate:{...fresh.solarDate}});
  assert.equal(m.context.day.limit.coordinate.stem,fresh.stem);
  const unchanged=m.context;
  assert.throws(()=>m.selectDay({...fresh,stem:(fresh.stem+1)%10}),RangeError);
  assert.equal(m.context,unchanged);
});

test('master boundary rejects invalid supplied values and preserves defaults', () => {
  for(const key of ['ming_zhu','shen_zhu']) {
    const compile=extra=>ZiweiConfigLoader.compileJson({label:'master-boundary',mastersJson:JSON.stringify({[key]:{table:Object.fromEntries(Array.from({length:12},(_,i)=>[i,'ziwei'])),...extra}})});
    const name=key==='ming_zhu'?'life':'body';
    assert.equal(compile({}).patch.masters[name].input,key==='ming_zhu'?'anchor.life':'master.year_branch');
    for(const valid of ['lunar','solar']) assert.equal(compile({boundary:valid}).patch.masters[name].input,`${valid}.year_branch`);
    for(const invalid of ['solr','',null,0,true]) assert.throws(()=>compile({boundary:invalid}),RangeError);
  }
});


test('direct flow modules validate supported inputs and domains', () => {
  for(const input of ['lunar.month_index','solar.day_index','unknown']) {
    assert.throws(()=>new ZiweiRuleModule({label:'bad-flow',patch:{flowPlacements:{flow_lucun:{inputs:[input],shape:[12],positions:Array(12).fill(0)}}}}),RangeError);
  }
  assert.throws(()=>new ZiweiRuleModule({label:'short-flow',patch:{flowPlacements:{flow_lucun:{inputs:['lunar.year_branch'],shape:[1],positions:[0]}}}}),RangeError);
  assert.ok(new ZiweiRuleModule({label:'valid-flow',patch:{flowPlacements:{flow_lucun:{inputs:['lunar.year_branch'],shape:[12],positions:Array.from({length:12},(_,i)=>i)}}}}).patch.flowPlacements);
});

test('hour selection rejects stale and incompatible nodes atomically', () => {
  for(const ratHourMode of Object.values(RAT_HOUR_MODE)) {
    const m=ZiweiChart.fromZonedTime(zoned(2000,1,1),new ZiweiOptions({gender:ZIWEI_GENDER.MALE,ratHourMode})).createLimitManager();
    m.setYear(2026);m.setMonth(1);m.setDay(1);const old=m.manifest.currentDayHours[0];
    m.setDay(2);m.setHour(0);const before=m.context;
    assert.throws(()=>m.selectHour(old),RangeError);assert.equal(m.context,before);
    const fresh=m.manifest.currentDayHours[0];m.selectHour({...fresh});const now=m.context;
    assert.throws(()=>m.selectHour({...fresh,isEarlyRat:!fresh.isEarlyRat}),RangeError);
    assert.equal(m.context,now);
  }
});


test('month selection rejects forged nodes and preserves physical state', () => {
  const c=ZiweiChart.fromZonedTime(zoned(2000,1,1),new ZiweiOptions({gender:ZIWEI_GENDER.MALE}));
  const m=c.createLimitManager();m.setPhysicalTime(zoned(2026,4,20));
  const node=new ZiweiTimelineProvider(c).getMonths(2026)[0],before=m.context,target=m.currentTarget;
  assert.throws(()=>m.selectMonth({...node,monthBuildingBranch:(node.monthBuildingBranch+1)%12}),RangeError);
  assert.equal(m.context,before);assert.equal(m.currentTarget,target);
  m.selectMonth({...node});assert.equal(m.context.month.month,node.month);
});


test('natal modules reject unknown inputs and invalid domains at construction', () => {
  for(const input of ['unknown','constructor','lunar.year_branch','lunar.day_index','solar.day_index']) {
    assert.throws(()=>new ZiweiRuleModule({label:'bad-natal',patch:{natalPlacements:{wenchang:{inputs:[input],shape:[1],positions:[0]}}}}),RangeError);
  }
  for(const [input,domain] of Object.entries({'lunar.year_branch':12,'lunar.day_index':30,'solar.day_index':33,'anchor.bureau':5,'birth.gender':2})) {
    const module=new ZiweiRuleModule({label:'valid-natal',patch:{natalPlacements:{wenchang:{inputs:[input],shape:[domain],positions:Array.from({length:domain},(_,i)=>i%12)}}}});
    const c=ZiweiChart.fromZonedTime(zoned(2000,1,1),new ZiweiOptions({gender:ZIWEI_GENDER.MALE,rules:{ruleset:new ZiweiRuleset([module])}}));
    assert.ok(c.starPositions[findStarId('wenchang')]>=0 && c.starPositions[findStarId('wenchang')]<12);
  }
});


test('sihua rejects unknown transformation keys at both entry points', () => {
  for(const row of [{kua:'ziwei'},{lu:'ziwei',kua:'tianji'}]) {
    assert.throws(()=>new ZiweiRuleModule({label:'bad',patch:{sihua:{jia:row}}}),RangeError);
    assert.throws(()=>ZiweiConfigLoader.compileJson({label:'bad',sihuaJson:JSON.stringify({jia:row})}),RangeError);
  }
  assert.ok(new ZiweiRuleModule({label:'valid',patch:{sihua:{jia:{quan:'ziwei'}}}}).patch.sihua);
});

test('historical repeated months retain identity through day selection', () => {
  const c=ZiweiChart.fromZonedTime(zoned(1,1,1),new ZiweiOptions({gender:ZIWEI_GENDER.MALE}));
  const t=new ZiweiTimelineProvider(c),m=c.createLimitManager(),months=t.getMonths(23).filter(v=>v.month===12&&!v.isLeap);
  assert.deepEqual(months.map(v=>v.sequence),[12,13]);m.setYear(23);
  for(const n of months) {
    m.selectMonth(n);const expected=calendarDateFromJulianDay(n.firstCivilDayNumber-.5);
    const days=t.getDays(23,12,false,12,23,n.sequence);
    assert.equal(days[0].solarDate.day,expected.day);
    assert.equal(m.manifest.currentMonthDays[0].solarDate.day,expected.day);
    m.setDay(1);assert.equal(m.context.day.limit.coordinate.stem,days[0].stem);
  }
  m.addMonth(-1);assert.equal(m.manifest.currentMonthDays[0].solarDate.day,2);
  m.addMonth(1);assert.equal(m.manifest.currentMonthDays[0].solarDate.day,31);
  m.setMonth(12,false,undefined,undefined,13);assert.equal(m.context.month.sequence,13);
  m.setPhysicalTime(zoned(23,12,31));assert.equal(m.manifest.currentMonthDays[0].solarDate.day,31);
});


test('fixed rule schemas reject unknown fields instead of silently ignoring them', () => {
  const master={input:'anchor.life',stars:Array(12).fill('ziwei')};
  for(const patch of [
    {masters:{bdy:master}}, {masters:{life:master,bdy:master}},
    {mastrs:{life:master}}, {masters:{body:{...master,inpt:'anchor.life'}}},
    {stars:[{key:'custom',natal:true,natel:true}]},
    {natalPlacements:{wenchang:{inputs:[],shape:[],positions:[0],positons:[1]}}},
  ]) assert.throws(()=>new ZiweiRuleModule({label:'invalid-schema',patch}),RangeError);
  const table=Object.fromEntries(Array.from({length:12},(_,i)=>[i,'ziwei']));
  for(const raw of [
    {shen_zh:{table}}, {shen_zhu:{table,boundry:'solar'}},
    {shen_zhu:{table:{...table,12:'ziwei'}}},
  ]) assert.throws(()=>ZiweiConfigLoader.compileJson({label:'invalid-schema',mastersJson:JSON.stringify(raw)}),RangeError);
  assert.ok(new ZiweiRuleModule({label:'valid',patch:{masters:{life:master,body:master}}}).patch.masters);
  assert.ok(ZiweiConfigLoader.compileJson({label:'valid',mastersJson:JSON.stringify({_comment:'note',shen_zhu:{table,_comment:'note'}})}).patch.masters);
});


test('legacy JSON rule typos cannot fall through to optional defaults', () => {
  for(const rule of [
    {type:'anchor_offset',anchor:'month',offest:2},
    {type:'constant',vaule:4},
    {type:'pipeline',steps:[{type:'constant',value:2,vaule:4}]},
  ]) assert.throws(()=>compileZiweiJsonPlacement(rule),RangeError);
  assert.deepEqual(compileZiweiJsonPlacement({type:'constant',value:4,_comment:'note'}).positions,[4]);
});


test('legacy star declarations validate raw fields before projection', () => {
  const rule = { type: 'constant', value: 4 };
  for (const field of ['starsJson', 'flowJson']) {
    const compile = star => ZiweiConfigLoader.compileJson({ label: 'raw-star-schema', [field]: JSON.stringify([star]) });
    for (const typo of ['brighness', 'tyep', 'catgory', 'natel', 'rulle']) {
      assert.throws(() => compile({ key: 'extra', rule, [typo]: 0 }), /unknown JSON .* star/);
    }
    for (const categoryKey of ['type', 'category']) {
      const star = { key: 'extra', rule, [categoryKey]: 'minor', _comment: 'supported metadata' };
      if (field === 'flowJson') star.brightness = Array(12).fill(6);
      const { patch } = compile(star);
      assert.deepEqual(patch.stars, [{ key: 'extra', category: 'minor', natal: field === 'starsJson' }]);
      assert.deepEqual(patch[field === 'starsJson' ? 'natalPlacements' : 'flowPlacements'].extra.positions, [4]);
      if (field === 'flowJson') assert.deepEqual(patch.brightness.extra, Array(12).fill(6));
    }
    if (field === 'starsJson') {
      assert.throws(() => compile({ key: 'extra', rule, brightness: Array(12).fill(6) }), /unknown JSON natal star/);
    } else {
      assert.throws(() => compile({ key: 'extra', rule, brightness: null }), TypeError);
    }
  }
});


test('lookup tables reject keys outside their anchor domain, including nested rules', () => {
  const stems = ['jia','yi','bing','ding','wu','ji','geng','xin','ren','gui'];
  const branches = ['zi','chou','yin','mao','chen','si','wu','wei','shen','you','xu','hai'];
  for (const [anchor, boundary, keys] of [
    ['year_stem','lunar',stems], ['month_stem','solar',stems],
    ['year_branch','lunar',branches], ['ming','lunar',branches],
    ['wuxingjv','lunar',['water2','wood3','metal4','earth5','fire6']],
    ['month','lunar',Array.from({length:12},(_,i)=>String(i))],
    ['day','lunar',Array.from({length:30},(_,i)=>String(i))],
    ['day','solar',Array.from({length:33},(_,i)=>String(i))],
  ]) {
    const table = Object.fromEntries(keys.map((key,i)=>[key,i%12]));
    for (const type of ['lookup','lookup_offset']) {
      const rule = {type,anchor,boundary,table,...(type==='lookup_offset'?{shift_anchor:'hour'}:{})};
      assert.ok(compileZiweiJsonPlacement(rule).positions.length > 0);
      const invalid = {...rule,table:{...table,jiaa:0}};
      assert.throws(()=>compileZiweiJsonPlacement(invalid), /unknown .*table field: jiaa/);
      assert.throws(()=>compileZiweiJsonPlacement({type:'pipeline',steps:[invalid]}), /unknown .*table field: jiaa/);
      if (anchor === 'day') {
        assert.throws(()=>compileZiweiJsonPlacement({...rule,table:{...table,[keys.length]:0}}), /unknown .*table field/);
        const {boundary: ignored, ...inherited} = rule;
        assert.deepEqual(compileZiweiJsonPlacement({type:'pipeline',boundary,steps:[inherited]}).positions,
          compileZiweiJsonPlacement(rule).positions);
      }
      const missing = {...table}; delete missing[keys[0]];
      assert.throws(()=>compileZiweiJsonPlacement({...rule,table:missing}), /table has no value/);
    }
  }
});

test('complete legacy natal and flow star configuration remains loadable', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/legacy-stars.json', import.meta.url), 'utf8'));
  const ruleset = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
    label:'legacy-complete', starsJson:JSON.stringify(fixture.stars), flowJson:JSON.stringify(fixture.flow),
  });
  const chart = ZiweiChart.fromZonedTime(zoned(2003,3,13,14), new ZiweiOptions({gender:ZIWEI_GENDER.MALE,rules:{ruleset}}));
  assert.equal(chart.starCatalog.length, 159);
  for (const raw of fixture.stars.filter(s=>s.type==='bad')) {
    assert.equal(chart.starCatalog.find(s=>s.key===raw.key).category,'malefic');
  }
  const dynamic = dynamicChartForTime(chart,zoned(2033,12,22)).chart;
  for (const raw of fixture.flow) {
    const star = dynamic.getFlowStar(findStarId(raw.key));
    assert.ok(star.branch >= 0 && star.branch < 12);
    if (raw.brightness) assert.equal(star.brightness,raw.brightness[star.branch]);
  }
});

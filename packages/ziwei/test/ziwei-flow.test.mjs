import assert from 'node:assert/strict';
import test from 'node:test';
import { RAT_HOUR_MODE, ZonedTime } from 'js-ephemeris-lite';
import {
  FLOW_LEVEL,
  FLOW_MONTH_PALACE_STRATEGY,
  LEAP_MONTH_STRATEGY,
  RAT_HOUR_SEGMENT,
  ZIWEI_GENDER,
  ZiweiChart,
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
  reverseLookupZiweiTier1,
} from '../dist/index.js';

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

  // Legacy/Dart construction always advances by physical sequence, even if
  // the calendar-backed strategy is configured to follow effectiveMonth.
  const legacyThirteenNormal = makeFlowMonth(effectivePalaceChart, 2025, 12, 13, false);
  const legacyThirteenLeap = makeFlowMonth(effectivePalaceChart, 2025, 12, 13, true);
  assert.equal(legacyThirteenLeap.palaceMonthIndex, 13);
  assert.equal(
    legacyThirteenLeap.limit.coordinate.branch,
    (legacyThirteenLeap.doujun + 12) % 12,
  );
  assert.deepEqual(
    [legacyThirteenNormal.limit.coordinate.stem, legacyThirteenLeap.limit.coordinate.stem],
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
});

test('runtime flow JSON patches placement and brightness together', () => {
  const ruleset = ZiweiConfigLoader.overrideWith(ZiweiConfigLoader.getDefault(), {
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

import assert from 'node:assert/strict';
import test from 'node:test';
import { ZonedTime } from 'js-ephemeris-lite';
import {
  FLOW_LEVEL,
  ZIWEI_GENDER,
  ZiweiChart,
  ZiweiConfigLoader,
  ZiweiLimitManager,
  ZiweiOptions,
  ZiweiTimelineProvider,
  dynamicChartForTime,
  findStarId,
  resolveZiweiFlow,
  reverseLookupZiweiTier1,
} from '../dist/index.js';

function zoned(year, month, day, hour = 12, minute = 0) {
  return new ZonedTime({ year, month, day, hour, minute, second: 0, offsetMinutes: 480 });
}

function ancientChart() {
  return ZiweiChart.fromZonedTime(
    zoned(-200, 6, 1, 8),
    new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
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
  // The leap month repeats Jian-Zi and therefore repeats the preceding month stem.
  const months = new ZiweiTimelineProvider(chart).getMonths(2033);
  assert.deepEqual(months.slice(10).map((month) => [
    month.month,
    month.sequence,
    month.isLeap,
    month.monthBuildingBranch,
    month.stem,
  ]), [
    [11, 11, false, 0, 0],
    [11, 12, true, 0, 0],
    [12, 13, false, 1, 1],
  ]);
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
    [[-104, 1, 3], [-105, 0, 4]],
    [[-103, 1, 20], [-104, 0, 6]],
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

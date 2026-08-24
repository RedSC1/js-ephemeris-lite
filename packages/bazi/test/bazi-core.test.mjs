import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRANCH_RELATION_FLAG,
  BRANCH_TRIPLE_RELATION_FLAG,
  EARTH_PALACE_MODE,
  GENDER,
  PILLAR_MASK,
  RELATION_KIND,
  STEM_RELATION_FLAG,
  SHEN_SHA,
  SHEN_SHA_TARGET,
  WUXING,
  calculateBaziChart,
  calculateBranchRelation,
  calculateBranchTripleRelation,
  calculateFlowHour,
  calculateFlowMonth,
  calculateFlowYear,
  calculateLuckDirection,
  calculateQiYun,
  calculateStemRelation,
  collectChartRelations,
  generateDaYunPillars,
  generateDaYun,
  getHiddenStems,
  getKongWang,
  getLifeStage,
  getRenyuanSilingSegments,
  getTenGod,
  collectTargetShenSha,
  hasShenSha,
  packPillar,
  unpackPillar,
} from '../dist/index.js';
import { ZonedTime } from 'js-ephemeris-lite';

test('uint8-compatible pillar encoding covers the whole sexagenary cycle', () => {
  for (let index = 0; index < 60; index += 1) {
    const value = packPillar(index % 10, index % 12);
    const decoded = unpackPillar(value);
    assert.equal(value, ((index % 10) << 4) | (index % 12));
    assert.equal(decoded.index, index);
    assert.equal(decoded.name.length, 2);
  }
  assert.equal(packPillar(4, 6), 0x46);
  assert.throws(() => packPillar(0, 1), RangeError);
});

test('Kong-Wang, Ten Gods and hidden stems match native oracles', () => {
  assert.deepEqual(getKongWang(0x00), [10, 11]);
  assert.deepEqual(getKongWang(0x0a), [8, 9]);
  assert.deepEqual(getKongWang(0x08), [6, 7]);
  assert.deepEqual(getKongWang(0x11), [11, 10]);
  for (let dayStem = 0; dayStem < 10; dayStem += 1) {
    for (let targetStem = 0; targetStem < 10; targetStem += 1) {
      const expected = ((((targetStem >> 1) - (dayStem >> 1) + 5) % 5) << 1)
        | ((dayStem ^ targetStem) & 1);
      assert.equal(getTenGod(dayStem, targetStem), expected);
    }
  }
  assert.deepEqual(getHiddenStems(0), [9]);
  assert.deepEqual(getHiddenStems(1), [5, 9, 7]);
  assert.deepEqual(getHiddenStems(2), [0, 2, 4]);
  assert.deepEqual(getHiddenStems(11), [8, 0]);
});

test('pair and triple relation tables retain their stable flags', () => {
  assert.deepEqual(calculateStemRelation(0, 5), {
    flags: STEM_RELATION_FLAG.COMBINATION,
    combinedElement: WUXING.EARTH,
  });
  assert.equal(calculateStemRelation(0, 6).flags & STEM_RELATION_FLAG.CLASH,
    STEM_RELATION_FLAG.CLASH);
  assert.deepEqual(calculateBranchRelation(0, 1), {
    flags: BRANCH_RELATION_FLAG.COMBINATION,
    combinedElement: WUXING.EARTH,
  });
  assert.ok(calculateBranchRelation(4, 4).flags & BRANCH_RELATION_FLAG.SELF_PUNISHMENT);
  assert.deepEqual(calculateBranchTripleRelation(8, 0, 4), {
    flags: BRANCH_TRIPLE_RELATION_FLAG.COMBINATION,
    combinedElement: WUXING.WATER,
  });
  assert.ok(calculateBranchTripleRelation(2, 5, 8).flags
    & BRANCH_TRIPLE_RELATION_FLAG.PUNISHMENT);
});

test('life-stage rules exhaust both earth-palace modes', () => {
  const starts = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
  for (const mode of [EARTH_PALACE_MODE.FIRE_EARTH, EARTH_PALACE_MODE.WATER_EARTH]) {
    for (let stem = 0; stem < 10; stem += 1) {
      let start = starts[stem];
      if (mode === EARTH_PALACE_MODE.WATER_EARTH && stem === 4) start = 8;
      if (mode === EARTH_PALACE_MODE.WATER_EARTH && stem === 5) start = 3;
      for (let branch = 0; branch < 12; branch += 1) {
        const expected = (stem & 1) === 0
          ? (branch + 12 - start) % 12
          : (start + 12 - branch) % 12;
        assert.equal(getLifeStage(stem, branch, mode), expected);
      }
    }
  }
});

test('chart interpretation matches the C++ chart oracle', () => {
  const chart = calculateBaziChart({ year: 0x26, month: 0x62, day: 0x42, hour: 0x35 });
  assert.deepEqual(chart.extraPillars, {
    mingGong: 0x4a,
    shenGong: 0x28,
    taiYuan: 0x75,
    taiXi: 0x9b,
  });
  assert.equal(chart.dayMaster, 4);
  assert.deepEqual(chart.columns[2].hiddenStems, [0, 2, 4]);
  assert.equal(chart.columns[2].visibleTenGod, 0);
  assert.deepEqual(chart.columns.map((column) => column.lifeStage), [4, 0, 0, 3]);
  assert.deepEqual(chart.columns.map((column) => column.nayinId), [21, 13, 7, 26]);
});

test('flow and luck-cycle primitives match native behavior', () => {
  assert.equal(calculateFlowYear(1984), 0x00);
  assert.equal(calculateFlowYear(2024), 0x04);
  assert.equal(calculateFlowYear(4), 0x00);
  assert.equal(calculateFlowMonth(0x04, 2), 0x22);
  assert.equal(calculateFlowMonth(0x04, 0), 0x20);
  assert.equal(calculateFlowHour(0x46, 0), 0x80);
  assert.equal(calculateFlowHour(0x46, 11), 0x9b);
  assert.equal(calculateLuckDirection(0x04, GENDER.MALE), 1);
  assert.equal(calculateLuckDirection(0x04, GENDER.FEMALE), -1);

  const chart = calculateBaziChart({ year: 0x26, month: 0x62, day: 0x42, hour: 0x35 });
  assert.deepEqual(generateDaYunPillars(chart, 1, 3).map((item) => item.pillar),
    [0x73, 0x84, 0x95]);
});

test('relation aggregation suppresses pairs inside complete triples', () => {
  const chart = calculateBaziChart({ year: 0x68, month: 0x20, day: 0x44, hour: 0x55 });
  const relations = collectChartRelations(chart);
  const tripleMask = PILLAR_MASK.YEAR | PILLAR_MASK.MONTH | PILLAR_MASK.DAY;
  assert.ok(relations.some((relation) => relation.kind === RELATION_KIND.BRANCH_TRIPLE_COMBINATION
    && relation.pillarMask === tripleMask && relation.combinedElement === WUXING.WATER));
  assert.ok(!relations.some((relation) => (relation.pillarMask & ~tripleMask) === 0
    && (relation.kind === RELATION_KIND.BRANCH_HALF_COMBINATION
      || relation.kind === RELATION_KIND.BRANCH_ARCHING_COMBINATION
      || relation.kind === RELATION_KIND.BRANCH_PUNISHMENT)));

  const half = collectChartRelations(chart, {
    pillarMask: PILLAR_MASK.YEAR | PILLAR_MASK.MONTH,
    relationMask: (1 << RELATION_KIND.BRANCH_HALF_COMBINATION)
      | (1 << RELATION_KIND.BRANCH_ARCHING_COMBINATION),
  });
  assert.ok(half.some((relation) => relation.kind === RELATION_KIND.BRANCH_HALF_COMBINATION));
});

test('Renyuan-Siling tables remain ordered 30-day segments', () => {
  for (let table = 0; table < 2; table += 1) {
    for (let branch = 0; branch < 12; branch += 1) {
      const segments = getRenyuanSilingSegments(branch, table);
      assert.equal(segments[0].startDay, 0);
      assert.equal(segments.at(-1).endDay, 30);
      for (let index = 1; index < segments.length; index += 1) {
        assert.equal(segments[index].startDay, segments[index - 1].endDay);
      }
    }
  }
});

test('Qi-Yun and timed Da-Yun reproduce the native integration oracle', () => {
  const birth = new ZonedTime({
    year: 2026, month: 2, day: 19, hour: 23, minute: 28, second: 0, offsetMinutes: 480,
  });
  const chart = calculateBaziChart({ year: 0x26, month: 0x62, day: 0x11, hour: 0x20 });
  const qiYun = calculateQiYun(birth.toJulianTime(), birth, chart, GENDER.MALE);
  assert.equal(qiYun.direction, 1);
  assert.ok(qiYun.jieIntervalDays > 13 && qiYun.jieIntervalDays < 15);
  assert.deepEqual({
    year: qiYun.startCivilTime.year,
    month: qiYun.startCivilTime.month,
    day: qiYun.startCivilTime.day,
  }, { year: 2030, month: 10, day: 12 });
  assert.equal(qiYun.traditionalOffset.years, 4);
  assert.equal(qiYun.traditionalOffset.months, 7);
  assert.equal(qiYun.traditionalOffset.days, 22);

  const daYun = generateDaYun(birth, chart, qiYun, { count: 8 });
  assert.deepEqual(daYun.map((item) => item.pillar),
    [0x73, 0x84, 0x95, 0x06, 0x17, 0x28, 0x39, 0x4a]);
  assert.deepEqual(daYun.map((item) => item.startVirtualAge),
    [5, 15, 25, 35, 45, 55, 65, 75]);
});

test('Shen-Sha bigint bitset preserves stable IDs and target restrictions', () => {
  const chart = calculateBaziChart({ year: 0x00, month: 0x22, day: 0x42, hour: 0x20 });
  const noble = collectTargetShenSha(chart, 0x51, SHEN_SHA_TARGET.YEAR);
  assert.equal(typeof noble, 'bigint');
  assert.ok(hasShenSha(noble, SHEN_SHA.TIAN_YI_GUI_REN));

  const horse = collectTargetShenSha(chart, 0x68, SHEN_SHA_TARGET.FLOW_YEAR);
  assert.ok(hasShenSha(horse, SHEN_SHA.YI_MA));

  const kuiGangDay = collectTargetShenSha(chart, packPillar(6, 4), SHEN_SHA_TARGET.DAY);
  assert.ok(hasShenSha(kuiGangDay, SHEN_SHA.KUI_GANG));
  const kuiGangFlow = collectTargetShenSha(chart, packPillar(6, 4), SHEN_SHA_TARGET.FLOW_YEAR);
  assert.ok(!hasShenSha(kuiGangFlow, SHEN_SHA.KUI_GANG));

  const genderAware = collectTargetShenSha(chart, chart.pillars.day, SHEN_SHA_TARGET.DAY, {
    gender: GENDER.MALE,
  });
  assert.ok((genderAware & ~((1n << 66n) - 1n)) === 0n);
});

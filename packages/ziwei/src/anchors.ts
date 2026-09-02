import {
  ganzhiBranch,
  ganzhiStem,
  type FourPillars,
} from 'js-ephemeris-lite';
import type { ZiweiOptions } from './options.js';
import {
  BUREAU,
  PALACE,
  PILLAR_BOUNDARY,
  ZIWEI_CHART_MODE,
  advanceBranch,
  bureauNumber,
  type Bureau,
  type ZiweiCalendarFacts,
  type ZiweiLunarDateFacts,
} from './types.js';

export interface ZiweiAnchors {
  readonly solarTerm: Readonly<FourPillars>;
  readonly lunar: Readonly<FourPillars>;
  readonly bureau: Bureau;
  readonly ziwei: number;
  readonly tianfu: number;
  /** Indexed by PALACE id; each value is a physical branch 0..11. */
  readonly palacePositions: readonly number[];
}

export interface ResolvedZiweiAnchors {
  readonly anchors: ZiweiAnchors;
  readonly bodyPalace: number;
}

function bureauFromPalaceGanzhi(stem: number, branch: number): Bureau {
  const score = (Math.floor(stem / 2) + Math.floor(branch / 2) % 3) % 5;
  return [BUREAU.METAL_4, BUREAU.WATER_2, BUREAU.FIRE_6, BUREAU.EARTH_5, BUREAU.WOOD_3][score]!;
}

function ziweiPosition(lunarDay: number, bureau: Bureau): number {
  const value = bureauNumber(bureau);
  let quotient: number;
  let adjustment = 0;
  if (lunarDay % value === 0) {
    quotient = lunarDay / value;
  } else {
    const toAdd = value - lunarDay % value;
    quotient = (lunarDay + toAdd) / value;
    adjustment = (toAdd & 1) === 1 ? -toAdd : toAdd;
  }
  return advanceBranch(quotient + adjustment + 1, 0);
}

export function computePalaceStems(yearStem: number): readonly number[] {
  if (!Number.isInteger(yearStem) || yearStem < 0 || yearStem >= 10) {
    throw new RangeError('yearStem must be 0..9');
  }
  const result = Array<number>(12);
  const yinStem = yearStem % 5 * 2 + 2;
  for (let step = 0; step < 12; step += 1) {
    const branch = advanceBranch(2, step);
    result[branch] = (yinStem + step) % 10;
  }
  return Object.freeze(result);
}

export function resolveEffectiveLunarMonth(
  lunarDate: ZiweiLunarDateFacts,
  strategy: ZiweiOptions['leapMonthStrategy'],
): Readonly<{ year: number; month: number }> {
  if (!Number.isInteger(lunarDate.year) || !Number.isInteger(lunarDate.month)
    || lunarDate.month < 1 || lunarDate.month > 13
    || !Number.isInteger(lunarDate.day) || lunarDate.day < 1 || lunarDate.day > 30) {
    throw new RangeError('invalid lunar date facts');
  }
  let year = lunarDate.year;
  let month = lunarDate.month === 13 ? 12 : lunarDate.month;
  const advance = lunarDate.isLeap
    && (strategy === 1 || (strategy === 2 && lunarDate.day > 15));
  if (advance) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return Object.freeze({ year, month });
}

/** Calendar-independent anchor calculation shared by normal and manual placement. */
export function computePlacementAnchors(
  month: number, day: number, hourBranch: number, yearStem: number,
  options: ZiweiOptions, retainedBureau?: Bureau,
) {
  for (const [name, value, min, max] of [
    ['month', month, 1, 12], ['day', day, 1, 30], ['hourBranch', hourBranch, 0, 11],
    ['yearStem', yearStem, 0, 9],
  ] as const) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(`${name} must be ${min}..${max}`);
    }
  }
  if (retainedBureau !== undefined && (!Number.isInteger(retainedBureau) || retainedBureau < 0 || retainedBureau > 4)) {
    throw new RangeError('bureau must be a BUREAU value (0..4)');
  }
  const originalLife = advanceBranch(1 + month - hourBranch, 0);
  const bodyPalace = advanceBranch(1 + month + hourBranch, 0);
  const life = options.chartMode === ZIWEI_CHART_MODE.DI_PAN
    ? bodyPalace
    : options.chartMode === ZIWEI_CHART_MODE.REN_PAN
      ? advanceBranch(originalLife, 2) : originalLife;
  const palacePositions = Object.freeze(Array.from(
    { length: 12 }, (_, palace) => advanceBranch(life, -palace),
  ));
  const palaceStems = computePalaceStems(yearStem);
  const bureau = retainedBureau ?? bureauFromPalaceGanzhi(palaceStems[life]!, life);
  const ziwei = ziweiPosition(day, bureau);
  return Object.freeze({ bureau, ziwei, tianfu: advanceBranch(4 - ziwei, 0),
    palacePositions, palaceStems, bodyPalace });
}

export function computeZiweiAnchors(
  facts: ZiweiCalendarFacts,
  options: ZiweiOptions,
): ResolvedZiweiAnchors {
  const yearPillar = options.wuHuDunYearBoundary === PILLAR_BOUNDARY.SOLAR_TERM
    ? facts.solarTermPillars.year : facts.lunarPillars.year;
  const { bureau, ziwei, tianfu, palacePositions, bodyPalace } = computePlacementAnchors(
    facts.effectiveLunarMonth, facts.lunarDate.day, ganzhiBranch(facts.lunarPillars.hour),
    ganzhiStem(yearPillar), options,
  );

  return Object.freeze({
    anchors: Object.freeze({
      solarTerm: facts.solarTermPillars,
      lunar: facts.lunarPillars,
      bureau,
      ziwei,
      tianfu,
      palacePositions,
    }),
    bodyPalace,
  });
}

export function flattenZiweiAnchors(anchors: ZiweiAnchors): readonly number[] {
  const result: number[] = [];
  const appendPillars = (pillars: FourPillars): void => {
    for (const value of [pillars.year, pillars.month, pillars.day, pillars.hour]) {
      result.push(ganzhiStem(value), ganzhiBranch(value));
    }
  };
  appendPillars(anchors.solarTerm);
  appendPillars(anchors.lunar);
  result.push(anchors.bureau, anchors.ziwei, anchors.tianfu, ...anchors.palacePositions);
  if (result.length !== 31 || anchors.palacePositions[PALACE.LIFE] === undefined) {
    throw new Error('invalid Ziwei anchors');
  }
  return Object.freeze(result);
}

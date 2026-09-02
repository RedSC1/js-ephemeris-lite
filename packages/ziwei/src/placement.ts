import { ganzhiBranch, ganzhiStem } from 'js-ephemeris-lite';
import { computePlacementAnchors, type ZiweiAnchors } from './anchors.js';
import { ZiweiOptions, type ZiweiOptionsInput } from './options.js';
import { evaluatePlacementInputs, readNatalRuleInput, selectZiweiRules } from './rules.js';
import { PILLAR_BOUNDARY, type Bureau, type ZiweiCalendarFacts } from './types.js';

/** Direct placement inputs, not a civil date or a request for calendar conversion. */
export interface ZiweiPlacementInput {
  readonly yearGanIndex: number;
  readonly yearZhiIndex: number;
  /** Effective placement month, 1..12; leap-month processing is already complete. */
  readonly month: number;
  readonly day: number;
  /** Zi = 0, Chou = 1, ... Hai = 11. */
  readonly hourZhiIndex: number;
}

export interface ZiweiModifyInput extends Partial<ZiweiPlacementInput> {
  /** Recompute the bureau for both star placement and limit start ages. */
  readonly updateBureau?: boolean;
}

export interface ZiweiModification {
  readonly overrides: Readonly<Partial<ZiweiPlacementInput>>;
  readonly updateBureau: boolean;
  readonly lifePalaceShift: number;
}

const INPUT_RANGES = {
  yearGanIndex: [0, 9], yearZhiIndex: [0, 11], month: [1, 12],
  day: [1, 30], hourZhiIndex: [0, 11],
} as const;

/** @internal Shared runtime validation; undefined means no override. */
export function placementOverrides(input: Partial<ZiweiPlacementInput>): Readonly<Partial<ZiweiPlacementInput>> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('placement input must be an object');
  }
  const result: Record<string, number> = {};
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(INPUT_RANGES, key) && key !== 'updateBureau') throw new RangeError(`unknown placement input: ${key}`);
  }
  for (const key of Object.keys(INPUT_RANGES) as (keyof ZiweiPlacementInput)[]) {
    const value = input[key];
    if (value === undefined) continue;
    const [min, max] = INPUT_RANGES[key];
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(`${key} must be ${min}..${max}`);
    }
    result[key] = value;
  }
  return Object.freeze(result);
}

/** @internal Original calendar context; manual values never overwrite these facts. */
export interface ZiweiPlacementContext {
  readonly facts: ZiweiCalendarFacts;
  readonly anchors: ZiweiAnchors;
  readonly bodyPalace: number;
}

function yearKong(stem: number, branch: number, secondary: boolean): number | undefined {
  if (stem % 2 !== branch % 2) return undefined;
  let index = 0;
  while (index % 10 !== stem || index % 12 !== branch) index += 1;
  const first = (10 - Math.floor(index / 10) * 2 + 12) % 12;
  const second = (first + 1) % 12;
  const firstIsMain = stem % 2 === 0 ? first % 2 === 0 : first % 2 !== 0;
  return secondary ? (firstIsMain ? second : first) : (firstIsMain ? first : second);
}

/**
 * Calendar-independent placement. No birth instant, leap-month conversion or timeline is fabricated.
 * Rules requiring unavailable inputs (e.g. day Ganzhi) are reported in omittedPlacements.
 */
export function arrangeZiweiStars(
  input: ZiweiPlacementInput,
  rawOptions: ZiweiOptions | ZiweiOptionsInput,
  bureau?: Bureau,
) {
  return arrangeModifiedStars(input, rawOptions, undefined, bureau);
}

/** @internal Also used by Chart.modify with original calendar facts as fallback inputs. */
export function arrangeModifiedStars(
  overrides: Partial<ZiweiPlacementInput>,
  rawOptions: ZiweiOptions | ZiweiOptionsInput,
  base?: ZiweiPlacementContext,
  retainedBureau?: Bureau,
  fixedFrame?: { readonly life: number; readonly body: number },
) {
  const options = rawOptions instanceof ZiweiOptions ? rawOptions : new ZiweiOptions(rawOptions);
  const changes = placementOverrides(overrides);
  const input = Object.freeze({
    ...(base ? {
      yearGanIndex: ganzhiStem(base.anchors.lunar.year),
      yearZhiIndex: ganzhiBranch(base.anchors.lunar.year),
      month: base.facts.effectiveLunarMonth, day: base.facts.lunarDate.day,
      hourZhiIndex: ganzhiBranch(base.anchors.lunar.hour),
    } : {}),
    ...changes,
  }) as ZiweiPlacementInput;
  for (const key of Object.keys(INPUT_RANGES) as (keyof ZiweiPlacementInput)[]) {
    if (input[key] === undefined) throw new RangeError(`missing placement input: ${key}`);
  }
  const yearFor = (boundary: number) => base
    ? (boundary === PILLAR_BOUNDARY.SOLAR_TERM ? base.anchors.solarTerm.year : base.anchors.lunar.year)
    : undefined;
  const palaceYear = yearFor(options.wuHuDunYearBoundary);
  const anchors = computePlacementAnchors(input.month, input.day, input.hourZhiIndex,
    changes.yearGanIndex ?? (palaceYear === undefined ? input.yearGanIndex : ganzhiStem(palaceYear)),
    options, retainedBureau);
  const values: Record<string, number | undefined> = {
    'anchor.bureau': anchors.bureau, 'anchor.ziwei': anchors.ziwei, 'anchor.tianfu': anchors.tianfu,
    'anchor.life': fixedFrame?.life ?? base?.anchors.palacePositions[0] ?? anchors.palacePositions[0],
    'anchor.body': fixedFrame?.body ?? base?.bodyPalace ?? anchors.bodyPalace, 'birth.gender': base?.facts.gender ?? options.gender,
  };
  for (const prefix of ['lunar', 'solar'] as const) {
    const pillars = base ? (prefix === 'lunar' ? base.anchors.lunar : base.anchors.solarTerm) : undefined;
    const gan = changes.yearGanIndex ?? (pillars ? ganzhiStem(pillars.year) : input.yearGanIndex);
    const zhi = changes.yearZhiIndex ?? (pillars ? ganzhiBranch(pillars.year) : input.yearZhiIndex);
    values[`${prefix}.year_stem`] = gan;
    values[`${prefix}.year_branch`] = zhi;
    values[`${prefix}.zheng_kong`] = yearKong(gan, zhi, false);
    values[`${prefix}.fu_kong`] = yearKong(gan, zhi, true);
    const month = changes.month ?? (prefix === 'solar' && pillars
      ? (ganzhiBranch(pillars.month) + 10) % 12 + 1 : input.month);
    // An unchanged calendar pillar is preserved, including historical conventions.
    if (!base || changes.month !== undefined || changes.yearGanIndex !== undefined) {
      values[`${prefix}.month_stem`] = (gan % 5 * 2 + 1 + month) % 10;
      values[`${prefix}.month_branch`] = (month + 1) % 12;
      values[`${prefix}.month_index`] = month - 1;
    }
    if (!base || changes.day !== undefined) values[`${prefix}.day_index`] = input.day - 1;
    if (!base || changes.hourZhiIndex !== undefined) {
      values[`${prefix}.hour_branch`] = input.hourZhiIndex;
      // Day Ganzhi cannot be inferred from a lunar day number without an actual date.
      values[`${prefix}.hour_stem`] = pillars
        ? (ganzhiStem(pillars.day) % 5 * 2 + input.hourZhiIndex) % 10 : undefined;
    }
  }
  const read = (source: string): number | undefined => Object.hasOwn(values, source)
    ? values[source] : base
      ? readNatalRuleInput(source, base.facts, base.anchors, base.bodyPalace) : undefined;
  const rules = selectZiweiRules(options.rules);
  const starPositions = Array<number>(rules.catalog.length).fill(-1);
  const omittedPlacements: { readonly starId: number; readonly missingInputs: readonly string[] }[] = [];
  for (const rule of rules.natalPlacements) {
    const missing = rule.inputs.filter((source) => read(source) === undefined);
    if (missing.length) {
      omittedPlacements.push(Object.freeze({ starId: rule.starId, missingInputs: Object.freeze(missing) }));
    } else {
      starPositions[rule.starId] = evaluatePlacementInputs(rule, (source) => read(source)!);
    }
  }
  const sihuaYear = yearFor(options.sihuaYearBoundary);
  const sihuaGan = changes.yearGanIndex ?? (sihuaYear === undefined ? input.yearGanIndex : ganzhiStem(sihuaYear));
  return Object.freeze({
    input, ...anchors, starCatalog: rules.catalog,
    starPositions: Object.freeze(starPositions), yearTransformations: rules.sihua[sihuaGan]!,
    omittedPlacements: Object.freeze(omittedPlacements),
  });
}

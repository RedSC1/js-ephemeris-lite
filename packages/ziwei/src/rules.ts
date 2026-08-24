import { ganzhiBranch, ganzhiIndex, ganzhiStem, type Ganzhi } from 'js-ephemeris-lite';
import type { ZiweiAnchors } from './anchors.js';
import {
  GENERATED_BRIGHTNESS_VARIANTS,
  GENERATED_MASTER_VARIANTS,
  GENERATED_PLACEMENT_VARIANTS,
  GENERATED_SIHUA_VARIANTS,
  type GeneratedPlacement,
  type GeneratedTransformSet,
} from './generated/default-rules.js';
import type { ZiweiRuleSelection } from './options.js';
import type { Brightness, TransformSet, ZiweiCalendarFacts } from './types.js';

const LONGEVITY_STAR_KEYS = new Set([
  'changsheng',
  'muyu',
  'guandai',
  'linguan',
  'diwang',
  'shuai',
  'bing',
  'si',
  'mu',
  'jue',
  'tai',
  'yang',
]);

export interface SelectedZiweiRules {
  readonly natalPlacements: readonly GeneratedPlacement[];
  readonly brightness: readonly (readonly number[])[];
  readonly sihua: readonly TransformSet[];
  readonly masters: Readonly<{
    readonly life: readonly number[];
    readonly body: readonly number[];
  }>;
}

const selectionCache = new WeakMap<ZiweiRuleSelection, SelectedZiweiRules>();

function selectedOption<T>(
  component: string,
  key: string,
  option: string,
  variants: Readonly<Record<string, T>>,
): T {
  const value = variants[option];
  if (value !== undefined) return value;
  const available = Object.keys(variants).join(', ') || '(none)';
  throw new RangeError(
    `Ziwei ${component} option "${option}" is unavailable for "${key}"; available: ${available}`,
  );
}

function assertKnownOverrides(
  component: string,
  overrides: Readonly<Record<string, string>>,
  knownKeys: ReadonlySet<string>,
): void {
  for (const key of Object.keys(overrides)) {
    if (!knownKeys.has(key)) throw new RangeError(`unknown Ziwei ${component} rule key: "${key}"`);
  }
}

/** Resolve all configured rule variants once, before chart placement begins. */
export function selectZiweiRules(selection: ZiweiRuleSelection): SelectedZiweiRules {
  const cached = selectionCache.get(selection);
  if (cached !== undefined) return cached;

  const placementKeys = new Set(GENERATED_PLACEMENT_VARIANTS.map((variant) => variant.starKey));
  const brightnessKeys = new Set(GENERATED_BRIGHTNESS_VARIANTS.map((variant) => variant.starKey));
  const stemKeys = new Set(GENERATED_SIHUA_VARIANTS.map((variant) => variant.stemKey));
  assertKnownOverrides('placement', selection.placement, placementKeys);
  assertKnownOverrides('brightness', selection.brightness, brightnessKeys);
  assertKnownOverrides('sihua', selection.sihua, stemKeys);

  const natalPlacements = Object.freeze(GENERATED_PLACEMENT_VARIANTS.map((variant) => {
    const option = LONGEVITY_STAR_KEYS.has(variant.starKey)
      ? selection.longevity
      : selection.placement[variant.starKey] ?? selection.placementDefault;
    return selectedOption('placement', variant.starKey, option, variant.options);
  }));
  const brightness = Object.freeze(GENERATED_BRIGHTNESS_VARIANTS.map((variant) => selectedOption(
    'brightness',
    variant.starKey,
    selection.brightness[variant.starKey] ?? selection.brightnessDefault,
    variant.options,
  )));
  const sihua = Object.freeze(GENERATED_SIHUA_VARIANTS.map((variant) => selectedOption(
    'sihua',
    variant.stemKey,
    selection.sihua[variant.stemKey] ?? selection.sihuaDefault,
    variant.options,
  ) as GeneratedTransformSet));
  const masters = selectedOption('masters', 'life/body', selection.masters, GENERATED_MASTER_VARIANTS);
  const resolved = Object.freeze({ natalPlacements, brightness, sihua, masters });
  selectionCache.set(selection, resolved);
  return resolved;
}

function kongWang(ganzhi: Ganzhi, secondary: boolean): number {
  const index = ganzhiIndex(ganzhi);
  const first = (10 - Math.floor(index / 10) * 2 + 12) % 12;
  const second = (first + 1) % 12;
  const yangStem = (ganzhiStem(ganzhi) & 1) === 0;
  const firstIsZheng = yangStem ? (first & 1) === 0 : (first & 1) !== 0;
  return secondary
    ? firstIsZheng ? second : first
    : firstIsZheng ? first : second;
}

function readRuleInput(
  source: string,
  facts: ZiweiCalendarFacts,
  anchors: ZiweiAnchors,
  bodyPalace: number,
): number {
  switch (source) {
    case 'anchor.bureau': return anchors.bureau;
    case 'anchor.ziwei': return anchors.ziwei;
    case 'anchor.tianfu': return anchors.tianfu;
    case 'anchor.life': return anchors.palacePositions[0]!;
    case 'anchor.body': return bodyPalace;
    case 'birth.gender': return facts.gender;
    case 'lunar.year_stem': return ganzhiStem(anchors.lunar.year);
    case 'lunar.year_branch': return ganzhiBranch(anchors.lunar.year);
    case 'lunar.month_stem': return ganzhiStem(anchors.lunar.month);
    case 'lunar.month_branch': return ganzhiBranch(anchors.lunar.month);
    case 'lunar.day_stem': return ganzhiStem(anchors.lunar.day);
    case 'lunar.day_branch': return ganzhiBranch(anchors.lunar.day);
    case 'lunar.hour_stem': return ganzhiStem(anchors.lunar.hour);
    case 'lunar.hour_branch': return ganzhiBranch(anchors.lunar.hour);
    case 'lunar.zheng_kong': return kongWang(anchors.lunar.year, false);
    case 'lunar.fu_kong': return kongWang(anchors.lunar.year, true);
    case 'lunar.month_index': return facts.effectiveLunarMonth - 1;
    case 'lunar.day_index': return facts.lunarDate.day - 1;
    case 'solar.year_stem': return ganzhiStem(anchors.solarTerm.year);
    case 'solar.year_branch': return ganzhiBranch(anchors.solarTerm.year);
    case 'solar.month_stem': return ganzhiStem(anchors.solarTerm.month);
    case 'solar.month_branch': return ganzhiBranch(anchors.solarTerm.month);
    case 'solar.day_stem': return ganzhiStem(anchors.solarTerm.day);
    case 'solar.day_branch': return ganzhiBranch(anchors.solarTerm.day);
    case 'solar.hour_stem': return ganzhiStem(anchors.solarTerm.hour);
    case 'solar.hour_branch': return ganzhiBranch(anchors.solarTerm.hour);
    case 'solar.zheng_kong': return kongWang(anchors.solarTerm.year, false);
    case 'solar.fu_kong': return kongWang(anchors.solarTerm.year, true);
    case 'solar.month_index': return (ganzhiBranch(anchors.solarTerm.month) + 10) % 12;
    case 'solar.day_index': return facts.solarDayFromPreviousJie - 1;
    default: throw new Error(`unsupported Ziwei rule input: ${source}`);
  }
}

export function evaluateNatalPlacement(
  rule: GeneratedPlacement,
  facts: ZiweiCalendarFacts,
  anchors: ZiweiAnchors,
  bodyPalace: number,
): number {
  if (rule.inputs.length === 0 || rule.inputs.length !== rule.shape.length) {
    throw new Error(`invalid placement rule for star ${rule.starId}`);
  }
  let index = 0;
  for (let input = 0; input < rule.inputs.length; input += 1) {
    const value = readRuleInput(rule.inputs[input]!, facts, anchors, bodyPalace);
    const domain = rule.shape[input]!;
    if (!Number.isInteger(value) || value < 0 || value >= domain) {
      throw new Error(`rule input ${rule.inputs[input]} is outside 0..${domain - 1}`);
    }
    index = index * domain + value;
  }
  const branch = rule.positions[index];
  if (branch === undefined || branch < 0 || branch >= 12) {
    throw new Error(`invalid placement result for star ${rule.starId}`);
  }
  return branch;
}

export function brightnessAt(
  rules: SelectedZiweiRules,
  starId: number,
  branch: number,
): Brightness {
  const value = rules.brightness[starId]?.[branch];
  if (value === undefined || value < -1 || value > 6) {
    throw new RangeError('invalid star or branch');
  }
  return value as Brightness;
}

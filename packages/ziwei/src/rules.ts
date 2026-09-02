import { ganzhiBranch, ganzhiIndex, ganzhiStem, type Ganzhi } from 'js-ephemeris-lite';
import type { ZiweiAnchors } from './anchors.js';
import {
  GENERATED_BRIGHTNESS_VARIANTS,
  GENERATED_FLOW_PLACEMENT_VARIANTS,
  GENERATED_MASTER_VARIANTS,
  GENERATED_PLACEMENT_VARIANTS,
  GENERATED_SIHUA_VARIANTS,
  type GeneratedMasterVariant,
  type GeneratedPlacement,
  type GeneratedTransformSet,
} from './generated/default-rules.js';
import type { ZiweiRuleSelection } from './options.js';
import type { Brightness, TransformSet, ZiweiCalendarFacts } from './types.js';
import { STAR_CATALOG, type StarInfo } from './stars.js';

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
  readonly catalog: readonly StarInfo[];
  readonly natalPlacements: readonly GeneratedPlacement[];
  readonly flowPlacements: readonly GeneratedPlacement[];
  readonly brightness: readonly (readonly number[])[];
  readonly brightnessLabels: Readonly<Record<string, string>>;
  readonly sihua: readonly TransformSet[];
  readonly masters: GeneratedMasterVariant;
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

  const placementKeys = new Set([
    ...GENERATED_PLACEMENT_VARIANTS.map((variant) => variant.starKey),
    ...GENERATED_FLOW_PLACEMENT_VARIANTS.map((variant) => variant.starKey),
  ]);
  const brightnessKeys = new Set(GENERATED_BRIGHTNESS_VARIANTS.map((variant) => variant.starKey));
  const stemKeys = new Set(GENERATED_SIHUA_VARIANTS.map((variant) => variant.stemKey));
  assertKnownOverrides('placement', selection.placement, placementKeys);
  assertKnownOverrides('brightness', selection.brightness, brightnessKeys);
  assertKnownOverrides('sihua', selection.sihua, stemKeys);

  const initialNatalPlacements = GENERATED_PLACEMENT_VARIANTS.map((variant) => {
    const option = LONGEVITY_STAR_KEYS.has(variant.starKey)
      ? selection.longevity
      : selection.placement[variant.starKey] ?? selection.placementDefault;
    return selectedOption('placement', variant.starKey, option, variant.options);
  });
  const initialFlowPlacements = GENERATED_FLOW_PLACEMENT_VARIANTS.map((variant) => {
    const option = selection.placement[variant.starKey] ?? selection.placementDefault;
    return selectedOption('placement', variant.starKey, option, variant.options);
  });
  const brightness = GENERATED_BRIGHTNESS_VARIANTS.map((variant) => selectedOption(
    'brightness',
    variant.starKey,
    selection.brightness[variant.starKey] ?? selection.brightnessDefault,
    variant.options,
  ));
  const sihua = GENERATED_SIHUA_VARIANTS.map((variant) => selectedOption(
    'sihua',
    variant.stemKey,
    selection.sihua[variant.stemKey] ?? selection.sihuaDefault,
    variant.options,
  ) as GeneratedTransformSet);
  let masters = selectedOption('masters', 'life/body', selection.masters, GENERATED_MASTER_VARIANTS);

  const catalog = [...STAR_CATALOG];
  const stableCatalogStarCount = catalog.length;
  const starIds = new Map(catalog.map((star) => [star.key, star.id]));
  const natalPlacements = new Map(initialNatalPlacements.map((rule) => [rule.starId, rule]));
  const flowPlacements = new Map(initialFlowPlacements.map((rule) => [rule.starId, rule]));
  const brightnessLabels: Record<string, string> = {
    '-1': '', '0': '陷', '1': '不', '2': '平', '3': '利', '4': '得', '5': '旺', '6': '庙',
  };
  const starId = (reference: number | string, label: string): number => {
    if (typeof reference === 'number' && reference >= stableCatalogStarCount) {
      throw new RangeError(
        `${label} uses an unstable numeric id for a user-added star; use its star key instead`,
      );
    }
    const id = typeof reference === 'number' ? reference : starIds.get(reference);
    if (id === undefined || catalog[id] === undefined) throw new RangeError(`${label} references unknown star: ${reference}`);
    return id;
  };

  for (const module of selection.ruleset.modules) {
    const patch = module.patch;
    for (const definition of patch.stars ?? []) {
      const existingId = starIds.get(definition.key);
      if (existingId !== undefined) {
        const existing = catalog[existingId]!;
        if (existing.natal !== definition.natal) {
          throw new RangeError(`${module.label}.${definition.key} cannot change natal/flow scope`);
        }
        if (definition.category !== undefined && definition.category !== existing.category) {
          throw new RangeError(`${module.label}.${definition.key} cannot change a catalog star category`);
        }
        continue;
      }
      const id = catalog.length;
      const added = Object.freeze({
        id,
        key: definition.key,
        category: definition.category ?? (definition.natal ? 'custom' : 'other'),
        natal: definition.natal,
      });
      catalog.push(added);
      starIds.set(added.key, id);
      brightness[id] = Object.freeze(Array<number>(12).fill(-1));
    }
    for (const [key, rule] of Object.entries(patch.natalPlacements ?? {})) {
      const id = starId(key, `${module.label}.natalPlacements`);
      if (!catalog[id]!.natal) throw new RangeError(`${module.label}.${key} is not a natal star`);
      natalPlacements.set(id, Object.freeze({ starId: id, ...rule }));
    }
    for (const [key, rule] of Object.entries(patch.flowPlacements ?? {})) {
      const id = starId(key, `${module.label}.flowPlacements`);
      if (catalog[id]!.natal) throw new RangeError(`${module.label}.${key} is not a flow star`);
      flowPlacements.set(id, Object.freeze({ starId: id, ...rule }));
    }
    for (const [key, values] of Object.entries(patch.brightness ?? {})) {
      brightness[starId(key, `${module.label}.brightness`)] = values;
    }
    for (const [stem, set] of Object.entries(patch.sihua ?? {})) {
      const index = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'].indexOf(stem);
      if (index < 0) throw new RangeError(`unknown sihua stem: ${stem}`);
      const resolved: Partial<Record<keyof GeneratedTransformSet, number>> = {};
      for (const key of ['lu', 'quan', 'ke', 'ji'] as const) {
        if (set[key] !== undefined) resolved[key] = starId(set[key], `${module.label}.sihua.${stem}.${key}`);
      }
      sihua[index] = Object.freeze({ ...sihua[index]!, ...resolved }) as GeneratedTransformSet;
    }
    if (patch.masters !== undefined) {
      const resolveMaster = (value: NonNullable<typeof patch.masters>['life']): GeneratedMasterVariant['life'] | undefined => value === undefined
        ? undefined
        : Object.freeze({
          input: value.input,
          stars: Object.freeze(value.stars.map((star) => starId(star, `${module.label}.masters`))),
        });
      masters = Object.freeze({
        life: resolveMaster(patch.masters.life) ?? masters.life,
        body: resolveMaster(patch.masters.body) ?? masters.body,
      });
    }
    Object.assign(brightnessLabels, patch.brightnessLabels);
  }
  const resolved = Object.freeze({
    catalog: Object.freeze(catalog),
    natalPlacements: Object.freeze([...natalPlacements.values()].sort((a, b) => a.starId - b.starId)),
    flowPlacements: Object.freeze([...flowPlacements.values()].sort((a, b) => a.starId - b.starId)),
    brightness: Object.freeze(brightness),
    brightnessLabels: Object.freeze(brightnessLabels),
    sihua: Object.freeze(sihua),
    masters,
  });
  selectionCache.set(selection, resolved);
  return resolved;
}

/** Evaluate a flow-star table against the formal layer coordinate. */
export function evaluateFlowPlacement(
  rule: GeneratedPlacement,
  coordinate: { readonly stem: number; readonly branch: number },
  gender: number,
  anchors?: {
    readonly bureau: number;
    readonly ziwei: number;
    readonly tianfu: number;
    readonly life: number;
    readonly body: number;
  },
): number {
  let index = 0;
  for (let input = 0; input < rule.inputs.length; input += 1) {
    const source = rule.inputs[input]!;
    const value = source === 'lunar.year_stem' || source === 'solar.year_stem'
      ? coordinate.stem
      : source === 'lunar.year_branch' || source === 'solar.year_branch'
        ? coordinate.branch
        : source === 'birth.gender'
          ? gender
          : source === 'anchor.bureau'
            ? anchors?.bureau
            : source === 'anchor.ziwei'
              ? anchors?.ziwei
              : source === 'anchor.tianfu'
                ? anchors?.tianfu
                : source === 'anchor.life'
                  ? anchors?.life
                  : source === 'anchor.body'
                    ? anchors?.body
                    : Number.NaN;
    const domain = rule.shape[input]!;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= domain) {
      throw new Error(`unsupported or invalid flow rule input: ${source}`);
    }
    index = index * domain + value;
  }
  const branch = rule.positions[index];
  if (branch === undefined || branch < 0 || branch >= 12) {
    throw new Error(`invalid flow placement result for star ${rule.starId}`);
  }
  return branch;
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
  if (rule.inputs.length !== rule.shape.length) {
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

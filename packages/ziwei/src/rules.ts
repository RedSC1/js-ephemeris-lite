import { ganzhiBranch, ganzhiIndex, ganzhiStem, type Ganzhi } from 'js-ephemeris-lite';
import type { ZiweiAnchors } from './anchors.js';
import {
  GENERATED_BRIGHTNESS,
  GENERATED_MASTERS,
  GENERATED_NATAL_PLACEMENTS,
  GENERATED_SIHUA,
  type GeneratedPlacement,
} from './generated/default-rules.js';
import type { Brightness, TransformSet, ZiweiCalendarFacts } from './types.js';

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

export const NATAL_PLACEMENT_RULES = GENERATED_NATAL_PLACEMENTS;
export const SIHUA_BY_STEM: readonly TransformSet[] = GENERATED_SIHUA;
export const MASTER_STARS = GENERATED_MASTERS;

export function brightnessAt(starId: number, branch: number): Brightness {
  const value = GENERATED_BRIGHTNESS[starId]?.[branch];
  if (value === undefined || value < -1 || value > 6) {
    throw new RangeError('invalid star or branch');
  }
  return value as Brightness;
}

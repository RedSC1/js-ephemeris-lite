import type {
  GeneratedMasterLookup,
  GeneratedPlacement,
} from './generated/default-rules.js';
import { findStarId, getStar, requireStarId } from './stars.js';

export type ZiweiCompiledPlacement = Omit<GeneratedPlacement, 'starId'>;
export type ZiweiMasterLookupPatch = {
  readonly input: GeneratedMasterLookup['input'];
  readonly stars: readonly (number | string)[];
};

/** Runtime rule resources layered after the bundled option tables. */
export interface ZiweiRulePatch {
  readonly natalPlacements?: Readonly<Record<string, ZiweiCompiledPlacement>>;
  readonly flowPlacements?: Readonly<Record<string, ZiweiCompiledPlacement>>;
  readonly brightness?: Readonly<Record<string, readonly number[]>>;
  readonly brightnessLabels?: Readonly<Record<string | number, string>>;
  readonly sihua?: Readonly<Record<string, {
    readonly lu?: number | string;
    readonly quan?: number | string;
    readonly ke?: number | string;
    readonly ji?: number | string;
  }>>;
  readonly masters?: {
    readonly life?: ZiweiMasterLookupPatch;
    readonly body?: ZiweiMasterLookupPatch;
  };
}

export interface ZiweiJsonRuleOverrides {
  readonly starsJson?: string;
  readonly brightnessJson?: string;
  readonly sihuaJson?: string;
  readonly flowJson?: string;
  readonly mastersJson?: string;
}

const STEM_KEYS = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'];
const BRANCH_KEYS = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
const BUREAU_KEYS = ['water2', 'wood3', 'metal4', 'earth5', 'fire6'];
const INPUT_DOMAINS: Readonly<Record<string, number>> = Object.freeze({
  'anchor.bureau': 5,
  'anchor.ziwei': 12,
  'anchor.tianfu': 12,
  'anchor.life': 12,
  'anchor.body': 12,
  'birth.gender': 2,
  'lunar.year_stem': 10,
  'lunar.year_branch': 12,
  'lunar.month_stem': 10,
  'lunar.month_branch': 12,
  'lunar.day_stem': 10,
  'lunar.day_branch': 12,
  'lunar.hour_stem': 10,
  'lunar.hour_branch': 12,
  'lunar.zheng_kong': 12,
  'lunar.fu_kong': 12,
  'lunar.month_index': 12,
  'lunar.day_index': 30,
  'solar.year_stem': 10,
  'solar.year_branch': 12,
  'solar.month_stem': 10,
  'solar.month_branch': 12,
  'solar.day_stem': 10,
  'solar.day_branch': 12,
  'solar.hour_stem': 10,
  'solar.hour_branch': 12,
  'solar.zheng_kong': 12,
  'solar.fu_kong': 12,
  'solar.month_index': 12,
  'solar.day_index': 32,
});

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as JsonObject;
}

function parseJson(source: string, label: string): unknown {
  try { return JSON.parse(source); } catch (error) {
    throw new SyntaxError(`${label} is invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function mod12(value: number): number { return ((value % 12) + 12) % 12; }

function boundaryOf(rule: JsonObject, inherited = 'lunar'): 'lunar' | 'solar' {
  const value = rule.boundary ?? inherited;
  if (value !== 'lunar' && value !== 'solar') throw new RangeError(`unknown rule boundary: ${String(value)}`);
  return value;
}

function sourceFor(raw: string, boundary: 'lunar' | 'solar'): string {
  switch (raw) {
    case 'ziwei': return 'anchor.ziwei';
    case 'tianfu': return 'anchor.tianfu';
    case 'ming': return 'anchor.life';
    case 'body':
    case 'shen': return 'anchor.body';
    case 'wuxingjv': return 'anchor.bureau';
    case 'month': return `${boundary}.month_index`;
    case 'day':
    case 'day_number': return `${boundary}.day_index`;
    case 'hour': return `${boundary}.hour_branch`;
    case 'year_stem': return `${boundary}.year_stem`;
    case 'year_branch': return `${boundary}.year_branch`;
    case 'month_stem': return `${boundary}.month_stem`;
    case 'month_branch': return `${boundary}.month_branch`;
    case 'zheng_kong': return `${boundary}.zheng_kong`;
    case 'fu_kong': return `${boundary}.fu_kong`;
    default: throw new RangeError(`unsupported runtime rule anchor: ${raw}`);
  }
}

function lookupKey(source: string, value: number): string {
  if (source.endsWith('_stem')) return STEM_KEYS[value] ?? String(value);
  if (source.endsWith('_branch')) return BRANCH_KEYS[value] ?? String(value);
  if (source === 'anchor.bureau') return BUREAU_KEYS[value] ?? String(value);
  return String(value);
}

function direction(rule: JsonObject, values: Readonly<Record<string, number>>, boundary: 'lunar' | 'solar'): number {
  const value = rule.direction;
  if (value === -1 || value === 'ni') return -1;
  if (value !== 'gender_shun_ni') return 1;
  const gender = values['birth.gender'];
  const stem = values[`${boundary}.year_stem`];
  if (gender === undefined || stem === undefined) throw new Error('gender_shun_ni inputs were not compiled');
  return (stem & 1) === gender ? 1 : -1;
}

function collectRuleInputs(ruleValue: unknown, inherited: 'lunar' | 'solar', result: string[]): void {
  const rule = asObject(ruleValue, 'star rule');
  const boundary = boundaryOf(rule, inherited);
  const add = (source: string): void => { if (!result.includes(source)) result.push(source); };
  const type = String(rule.type ?? '');
  if (type === 'pipeline') {
    const steps = rule.steps;
    if (!Array.isArray(steps)) throw new TypeError('pipeline.steps must be an array');
    for (const step of steps) collectRuleInputs(step, boundary, result);
    return;
  }
  if (type === 'constant') return;
  const anchor = rule.anchor;
  if (typeof anchor !== 'string') throw new TypeError(`${type}.anchor must be a string`);
  add(sourceFor(anchor, boundary));
  if (type === 'lookup_offset') {
    if (typeof rule.shift_anchor !== 'string') throw new TypeError('lookup_offset.shift_anchor must be a string');
    add(sourceFor(rule.shift_anchor, boundary));
  }
  if (rule.direction === 'gender_shun_ni') {
    add('birth.gender');
    add(`${boundary}.year_stem`);
  }
}

function evaluateJsonRule(
  ruleValue: unknown,
  inherited: 'lunar' | 'solar',
  values: Readonly<Record<string, number>>,
): number {
  const rule = asObject(ruleValue, 'star rule');
  const boundary = boundaryOf(rule, inherited);
  const type = String(rule.type ?? '');
  if (type === 'constant') return Number(rule.value ?? 0);
  if (type === 'pipeline') {
    if (!Array.isArray(rule.steps)) throw new TypeError('pipeline.steps must be an array');
    return rule.steps.reduce((sum: number, step) => sum + evaluateJsonRule(step, boundary, values), 0);
  }
  if (typeof rule.anchor !== 'string') throw new TypeError(`${type}.anchor must be a string`);
  const source = sourceFor(rule.anchor, boundary);
  const anchorValue = values[source];
  if (anchorValue === undefined) throw new Error(`missing compiled input ${source}`);
  const dir = direction(rule, values, boundary);
  if (type === 'anchor_offset') {
    const offset = Number(rule.offset ?? 0);
    const isTime = ['month', 'day', 'day_number', 'hour', 'year'].includes(rule.anchor);
    return isTime ? offset + anchorValue * dir : anchorValue + offset * dir;
  }
  const table = asObject(rule.table, `${type}.table`);
  const base = table[lookupKey(source, anchorValue)];
  if (typeof base !== 'number') throw new RangeError(`${type} table has no value for ${lookupKey(source, anchorValue)}`);
  if (type === 'lookup') return base + Number(rule.offset ?? 0) * dir;
  if (type === 'lookup_offset') {
    if (typeof rule.shift_anchor !== 'string') throw new TypeError('lookup_offset.shift_anchor must be a string');
    const shiftSource = sourceFor(rule.shift_anchor, boundary);
    const shift = values[shiftSource];
    if (shift === undefined) throw new Error(`missing compiled input ${shiftSource}`);
    return base + shift * dir;
  }
  throw new RangeError(`unsupported runtime rule type: ${type}`);
}

/** Compile the former Dart JSON rule schema once into the lite engine's flat answer table. */
export function compileZiweiJsonPlacement(rule: unknown): ZiweiCompiledPlacement {
  const inputs: string[] = [];
  collectRuleInputs(rule, 'lunar', inputs);
  const shape = inputs.map((input) => {
    const domain = INPUT_DOMAINS[input];
    if (domain === undefined) throw new RangeError(`unsupported runtime rule input: ${input}`);
    return domain;
  });
  const count = shape.reduce((value, domain) => value * domain, 1);
  const positions = Array<number>(count);
  for (let flat = 0; flat < count; flat += 1) {
    let remainder = flat;
    const values: Record<string, number> = {};
    for (let index = shape.length - 1; index >= 0; index -= 1) {
      values[inputs[index]!] = remainder % shape[index]!;
      remainder = Math.floor(remainder / shape[index]!);
    }
    positions[flat] = mod12(evaluateJsonRule(rule, 'lunar', values));
  }
  return Object.freeze({
    inputs: Object.freeze(inputs),
    shape: Object.freeze(shape),
    positions: Object.freeze(positions),
  });
}

function normalizePlacement(key: string, value: ZiweiCompiledPlacement): ZiweiCompiledPlacement {
  if (findStarId(key) === undefined) throw new RangeError(`unknown star key: ${key}`);
  if (value.inputs.length !== value.shape.length) throw new RangeError(`${key} placement input/shape mismatch`);
  const count = value.shape.reduce((n, domain) => {
    if (!Number.isInteger(domain) || domain < 1) throw new RangeError(`${key} has an invalid placement domain`);
    return n * domain;
  }, 1);
  if (value.positions.length !== count) throw new RangeError(`${key} placement table length must be ${count}`);
  for (const branch of value.positions) if (!Number.isInteger(branch) || branch < 0 || branch >= 12) {
    throw new RangeError(`${key} placement contains an invalid branch`);
  }
  return Object.freeze({
    inputs: Object.freeze([...value.inputs]),
    shape: Object.freeze([...value.shape]),
    positions: Object.freeze([...value.positions]),
  });
}

function normalizeBrightness(key: string, values: readonly number[]): readonly number[] {
  requireStarId(key);
  if (values.length !== 12 || values.some((v) => !Number.isInteger(v) || v < -1 || v > 6)) {
    throw new RangeError(`${key} brightness must contain twelve values in -1..6`);
  }
  return Object.freeze([...values]);
}

function starId(value: number | string): number {
  return typeof value === 'string' ? requireStarId(value) : getStar(value).id;
}

function normalizeMaster(value: ZiweiMasterLookupPatch): GeneratedMasterLookup {
  if (!['anchor.life', 'lunar.year_branch', 'solar.year_branch', 'master.year_branch'].includes(value.input)) {
    throw new RangeError(`unsupported master input: ${value.input}`);
  }
  if (value.stars.length !== 12) throw new RangeError('master lookup must contain twelve stars');
  return Object.freeze({ input: value.input, stars: Object.freeze(value.stars.map(starId)) });
}

function mergeRecords<T>(base: Readonly<Record<string, T>> | undefined, patch: Readonly<Record<string, T>> | undefined): Readonly<Record<string, T>> | undefined {
  if (base === undefined && patch === undefined) return undefined;
  return Object.freeze({ ...(base ?? {}), ...(patch ?? {}) });
}

export class ZiweiRuleset {
  readonly patch: ZiweiRulePatch;

  constructor(patch: ZiweiRulePatch = {}) {
    const natalPlacements = Object.fromEntries(Object.entries(patch.natalPlacements ?? {}).map(
      ([key, value]) => [key, normalizePlacement(key, value)],
    ));
    const flowPlacements = Object.fromEntries(Object.entries(patch.flowPlacements ?? {}).map(
      ([key, value]) => [key, normalizePlacement(key, value)],
    ));
    const brightness = Object.fromEntries(Object.entries(patch.brightness ?? {}).map(
      ([key, value]) => [key, normalizeBrightness(key, value)],
    ));
    const brightnessLabels = Object.fromEntries(Object.entries(patch.brightnessLabels ?? {}).map(([key, label]) => {
      const value = Number(key);
      if (!Number.isInteger(value) || value < -1 || value > 6 || typeof label !== 'string') {
        throw new RangeError(`invalid brightness label: ${key}`);
      }
      return [String(value), label];
    }));
    const sihua = Object.fromEntries(Object.entries(patch.sihua ?? {}).map(([stem, set]) => {
      if (!STEM_KEYS.includes(stem)) throw new RangeError(`unknown sihua stem: ${stem}`);
      const result: Record<string, number> = {};
      for (const key of ['lu', 'quan', 'ke', 'ji'] as const) {
        if (set[key] !== undefined) result[key] = starId(set[key]);
      }
      if (Object.keys(result).length === 0) throw new RangeError(`sihua.${stem} is empty`);
      return [stem, Object.freeze(result)];
    }));
    this.patch = Object.freeze({
      natalPlacements: Object.freeze(natalPlacements),
      flowPlacements: Object.freeze(flowPlacements),
      brightness: Object.freeze(brightness),
      brightnessLabels: Object.freeze(brightnessLabels),
      sihua: Object.freeze(sihua),
      ...(patch.masters === undefined ? {} : {
        masters: Object.freeze({
          ...(patch.masters.life === undefined ? {} : { life: normalizeMaster(patch.masters.life) }),
          ...(patch.masters.body === undefined ? {} : { body: normalizeMaster(patch.masters.body) }),
        }),
      }),
    });
    Object.freeze(this);
  }

  with(patch: ZiweiRulePatch): ZiweiRuleset {
    return new ZiweiRuleset({
      natalPlacements: mergeRecords(this.patch.natalPlacements, patch.natalPlacements),
      flowPlacements: mergeRecords(this.patch.flowPlacements, patch.flowPlacements),
      brightness: mergeRecords(this.patch.brightness, patch.brightness),
      brightnessLabels: mergeRecords(this.patch.brightnessLabels, patch.brightnessLabels),
      sihua: mergeRecords(this.patch.sihua, patch.sihua),
      masters: {
        ...this.patch.masters,
        ...patch.masters,
      },
    });
  }
}

function parseBrightnessJson(source: string): {
  brightness: Record<string, readonly number[]>;
  labels: Record<string, string>;
} {
  const raw = asObject(parseJson(source, 'brightnessJson'), 'brightnessJson');
  const result: Record<string, readonly number[]> = {};
  const labels: Record<string, string> = {};
  const read = (value: unknown): void => {
    const table = asObject(value, 'brightness table');
    for (const [key, entry] of Object.entries(table)) if (Array.isArray(entry)) result[key] = entry.map(Number);
  };
  if (raw.static_stars !== undefined) read(raw.static_stars);
  if (raw.flow_stars !== undefined) read(raw.flow_stars);
  if (raw.brightness_labels !== undefined) {
    for (const [key, value] of Object.entries(asObject(raw.brightness_labels, 'brightness_labels'))) {
      labels[key] = String(value);
    }
  }
  for (const [key, entry] of Object.entries(raw)) if (Array.isArray(entry)) result[key] = entry.map(Number);
  return { brightness: result, labels };
}

function parseSihuaJson(source: string): ZiweiRulePatch['sihua'] {
  const raw = asObject(parseJson(source, 'sihuaJson'), 'sihuaJson');
  return Object.fromEntries(Object.entries(raw).map(([stem, value]) => {
    const set = asObject(value, `sihua.${stem}`);
    const result: Record<string, string | number> = {};
    for (const key of ['lu', 'quan', 'ke', 'ji']) {
      if (set[key] === undefined) continue;
      if (typeof set[key] !== 'string' && typeof set[key] !== 'number') {
        throw new TypeError(`sihua.${stem}.${key} must be a star key or id`);
      }
      result[key] = set[key] as string | number;
    }
    return [stem, result];
  }));
}

function parseStarsJson(source: string, natal: boolean): Record<string, ZiweiCompiledPlacement> {
  const raw = parseJson(source, natal ? 'starsJson' : 'flowJson');
  if (!Array.isArray(raw)) throw new TypeError(`${natal ? 'starsJson' : 'flowJson'} must be an array`);
  return Object.fromEntries(raw.map((entry, index) => {
    const star = asObject(entry, `star[${index}]`);
    if (typeof star.key !== 'string') throw new TypeError(`star[${index}].key must be a string`);
    if (star.rule === undefined) throw new TypeError(`star[${index}].rule is required`);
    return [star.key, compileZiweiJsonPlacement(star.rule)];
  }));
}

function parseFlowJson(source: string): {
  placements: Record<string, ZiweiCompiledPlacement>;
  brightness: Record<string, readonly number[]>;
} {
  const raw = parseJson(source, 'flowJson');
  if (!Array.isArray(raw)) throw new TypeError('flowJson must be an array');
  const placements: Record<string, ZiweiCompiledPlacement> = {};
  const brightness: Record<string, readonly number[]> = {};
  raw.forEach((entry, index) => {
    const star = asObject(entry, `flow[${index}]`);
    if (typeof star.key !== 'string') throw new TypeError(`flow[${index}].key must be a string`);
    if (star.rule === undefined) throw new TypeError(`flow[${index}].rule is required`);
    placements[star.key] = compileZiweiJsonPlacement(star.rule);
    if (Array.isArray(star.brightness)) brightness[star.key] = star.brightness.map(Number);
  });
  return { placements, brightness };
}

function parseMastersJson(source: string): ZiweiRulePatch['masters'] {
  const raw = asObject(parseJson(source, 'mastersJson'), 'mastersJson');
  const parseOne = (value: unknown, life: boolean): ZiweiMasterLookupPatch => {
    const rule = asObject(value, 'master rule');
    const table = asObject(rule.table, 'master.table');
    const stars = Array.from({ length: 12 }, (_, index) => {
      const star = table[String(index)];
      if (typeof star !== 'string' && typeof star !== 'number') throw new TypeError(`master.table.${index} is required`);
      return star;
    });
    const boundary = rule.boundary;
    return {
      input: boundary === 'solar'
        ? 'solar.year_branch'
        : boundary === 'lunar'
          ? 'lunar.year_branch'
          : life ? 'anchor.life' : 'master.year_branch',
      stars,
    };
  };
  return {
    ...(raw.ming_zhu === undefined ? {} : { life: parseOne(raw.ming_zhu, true) }),
    ...(raw.shen_zhu === undefined ? {} : { body: parseOne(raw.shen_zhu, false) }),
  };
}

/** Compatibility loader for rule profiles saved by the former Dart app. */
export class ZiweiConfigLoader {
  static getDefault(): ZiweiRuleset { return new ZiweiRuleset(); }

  static overrideWith(base: ZiweiRuleset, overrides: ZiweiJsonRuleOverrides): ZiweiRuleset {
    const flow = overrides.flowJson ? parseFlowJson(overrides.flowJson) : undefined;
    const explicitBrightness = overrides.brightnessJson
      ? parseBrightnessJson(overrides.brightnessJson)
      : undefined;
    const patch: ZiweiRulePatch = {
      ...(overrides.starsJson ? { natalPlacements: parseStarsJson(overrides.starsJson, true) } : {}),
      ...(flow ? { flowPlacements: flow.placements } : {}),
      ...((flow || explicitBrightness) ? {
        brightness: { ...flow?.brightness, ...explicitBrightness?.brightness },
      } : {}),
      ...(explicitBrightness && Object.keys(explicitBrightness.labels).length > 0
        ? { brightnessLabels: explicitBrightness.labels }
        : {}),
      ...(overrides.sihuaJson ? { sihua: parseSihuaJson(overrides.sihuaJson) } : {}),
      ...(overrides.mastersJson ? { masters: parseMastersJson(overrides.mastersJson) } : {}),
    };
    return base.with(patch);
  }
}

/** Short compatibility name used by the former Dart package. */
export { ZiweiConfigLoader as ConfigLoader };

import { ZiweiOptions, type ZiweiOptionsInput } from './options.js';
import { ZiweiPlate, buildZiweiPlate, type ZiweiPalaceState, type ZiweiPlateAnchors } from './plate.js';
import { arrangeModifiedStars, placementOverrides, type ZiweiModification,
  type ZiweiModifyInput, type ZiweiPlacementInput } from './placement.js';
import { selectZiweiRules, type SelectedZiweiRules } from './rules.js';
import type { StarInfo } from './stars.js';
import type { Bureau, TransformSet } from './types.js';

/** 60 paired year stems/branches × 12 months × 30 days × 12 hour branches. */
export const ZIWEI_CASTING_SPACE_SIZE = 259200;

export type ZiweiCastingSource =
  | Readonly<{ method: 'manual' }>
  | Readonly<{ method: 'index' | 'random'; index: number; algorithm: 'index-v1' }>
  | Readonly<{ method: 'number'; number: string; index: number; algorithm: 'number-v1' }>;

/** Uniform unsigned 32-bit integers; injectable for reproducible tests or non-Web-Crypto hosts. */
export type ZiweiRandomUint32 = () => number;

function inputFromIndex(index: number): ZiweiPlacementInput {
  if (!Number.isInteger(index) || index < 0 || index >= ZIWEI_CASTING_SPACE_SIZE) {
    throw new RangeError(`index must be 0..${ZIWEI_CASTING_SPACE_SIZE - 1}`);
  }
  const hourZhiIndex = index % 12;
  index = Math.floor(index / 12);
  const day = index % 30 + 1;
  index = Math.floor(index / 30);
  const month = index % 12 + 1;
  const year = Math.floor(index / 12);
  return Object.freeze({ yearGanIndex: year % 10, yearZhiIndex: year % 12, month, day, hourZhiIndex });
}

function secureUint32(): number {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Web Crypto is unavailable; pass a randomUint32 source to ZiweiCastingChart.random');
  }
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
}

function randomIndex(randomUint32: ZiweiRandomUint32): number {
  if (typeof randomUint32 !== 'function') throw new TypeError('randomUint32 must be a function');
  // Reject the incomplete final block instead of introducing modulo bias.
  const limit = Math.floor(0x100000000 / ZIWEI_CASTING_SPACE_SIZE) * ZIWEI_CASTING_SPACE_SIZE;
  for (let attempt = 0; attempt < 128; attempt++) {
    const value = randomUint32();
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
      throw new RangeError('randomUint32 must return an integer in 0..4294967295');
    }
    if (value < limit) return value % ZIWEI_CASTING_SPACE_SIZE;
  }
  throw new Error('randomUint32 repeatedly returned values outside the accepted sampling range');
}

function normalizedNumber(value: number | bigint | string): string {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('number must be a non-negative safe integer');
    return String(value);
  }
  if (typeof value === 'bigint') {
    if (value < 0n) throw new RangeError('number must be non-negative');
    return value.toString();
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new TypeError('number must be a non-negative integer or decimal digit string');
  }
  return BigInt(value).toString();
}

/** Versioned deterministic mapping, not a source of fresh entropy or a traditional divination rule. */
function numberGenerator(number: string): ZiweiRandomUint32 {
  let state = 0x811c9dc5;
  // FNV-1a over canonical ASCII decimal text, followed by Mulberry32 output mixing.
  for (const char of `ziwei-casting-number-v1:${number}`) {
    state = Math.imul(state ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
}

/** A calendar-free plate: direct parameters, reported numbers or random sampling. */
export class ZiweiCastingChart extends ZiweiPlate {
  readonly options: ZiweiOptions;
  readonly casting: ZiweiCastingSource;
  readonly placementInput: Readonly<ZiweiPlacementInput>;
  readonly modification: ZiweiModification | null;
  readonly anchors: ZiweiPlateAnchors;
  readonly bodyPalace: number;
  readonly lifeMaster: number;
  readonly bodyMaster: number;
  readonly palaceStems: readonly number[];
  readonly palaces: readonly ZiweiPalaceState[];
  readonly yearTransformations: TransformSet;
  readonly starCatalog: readonly StarInfo[];
  readonly starPositions: readonly number[];
  readonly transformationMasks: readonly number[];
  readonly omittedPlacements: readonly { readonly starId: number; readonly missingInputs: readonly string[] }[];
  protected readonly ruleTables: SelectedZiweiRules;
  private readonly originalChart: ZiweiCastingChart | null;

  private constructor(
    input: ZiweiPlacementInput, rawOptions: ZiweiOptions | ZiweiOptionsInput,
    setup: {
      casting: ZiweiCastingSource;
      bureau?: Bureau;
      original?: ZiweiCastingChart;
      modification?: ZiweiModification;
      preserved?: ZiweiCastingChart;
    },
  ) {
    super();
    this.options = rawOptions instanceof ZiweiOptions ? rawOptions : new ZiweiOptions(rawOptions);
    this.ruleTables = selectZiweiRules(this.options.rules);
    const original = setup.original;
    const preserved = setup.preserved;
    const placement = preserved ? null : arrangeModifiedStars(input, this.options, undefined,
      original && !setup.modification!.updateBureau ? original.anchors.bureau : setup.bureau,
      original ? { life: original.anchors.palacePositions[0]!, body: original.bodyPalace } : undefined);
    this.originalChart = original ?? null;
    this.modification = setup.modification ?? null;
    this.casting = Object.freeze({ ...setup.casting });
    this.placementInput = preserved?.placementInput ?? placement!.input;
    this.omittedPlacements = preserved?.omittedPlacements ?? placement!.omittedPlacements;
    this.anchors = Object.freeze({
      bureau: preserved?.anchors.bureau ?? placement!.bureau,
      ziwei: preserved?.anchors.ziwei ?? placement!.ziwei,
      tianfu: preserved?.anchors.tianfu ?? placement!.tianfu,
      palacePositions: original ? Object.freeze(original.anchors.palacePositions.map(
        branch => (branch + setup.modification!.lifePalaceShift) % 12,
      )) : placement!.palacePositions,
    });
    this.bodyPalace = original?.bodyPalace ?? placement!.bodyPalace;
    this.palaceStems = original?.palaceStems ?? placement!.palaceStems;
    this.starCatalog = this.ruleTables.catalog;
    this.yearTransformations = preserved?.yearTransformations ?? placement!.yearTransformations;
    const plate = buildZiweiPlate(this.ruleTables, this.anchors, this.palaceStems,
      preserved?.starPositions ?? placement!.starPositions, this.yearTransformations);
    this.starPositions = plate.starPositions;
    this.palaces = plate.palaces;
    this.transformationMasks = plate.transformationMasks;
    const life = this.ruleTables.masters.life;
    const body = this.ruleTables.masters.body;
    this.lifeMaster = original?.lifeMaster ?? life.stars[
      life.input === 'anchor.life' ? this.anchors.palacePositions[0]! : this.placementInput.yearZhiIndex]!;
    this.bodyMaster = original?.bodyMaster ?? body.stars[
      body.input === 'anchor.life' ? this.anchors.palacePositions[0]! : this.placementInput.yearZhiIndex]!;
    Object.freeze(this);
  }

  /** Assemble a plate without requiring a real calendar date. */
  static fromInput(input: ZiweiPlacementInput, options: ZiweiOptions | ZiweiOptionsInput, bureau?: Bureau): ZiweiCastingChart {
    return new ZiweiCastingChart(input, options, { casting: { method: 'manual' }, bureau });
  }

  /** Exact mixed-radix combination index, useful for replaying random results. */
  static fromIndex(index: number, options: ZiweiOptions | ZiweiOptionsInput): ZiweiCastingChart {
    return new ZiweiCastingChart(inputFromIndex(index), options, { casting: { method: 'index', index, algorithm: 'index-v1' } });
  }

  /** Stable mapping of a reported number; identical numbers and rules reproduce the same plate. */
  static fromNumber(value: number | bigint | string, options: ZiweiOptions | ZiweiOptionsInput): ZiweiCastingChart {
    const number = normalizedNumber(value);
    const index = randomIndex(numberGenerator(number));
    return new ZiweiCastingChart(inputFromIndex(index), options, {
      casting: { method: 'number', number, index, algorithm: 'number-v1' },
    });
  }

  /** Uniform input-combination sampling when randomUint32 is uniform; gender/rules remain caller-selected. */
  static random(options: ZiweiOptions | ZiweiOptionsInput, randomUint32: ZiweiRandomUint32 = secureUint32): ZiweiCastingChart {
    const index = randomIndex(randomUint32);
    return new ZiweiCastingChart(inputFromIndex(index), options, { casting: { method: 'random', index, algorithm: 'index-v1' } });
  }

  modify(input: ZiweiModifyInput): ZiweiCastingChart {
    const changes = placementOverrides(input);
    if (input.updateBureau !== undefined && typeof input.updateBureau !== 'boolean') {
      throw new TypeError('updateBureau must be boolean');
    }
    return this.withModification(Object.freeze({
      overrides: Object.freeze({ ...this.modification?.overrides, ...changes }),
      updateBureau: input.updateBureau ?? this.modification?.updateBureau ?? false,
      lifePalaceShift: this.modification?.lifePalaceShift ?? 0,
    }));
  }

  shiftLifePalace(steps: number): ZiweiCastingChart {
    if (!Number.isSafeInteger(steps)) throw new RangeError('steps must be a safe integer');
    return this.withModification(Object.freeze({
      overrides: this.modification?.overrides ?? Object.freeze({}),
      updateBureau: this.modification?.updateBureau ?? false,
      lifePalaceShift: ((this.modification?.lifePalaceShift ?? 0) + steps % 12 + 12) % 12,
    }), this);
  }

  reset(): ZiweiCastingChart {
    return this.originalChart ?? this;
  }

  resetModification(): ZiweiCastingChart {
    return this.reset();
  }

  private withModification(modification: ZiweiModification, preserved?: ZiweiCastingChart): ZiweiCastingChart {
    const original = this.originalChart ?? this;
    return new ZiweiCastingChart({ ...original.placementInput, ...modification.overrides }, this.options, {
      original, modification, preserved, casting: original.casting,
    });
  }

  toJSON() {
    const original = this.originalChart ?? this;
    return {
      schemaVersion: 'ziwei-casting-chart-v1' as const,
      kind: 'ziwei-casting' as const,
      casting: this.casting,
      originalInput: original.placementInput,
      originalBureau: original.anchors.bureau,
      placementInput: this.placementInput,
      modification: this.modification,
      omittedPlacements: this.omittedPlacements,
      anchors: this.anchors,
      bodyPalace: this.bodyPalace,
      lifeMaster: this.lifeMaster,
      bodyMaster: this.bodyMaster,
      palaceStems: this.palaceStems,
      starCatalog: this.starCatalog,
      starPositions: this.starPositions,
      yearTransformations: this.yearTransformations,
      transformationMasks: this.transformationMasks,
      brightnessLabels: this.ruleTables.brightnessLabels,
      palaces: this.serializePalaces('year'),
      options: {
        ...this.options.toJSON(),
        rules: {
          ...this.options.rules,
          ruleset: { modules: this.options.rules.ruleset.modules.map(({ label, patch }) => ({ label, patch })) },
        },
      },
    };
  }
}

export type ZiweiCastingChartJSON = ReturnType<ZiweiCastingChart['toJSON']>;

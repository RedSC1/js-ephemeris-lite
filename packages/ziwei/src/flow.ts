import type { ZiweiChart } from './chart.js';
import { brightnessAt, evaluateFlowPlacement, selectZiweiRules } from './rules.js';
import type { StarInfo } from './stars.js';
import { FLOW_LEVEL, type Brightness, type FlowCoordinate, type FlowLevel, type PalaceId, type TransformSet } from './types.js';

export interface ZiweiFlowLayer {
  readonly level: FlowLevel;
  readonly lifePalace: number;
  readonly coordinate: Readonly<FlowCoordinate>;
  readonly transforms: TransformSet;
  readonly starPositions: readonly number[];
  readonly starBitsets: readonly bigint[];
}

export interface ZiweiSmallLimitLayer {
  readonly scope: 'small-limit';
  readonly lifePalace: number;
  readonly coordinate: Readonly<FlowCoordinate>;
  readonly transforms: TransformSet;
  readonly starPositions: readonly number[];
  readonly starBitsets: readonly bigint[];
}

export interface ZiweiFlowStarPlacement extends StarInfo {
  readonly branch: number;
  readonly palaceId: PalaceId;
  readonly brightness: Brightness;
}

function buildLayerData(chart: ZiweiChart, coordinate: Readonly<FlowCoordinate>): Omit<ZiweiFlowLayer, 'level'> {
  const rules = selectZiweiRules(chart.options.rules);
  const positions = Array<number>(rules.catalog.length).fill(-1);
  const bitsets = Array<bigint>(12).fill(0n);
  for (const rule of rules.flowPlacements) {
    const branch = evaluateFlowPlacement(rule, coordinate, chart.facts.gender, {
      bureau: chart.anchors.bureau,
      ziwei: chart.anchors.ziwei,
      tianfu: chart.anchors.tianfu,
      life: chart.anchors.palacePositions[0]!,
      body: chart.bodyPalace,
    });
    positions[rule.starId] = branch;
    bitsets[branch] |= 1n << BigInt(rule.starId);
  }
  return Object.freeze({
    lifePalace: coordinate.branch,
    coordinate: Object.freeze({ ...coordinate }),
    transforms: rules.sihua[coordinate.stem]!,
    starPositions: Object.freeze(positions),
    starBitsets: Object.freeze(bitsets),
  });
}

export function makeFlowLayer(
  chart: ZiweiChart,
  level: FlowLevel,
  coordinate: Readonly<FlowCoordinate>,
): ZiweiFlowLayer {
  if (!Object.values(FLOW_LEVEL).includes(level)) throw new RangeError('unknown flow level');
  if (!Number.isInteger(coordinate.stem) || coordinate.stem < 0 || coordinate.stem >= 10
    || !Number.isInteger(coordinate.branch) || coordinate.branch < 0 || coordinate.branch >= 12) {
    throw new RangeError('invalid flow coordinate');
  }
  return Object.freeze({ level, ...buildLayerData(chart, coordinate) });
}

/** Dart-compatible small-limit overlay; it remains outside the contiguous C++ flow stack. */
export function makeSmallLimitLayer(
  chart: ZiweiChart,
  coordinate: Readonly<FlowCoordinate>,
): ZiweiSmallLimitLayer {
  return Object.freeze({ scope: 'small-limit', ...buildLayerData(chart, coordinate) });
}

/** Immutable natal chart plus a contiguous Decade→Year→Month→Day→Hour stack. */
export class ZiweiDynamicChart {
  readonly natal: ZiweiChart;
  readonly flowStack: readonly ZiweiFlowLayer[];
  readonly smallLimitLayer: ZiweiSmallLimitLayer | null;

  constructor(
    natal: ZiweiChart,
    flowStack: readonly ZiweiFlowLayer[] = [],
    smallLimitLayer: ZiweiSmallLimitLayer | null = null,
  ) {
    for (let index = 0; index < flowStack.length; index += 1) {
      if (flowStack[index]!.level !== index) {
        throw new RangeError('flow layers must be contiguous Decade→Year→Month→Day→Hour');
      }
    }
    if (flowStack.length > 5) throw new RangeError('flow stack cannot exceed five layers');
    this.natal = natal;
    this.flowStack = Object.freeze([...flowStack]);
    this.smallLimitLayer = smallLimitLayer;
    Object.freeze(this);
  }

  push(layer: ZiweiFlowLayer): ZiweiDynamicChart {
    if (layer.level !== this.flowStack.length) {
      throw new RangeError('flow layer is not the next contiguous level');
    }
    return new ZiweiDynamicChart(this.natal, [...this.flowStack, layer], this.smallLimitLayer);
  }

  truncate(firstRemoved: FlowLevel): ZiweiDynamicChart {
    if (!Object.values(FLOW_LEVEL).includes(firstRemoved)) throw new RangeError('unknown flow level');
    return new ZiweiDynamicChart(this.natal, this.flowStack.slice(0, firstRemoved), this.smallLimitLayer);
  }

  withSmallLimit(layer: ZiweiSmallLimitLayer | null): ZiweiDynamicChart {
    return new ZiweiDynamicChart(this.natal, this.flowStack, layer);
  }

  layer(level: FlowLevel): ZiweiFlowLayer | null {
    return this.flowStack[level] ?? null;
  }

  getFlowStarPosition(starId: number, level?: FlowLevel): number | null {
    const layer = level === undefined ? this.flowStack.at(-1) : this.flowStack[level];
    if (layer === undefined) return null;
    const branch = layer.starPositions[starId];
    return branch === undefined || branch < 0 ? null : branch;
  }

  getFlowStarIdsAtBranch(branch: number, level?: FlowLevel): readonly number[] {
    if (!Number.isInteger(branch) || branch < 0 || branch >= 12) throw new RangeError('branch must be 0..11');
    const layer = level === undefined ? this.flowStack.at(-1) : this.flowStack[level];
    if (layer === undefined) return Object.freeze([]);
    const ids: number[] = [];
    for (let id = 0; id < layer.starPositions.length; id += 1) {
      if (layer.starPositions[id] === branch) ids.push(id);
    }
    return Object.freeze(ids);
  }

  getFlowStar(starId: number, level?: FlowLevel): ZiweiFlowStarPlacement | null {
    const layer = level === undefined ? this.flowStack.at(-1) : this.flowStack[level];
    if (layer === undefined) return null;
    const branch = layer.starPositions[starId];
    if (branch === undefined || branch < 0) return null;
    return Object.freeze({
      ...this.natal.getStarInfo(starId),
      branch,
      palaceId: ((layer.lifePalace - branch + 12) % 12) as PalaceId,
      brightness: brightnessAt(selectZiweiRules(this.natal.options.rules), starId, branch),
    });
  }

  getSmallLimitStar(starId: number): ZiweiFlowStarPlacement | null {
    const layer = this.smallLimitLayer;
    if (layer === null) return null;
    const branch = layer.starPositions[starId];
    if (branch === undefined || branch < 0) return null;
    return Object.freeze({
      ...this.natal.getStarInfo(starId),
      branch,
      palaceId: ((layer.lifePalace - branch + 12) % 12) as PalaceId,
      brightness: brightnessAt(selectZiweiRules(this.natal.options.rules), starId, branch),
    });
  }

  getRoleAtBranch(branch: number, level?: FlowLevel | 'small-limit'): PalaceId {
    if (!Number.isInteger(branch) || branch < 0 || branch >= 12) throw new RangeError('branch must be 0..11');
    const life = level === 'small-limit'
      ? this.smallLimitLayer?.lifePalace
      : level === undefined
        ? this.natal.anchors.palacePositions[0]
        : this.flowStack[level]?.lifePalace;
    if (life === undefined) throw new Error('requested dynamic layer is not installed');
    return ((life - branch + 12) % 12) as PalaceId;
  }

  getBranchForRole(role: PalaceId, level?: FlowLevel | 'small-limit'): number {
    if (!Number.isInteger(role) || role < 0 || role >= 12) throw new RangeError('role must be 0..11');
    const life = level === 'small-limit'
      ? this.smallLimitLayer?.lifePalace
      : level === undefined
        ? this.natal.anchors.palacePositions[0]
        : this.flowStack[level]?.lifePalace;
    if (life === undefined) throw new Error('requested dynamic layer is not installed');
    return (life - role + 12) % 12;
  }

  toJSON(): object {
    const serialize = (layer: Omit<ZiweiFlowLayer, 'level'> | ZiweiSmallLimitLayer): object => ({
      lifePalace: layer.lifePalace,
      coordinate: layer.coordinate,
      transforms: layer.transforms,
      starPositions: layer.starPositions,
    });
    return {
      natal: this.natal.toJSON(),
      flowStack: this.flowStack.map((layer) => ({ level: layer.level, ...serialize(layer) })),
      smallLimit: this.smallLimitLayer === null ? null : serialize(this.smallLimitLayer),
    };
  }
}

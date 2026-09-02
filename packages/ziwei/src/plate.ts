import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from 'js-ephemeris-lite';
import type { ZiweiAnchors } from './anchors.js';
import { brightnessAt, type SelectedZiweiRules } from './rules.js';
import type { StarInfo } from './stars.js';
import { PALACE_NAMES, type Brightness, type PalaceId, type StarTransformMark, type TransformSet } from './types.js';

export type ZiweiPlateAnchors = Pick<ZiweiAnchors, 'bureau' | 'ziwei' | 'tianfu' | 'palacePositions'>;

export interface ZiweiPalaceState {
  readonly branch: number;
  readonly stem: number;
  readonly palaceId: PalaceId;
  readonly starBitset: bigint;
  readonly starIds: readonly number[];
}

export interface ZiweiStarPlacement extends StarInfo {
  readonly branch: number;
  readonly palaceId: PalaceId;
  readonly brightness: Brightness;
  readonly transformMask: number;
}

function addTransformSet(masks: number[], transforms: TransformSet, startMark: number): void {
  const ids = [transforms.lu, transforms.quan, transforms.ke, transforms.ji];
  for (let kind = 0; kind < 4; kind += 1) masks[ids[kind]!]! |= 1 << (startMark + kind);
}

/** Shared immutable palace assembly; independent of birth clocks and calendar facts. */
export function buildZiweiPlate(
  rules: SelectedZiweiRules, anchors: ZiweiPlateAnchors, palaceStems: readonly number[],
  starPositions: readonly number[], yearTransforms: TransformSet,
) {
  const positions = Object.freeze([...starPositions]);
  const bitsets = Array<bigint>(12).fill(0n);
  for (const rule of rules.natalPlacements) {
    const branch = positions[rule.starId]!;
    if (branch >= 0) bitsets[branch] |= 1n << BigInt(rule.starId);
  }
  const roleByBranch = Array<number>(12);
  for (let palace = 0; palace < 12; palace++) roleByBranch[anchors.palacePositions[palace]!] = palace;
  const palaces = Object.freeze(Array.from({ length: 12 }, (_, branch) => Object.freeze({
    branch, stem: palaceStems[branch]!, palaceId: roleByBranch[branch]! as PalaceId,
    starBitset: bitsets[branch]!,
    starIds: Object.freeze(rules.catalog.filter(star => star.natal && positions[star.id] === branch).map(star => star.id)),
  })));
  const masks = Array<number>(rules.catalog.length).fill(0);
  addTransformSet(masks, yearTransforms, 0);
  for (let branch = 0; branch < 12; branch++) {
    const own = rules.sihua[palaceStems[branch]!]!;
    const inward = rules.sihua[palaceStems[(branch + 6) % 12]!]!;
    const ownIds = [own.lu, own.quan, own.ke, own.ji];
    const inwardIds = [inward.lu, inward.quan, inward.ke, inward.ji];
    for (let kind = 0; kind < 4; kind++) {
      if (positions[ownIds[kind]!] === branch) masks[ownIds[kind]!]! |= 1 << (4 + kind);
      if (positions[inwardIds[kind]!] === branch) masks[inwardIds[kind]!]! |= 1 << (8 + kind);
    }
  }
  return Object.freeze({ starPositions: positions, palaces, transformationMasks: Object.freeze(masks) });
}

/** Palace queries shared by birth charts and casting charts; no calendar-dependent API. */
export abstract class ZiweiPlate {
  abstract readonly anchors: ZiweiPlateAnchors;
  abstract readonly bodyPalace: number;
  abstract readonly palaceStems: readonly number[];
  abstract readonly palaces: readonly ZiweiPalaceState[];
  abstract readonly starCatalog: readonly StarInfo[];
  abstract readonly starPositions: readonly number[];
  abstract readonly transformationMasks: readonly number[];
  protected abstract readonly ruleTables: SelectedZiweiRules;

  getPalace(palaceId: PalaceId): ZiweiPalaceState {
    if (!Number.isInteger(palaceId) || palaceId < 0 || palaceId >= 12) {
      throw new RangeError('palaceId must be 0..11');
    }
    return this.palaces[this.anchors.palacePositions[palaceId]!]!;
  }

  getStarPosition(starId: number): ZiweiStarPlacement | null {
    const star = this.getStarInfo(starId);
    const branch = this.starPositions[starId]!;
    if (branch < 0) return null;
    return Object.freeze({
      ...star,
      branch,
      palaceId: this.palaces[branch]!.palaceId,
      brightness: brightnessAt(this.ruleTables, starId, branch),
      transformMask: this.transformationMasks[starId]!,
    });
  }

  findStarId(key: string): number | undefined {
    return this.starCatalog.find((star) => star.key === key)?.id;
  }

  getStarInfo(starId: number): StarInfo {
    const star = this.starCatalog[starId];
    if (star === undefined) throw new RangeError(`unknown star id in this chart: ${starId}`);
    return star;
  }

  getStarsAtBranch(branch: number): readonly ZiweiStarPlacement[] {
    if (!Number.isInteger(branch) || branch < 0 || branch >= 12) {
      throw new RangeError('branch must be 0..11');
    }
    return Object.freeze(this.palaces[branch]!.starIds.map(
      (starId) => this.getStarPosition(starId)!,
    ));
  }

  getStarsInPalace(palaceId: PalaceId): readonly ZiweiStarPlacement[] {
    return this.getStarsAtBranch(this.getPalace(palaceId).branch);
  }

  getBrightnessLabel(value: Brightness): string | null {
    if (value < -1 || value > 6) throw new RangeError('brightness must be -1..6');
    const label = this.ruleTables.brightnessLabels[String(value)];
    return value === -1 || label === undefined || label.length === 0 ? null : label;
  }

  hasTransform(starId: number, mark: StarTransformMark): boolean {
    if (!Number.isInteger(mark) || mark < 0 || mark >= 12) return false;
    return (((this.transformationMasks[starId] ?? 0) >>> mark) & 1) === 1;
  }

  protected serializePalaces<T extends string>(yearScope: T) {
    return this.palaces.map((palace) => ({
      branch: palace.branch,
      branchName: EARTHLY_BRANCHES[palace.branch]!,
      stem: palace.stem,
      stemName: HEAVENLY_STEMS[palace.stem]!,
      palaceId: palace.palaceId,
      name: PALACE_NAMES[palace.palaceId],
      isBodyPalace: palace.branch === this.bodyPalace,
      starIds: palace.starIds,
      stars: this.getStarsAtBranch(palace.branch).map((star) => ({
        ...star,
        brightnessLabel: this.getBrightnessLabel(star.brightness),
        transformations: ([yearScope, 'self', 'centripetal'] as const).flatMap((scope, index) => (
          (['lu', 'quan', 'ke', 'ji'] as const).flatMap((kind, kindIndex) => (
            (star.transformMask & (1 << (index * 4 + kindIndex))) !== 0 ? [{ scope, kind }] : []
          ))
        )),
      })),
    }));
  }
}

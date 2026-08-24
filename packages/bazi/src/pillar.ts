import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  ganzhiBranch,
  ganzhiIndex,
  ganzhiName,
  ganzhiStem,
  makeGanzhi,
  type Ganzhi,
} from 'js-ephemeris-lite';

export type PackedPillar = Ganzhi;

export interface DecodedPillar {
  readonly value: PackedPillar;
  readonly stem: number;
  readonly branch: number;
  readonly index: number;
  readonly stemName: string;
  readonly branchName: string;
  readonly name: string;
}

/** Encode one pillar in the native-compatible uint8 layout. */
export function packPillar(stem: number, branch: number): PackedPillar {
  return makeGanzhi(stem, branch);
}

/** Decode the high-nibble stem and low-nibble branch representation. */
export function unpackPillar(value: PackedPillar): DecodedPillar {
  const stem = ganzhiStem(value);
  const branch = ganzhiBranch(value);
  return Object.freeze({
    value,
    stem,
    branch,
    index: ganzhiIndex(value),
    stemName: HEAVENLY_STEMS[stem]!,
    branchName: EARTHLY_BRANCHES[branch]!,
    name: ganzhiName(value),
  });
}

export const pillarStem = ganzhiStem;
export const pillarBranch = ganzhiBranch;
export const pillarIndex = ganzhiIndex;
export const pillarName = ganzhiName;

import { advanceGanzhi, ganzhiIndex, ganzhiStem, makeGanzhi, type Ganzhi } from 'js-ephemeris-lite';
import {
  BRANCH_RELATION_FLAG,
  BRANCH_TRIPLE_RELATION_FLAG,
  EARTH_PALACE_MODE,
  INVALID_ID,
  STEM_RELATION_FLAG,
  type EarthPalaceMode,
  type LifeStageId,
  type TenGodId,
  type WuxingId,
} from './constants.js';

const HIDDEN_STEMS: readonly (readonly number[])[] = Object.freeze([
  [9], [5, 9, 7], [0, 2, 4], [1], [4, 1, 9], [2, 6, 4],
  [3, 5], [5, 3, 1], [6, 8, 4], [7], [4, 7, 3], [8, 0],
].map((stems) => Object.freeze(stems)));
const STEM_COMBINATION_PARTNER = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4] as const;
const STEM_COMBINATION_ELEMENT = [3, 2, 0, 1, 4, 3, 2, 0, 1, 4] as const;
const STEM_CLASH_PARTNER = [6, 7, 8, 9, -1, -1, 0, 1, 2, 3] as const;
export const BRANCH_COMBINATION_PARTNER = Object.freeze([1, 0, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const);
const BRANCH_COMBINATION_ELEMENT = [3, 3, 1, 4, 2, 0, 3, 3, 0, 2, 4, 1] as const;
const BRANCH_CLASH_PARTNER = [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5] as const;
const BRANCH_HARM_PARTNER = [7, 6, 5, 4, 3, 2, 1, 0, 11, 10, 9, 8] as const;
const BRANCH_DESTRUCTION_PARTNER = [9, 4, 11, 6, 1, 8, 3, 10, 5, 0, 7, 2] as const;
const BRANCH_SEVERANCE_PARTNER = [5, -1, 9, 8, -1, 0, 11, -1, 3, 2, -1, 6] as const;
const BRANCH_HIDDEN_COMBINATION_PARTNER = [5, 2, 1, 8, -1, 0, 11, -1, 3, -1, -1, 6] as const;
export const BRANCH_TRIPLE_COMBINATION: readonly (readonly number[])[] = Object.freeze(
  [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]].map((group) => Object.freeze(group)),
);
export const BRANCH_TRIPLE_DIRECTION: readonly (readonly number[])[] = Object.freeze(
  [[11, 0, 1], [2, 3, 4], [5, 6, 7], [8, 9, 10]].map((group) => Object.freeze(group)),
);
export const BRANCH_TRIPLE_PUNISHMENT: readonly (readonly number[])[] = Object.freeze(
  [[2, 5, 8], [1, 10, 7]].map((group) => Object.freeze(group)),
);
export const TRIPLE_ELEMENT = Object.freeze([0, 1, 4, 2] as const);
const LIFE_STAGE_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3] as const;

export interface RelationFlags {
  readonly flags: number;
  readonly combinedElement: WuxingId | null;
}

function validateStem(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= 10) throw new RangeError('stem must be 0..9');
}

function validateBranch(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= 12) throw new RangeError('branch must be 0..11');
}

function isPair(a: number, b: number, left: number, right: number): boolean {
  return (a === left && b === right) || (a === right && b === left);
}

function matchesTriple(a: number, b: number, c: number, group: readonly number[]): boolean {
  return a !== b && a !== c && b !== c && group.includes(a) && group.includes(b) && group.includes(c);
}

export function getKongWang(value: Ganzhi): readonly [number, number] {
  const index = ganzhiIndex(value);
  const first = (10 - Math.floor(index / 10) * 2 + 12) % 12;
  const second = (first + 1) % 12;
  return Object.freeze((ganzhiStem(value) & 1) === (first & 1)
    ? [first, second] as const
    : [second, first] as const);
}

export function getTenGod(dayStem: number, targetStem: number): TenGodId {
  validateStem(dayStem);
  validateStem(targetStem);
  const delta = ((targetStem >> 1) + 5 - (dayStem >> 1)) % 5;
  return ((delta << 1) | ((dayStem ^ targetStem) & 1)) as TenGodId;
}

export function getHiddenStems(branch: number): readonly number[] {
  validateBranch(branch);
  return HIDDEN_STEMS[branch]!;
}

export function calculateStemRelation(stemA: number, stemB: number): RelationFlags {
  validateStem(stemA);
  validateStem(stemB);
  let flags = 0;
  let combinedElement: WuxingId | null = null;
  if (STEM_COMBINATION_PARTNER[stemA] === stemB) {
    flags |= STEM_RELATION_FLAG.COMBINATION;
    combinedElement = STEM_COMBINATION_ELEMENT[stemA] as WuxingId;
  }
  if (STEM_CLASH_PARTNER[stemA] === stemB) flags |= STEM_RELATION_FLAG.CLASH;
  if ((stemA + 4) % 10 === stemB || (stemB + 4) % 10 === stemA) {
    flags |= STEM_RELATION_FLAG.RESTRAINT;
  }
  return Object.freeze({ flags, combinedElement });
}

export function calculateBranchRelation(branchA: number, branchB: number): RelationFlags {
  validateBranch(branchA);
  validateBranch(branchB);
  let flags = 0;
  let combinedElement: WuxingId | null = null;
  if (BRANCH_COMBINATION_PARTNER[branchA] === branchB) {
    flags |= BRANCH_RELATION_FLAG.COMBINATION;
    combinedElement = BRANCH_COMBINATION_ELEMENT[branchA] as WuxingId;
  }
  if (BRANCH_CLASH_PARTNER[branchA] === branchB) flags |= BRANCH_RELATION_FLAG.CLASH;
  if (BRANCH_HARM_PARTNER[branchA] === branchB) flags |= BRANCH_RELATION_FLAG.HARM;
  if (BRANCH_DESTRUCTION_PARTNER[branchA] === branchB) flags |= BRANCH_RELATION_FLAG.DESTRUCTION;
  const punishment = branchA !== branchB && (
    isPair(branchA, branchB, 0, 3) || isPair(branchA, branchB, 2, 5)
    || isPair(branchA, branchB, 2, 8) || isPair(branchA, branchB, 5, 8)
    || isPair(branchA, branchB, 1, 10) || isPair(branchA, branchB, 1, 7)
    || isPair(branchA, branchB, 7, 10)
  );
  if (punishment) flags |= BRANCH_RELATION_FLAG.PUNISHMENT;
  if (branchA === branchB && [4, 6, 9, 11].includes(branchA)) {
    flags |= BRANCH_RELATION_FLAG.SELF_PUNISHMENT;
  }
  if (BRANCH_HIDDEN_COMBINATION_PARTNER[branchA] === branchB) {
    flags |= BRANCH_RELATION_FLAG.HIDDEN_COMBINATION;
  }
  if (BRANCH_SEVERANCE_PARTNER[branchA] === branchB) flags |= BRANCH_RELATION_FLAG.SEVERANCE;
  return Object.freeze({ flags, combinedElement });
}

export function calculateBranchTripleRelation(a: number, b: number, c: number): RelationFlags {
  validateBranch(a);
  validateBranch(b);
  validateBranch(c);
  let flags = 0;
  let combinedElement: WuxingId | null = null;
  for (let index = 0; index < 4; index += 1) {
    if (matchesTriple(a, b, c, BRANCH_TRIPLE_COMBINATION[index]!)) {
      flags |= BRANCH_TRIPLE_RELATION_FLAG.COMBINATION;
      combinedElement = TRIPLE_ELEMENT[index] as WuxingId;
    }
    if (matchesTriple(a, b, c, BRANCH_TRIPLE_DIRECTION[index]!)) {
      flags |= BRANCH_TRIPLE_RELATION_FLAG.DIRECTION;
      combinedElement = TRIPLE_ELEMENT[index] as WuxingId;
    }
  }
  if (BRANCH_TRIPLE_PUNISHMENT.some((group) => matchesTriple(a, b, c, group))) {
    flags |= BRANCH_TRIPLE_RELATION_FLAG.PUNISHMENT;
  }
  return Object.freeze({ flags, combinedElement });
}

export function getLifeStage(
  stem: number,
  branch: number,
  earthPalaceMode: EarthPalaceMode = EARTH_PALACE_MODE.FIRE_EARTH,
): LifeStageId {
  validateStem(stem);
  validateBranch(branch);
  if (earthPalaceMode !== EARTH_PALACE_MODE.FIRE_EARTH
    && earthPalaceMode !== EARTH_PALACE_MODE.WATER_EARTH) {
    throw new RangeError('unknown earthPalaceMode');
  }
  let start: number = LIFE_STAGE_START[stem]!;
  if (earthPalaceMode === EARTH_PALACE_MODE.WATER_EARTH) {
    if (stem === 4) start = 8;
    if (stem === 5) start = 3;
  }
  return ((stem & 1) === 0
    ? (branch + 12 - start) % 12
    : (start + 12 - branch) % 12) as LifeStageId;
}

export function calculateExtraPillars(
  year: Ganzhi,
  month: Ganzhi,
  day: Ganzhi,
  hour: Ganzhi,
): Readonly<{ mingGong: Ganzhi; shenGong: Ganzhi; taiYuan: Ganzhi; taiXi: Ganzhi }> {
  const yearStem = ganzhiStem(year);
  ganzhiStem(month);
  ganzhiStem(day);
  ganzhiStem(hour);
  const monthBranch = month & 0x0f;
  const hourBranch = hour & 0x0f;
  const monthNumber = ((monthBranch + 10) % 12) + 1;
  const monthPosition = (12 - (monthNumber - 1)) % 12;
  const mingBranch = (monthPosition + ((3 + 12 - hourBranch) % 12)) % 12;
  const shenBranch = (monthBranch + hourBranch + 1) % 12;
  const startStem = ((yearStem % 5) * 2 + 2) % 10;
  const mingStem = (startStem + ((mingBranch + 10) % 12)) % 10;
  const shenStem = (startStem + ((shenBranch + 10) % 12)) % 10;
  return Object.freeze({
    mingGong: makeGanzhi(mingStem, mingBranch),
    shenGong: makeGanzhi(shenStem, shenBranch),
    taiYuan: advanceGanzhi(month, -9),
    taiXi: makeGanzhi((ganzhiStem(day) + 5) % 10, BRANCH_COMBINATION_PARTNER[day & 0x0f]!),
  });
}

export const BAZI_RULE_INFO = Object.freeze({
  packedPillar: 'high nibble=stem, low nibble=branch',
  invalidId: INVALID_ID,
  hiddenStemCapacity: 3,
});

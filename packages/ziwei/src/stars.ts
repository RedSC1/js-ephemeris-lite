import {
  GENERATED_NATAL_STAR_COUNT,
  GENERATED_STARS,
  type GeneratedStar,
} from './generated/default-rules.js';

export type StarInfo = GeneratedStar;
export const STAR_CATALOG: readonly StarInfo[] = GENERATED_STARS;
export const NATAL_STAR_COUNT = GENERATED_NATAL_STAR_COUNT;
export const STAR_COUNT = STAR_CATALOG.length;

const STAR_IDS = new Map(STAR_CATALOG.map((star) => [star.key, star.id]));

export function getStar(id: number): StarInfo {
  const star = STAR_CATALOG[id];
  if (star === undefined) throw new RangeError(`unknown star id: ${id}`);
  return star;
}

export function findStarId(key: string): number | undefined {
  return STAR_IDS.get(key);
}

export function requireStarId(key: string): number {
  const id = findStarId(key);
  if (id === undefined) throw new RangeError(`unknown star key: ${key}`);
  return id;
}

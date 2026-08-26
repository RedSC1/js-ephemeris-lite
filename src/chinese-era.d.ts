import type { Ut1Input } from './time.js';

export type ChineseEraBoundaryPrecision = 'instant' | 'day' | 'year';
export type ChineseEraBoundarySource =
  | 'historical-decision'
  | 'historical-event'
  | 'ddbc'
  | 'manakai'
  | 'ddbc+manakai'
  | 'transition-handoff'
  | 'sxwnl-year';

export interface ChineseEraName {
  dynasty: string;
  title: string;
  ruler: string;
  era: string;
  yearNumber: number;
  startJd: number;
  endJdExclusive: number;
  precision: ChineseEraBoundaryPrecision;
  boundarySource: ChineseEraBoundarySource;
  text: string;
}

/** 1949-01-01 00:00:00 at UTC+8, represented as a UT Julian Day. */
export const MODERN_CHINA_ERA_START_JD: number;

/** 1949-10-01 15:00:00 at UTC+8, represented as a UT Julian Day. */
export const MODERN_CHINA_ESTABLISHMENT_JD: number;

/** 1912-01-01 00:00:00 at UTC+8, represented as a UT Julian Day. */
export const REPUBLIC_OF_CHINA_ERA_START_JD: number;

/** 1916-01-01 00:00:00 at UTC+8, represented as a UT Julian Day. */
export const HONGXIAN_ERA_START_JD: number;

/** 1916-03-24 00:00:00 at UTC+8; March 23 is included. */
export const HONGXIAN_ERA_END_JD_EXCLUSIVE: number;

/** Return every known Chinese historical era name active at this physical instant. */
export function getChineseEraNames(value: Ut1Input): readonly ChineseEraName[];

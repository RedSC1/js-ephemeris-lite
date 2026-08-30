/** Shou Xing fast solar-eclipse classification codes. */
export { rsGS, rsPL } from './solar-eclipses.js';
export type * from './solar-eclipses.js';

export type EcFastType =
  | 'N' | 'P'
  | 'T' | 'T0' | 'T1'
  | 'A' | 'A0' | 'A1'
  | 'H' | 'H2' | 'H3';

export interface EcFastResult {
  /** Approximate conjunction, in TT days relative to J2000.0. */
  jd: number;
  /** Original Shou Xing alias of `jd`. */
  jdSuo: number;
  /** 0 when the event lies near a boundary and `lx` was refined with rsGS; otherwise 1. */
  ac: 0 | 1;
  /** Original Shou Xing eclipse classification code. */
  lx: EcFastType;
}

/**
 * 寿星快速日食搜索。保留原函数名和参数语义；普通情况使用短公式，
 * `ac=0` 的边界结果会自动用 rsGS 完整几何复核，以统一边界分类。
 * `jd` 是接近朔的 J2000.0 起算 TT 日数，不是绝对儒略日。
 */
export function ecFast(jd: number): EcFastResult;

export interface YsPLState {
  t: number;
  x: number;
  y: number;
  mr: number;
  er: number;
  Er: number;
  e_mRad: number;
  eShadow: number;
  eShadow2: number;
}

export interface YsPLResult {
  /** 初亏、食甚、复圆、半影食始、半影食终、食既、生光；0 表示不存在。 */
  lT: [number, number, number, number, number, number, number];
  sf: number;
  LX: '' | '偏' | '全';
  /** Refined maximum, in TT days relative to J2000.0. */
  jd: number;
  /** Penumbral magnitude, including umbral eclipses; 0 when there is no eclipse. */
  penumbralMagnitude: number;
}

export const ysPL: Readonly<{
  lineT(G: Pick<YsPLState, 't' | 'x' | 'y'>, v: number, u: number, r: number, n: 0 | 1): number;
  lecXY(jd: number, re?: Partial<YsPLState>): YsPLState;
  /** 参数和返回时刻均为 J2000.0 起算的 TT 日数。 */
  lecMax(jd: number): YsPLResult;
}>;

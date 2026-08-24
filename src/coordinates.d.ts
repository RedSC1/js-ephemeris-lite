export type CoordinateVector3 = [number, number, number];
export type Matrix3 = [CoordinateVector3, CoordinateVector3, CoordinateVector3];

export interface AngleState {
  value: number;
  rate: number;
}

export interface MatrixState {
  matrix: Matrix3;
  rate: Matrix3;
}

export interface Nutation {
  dpsi: number;
  deps: number;
  meanObliquity: number;
  trueObliquity: number;
}

export interface NutationState extends Nutation {
  dpsiRate: number;
  depsRate: number;
  meanObliquityRate: number;
  trueObliquityRate: number;
}

export const J2000: 2451545;
export const ARCSEC_TO_RAD: number;
export function meanObliquityIau2006(jdTT: number): number;
export function meanObliquityIau2006State(jdTT: number): AngleState;
export function iau2000bNutation(jdTT: number): Nutation;
export function iau2000bNutationState(jdTT: number, termCount?: number): NutationState;
export function vondrak2011PrecessionMatrix(jdTT: number): Matrix3;
export function vondrak2011PrecessionMatrixState(jdTT: number): MatrixState;
export function meanEclipticOfDateMatrixState(jdTT: number): MatrixState;

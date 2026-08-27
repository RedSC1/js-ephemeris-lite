export type MountainKey = 'zi' | 'gui' | 'chou' | 'gen' | 'yin' | 'jia' | 'mao' | 'yi'
  | 'chen' | 'xun' | 'si' | 'bing' | 'wu' | 'ding' | 'wei' | 'kun' | 'shen' | 'geng'
  | 'you' | 'xin' | 'xu' | 'qian' | 'hai' | 'ren';
export type MountainName = '子' | '癸' | '丑' | '艮' | '寅' | '甲' | '卯' | '乙'
  | '辰' | '巽' | '巳' | '丙' | '午' | '丁' | '未' | '坤' | '申' | '庚'
  | '酉' | '辛' | '戌' | '乾' | '亥' | '壬';
export type MountainInput = MountainKey | MountainName;
export interface MountainInfo {
  readonly key: MountainKey;
  readonly name: MountainName;
  readonly luoShuNumber: number;
  readonly dragon: 'earth' | 'heaven' | 'human';
  readonly isYang: boolean;
  readonly azimuthDeg: number;
}
export const MOUNTAIN: Readonly<{ [K in MountainKey as Uppercase<K>]: K }>;
export const MOUNTAINS: readonly MountainInfo[];
export const PALACE_DIRECTIONS: readonly string[];
export function getMountain(value: MountainInput): MountainInfo;
export function mountainForAzimuth(azimuthDeg: number): MountainInfo;
export function oppositeMountain(value: MountainInput): MountainInfo;
export function createFlyingStarBoard(centerNumber: number, forward?: boolean): number[];
export function getThreeCyclesNinePeriods(year: number): { cycle: string; period: number };
export function createEarthPlate(period: number): number[];
export function createMountainPlate(earthPlate: readonly number[], sitting: MountainInput): number[];
export function createFacingPlate(earthPlate: readonly number[], facing: MountainInput): number[];
export interface FengShuiChart {
  period: number;
  sitting: MountainInfo;
  facing: MountainInfo;
  earthPlate: number[];
  mountainPlate: number[];
  facingPlate: number[];
  mountainForward: boolean;
  facingForward: boolean;
}
export function createFengShuiChart(options: { period: number; sitting: MountainInput }): FengShuiChart;
export interface PaiLongResult {
  laiLong: MountainInfo;
  facing: MountainInfo;
  startBranch: number;
  forward: boolean;
  stars: Array<{ branch: number; branchName: string; star: string }>;
  facingStar: string;
}
export function calculatePaiLong(laiLong: MountainInput, facing: MountainInput): PaiLongResult;
export function getPaiLongFacingStar(laiLong: MountainInput, facing: MountainInput): string;

export type SxCoordinate = [number, number, number];
export type SxGroundPoint = [longitudeRadians: number, latitudeRadians: number, jd?: number];

export interface RsGSFeature {
  jdSuo: number; dT: number; ds: number;
  vx: number; vy: number; ax: number; ay: number; v: number; k: number;
  jd: number; xc: number; yc: number; zc: number; D: number; d: number;
  I: SxCoordinate;
  gk1: SxGroundPoint; gk2: SxGroundPoint; gk3: SxGroundPoint;
  gk4: SxGroundPoint; gk5: SxGroundPoint;
  zxJ: number; zxW: number; sf: number;
  lx: 'N' | 'P' | 'T' | 'T0' | 'T1' | 'A' | 'A0' | 'A1' | 'H' | 'H2' | 'H3';
  Sdp: SxCoordinate; dw: number; tt: number;
}

export interface RsGSBoundaryResult extends RsGSFeature {
  p1: number[]; p2: number[]; p3: number[]; p4: number[];
  q1: number[]; q2: number[]; q3: number[]; q4: number[];
  L0: number[]; L1: number[]; L2: number[]; L3: number[];
  L4: number[]; L5: number[]; L6: number[];
}

export interface RsGSOutlineResult { p1: number[]; p2: number[]; p3: number[]; }
export interface RsShadowRadius { r1: number; r2: number; ar2: number; sf: number; }

export const rsGS: {
  Zs: number[]; Zdt: number; Zjd: number; dT: number;
  tanf1: number; tanf2: number; srad: number; bba: number; bhc: number; dyj: number;
  init(jd: number, n: 2 | 3 | 7): typeof rsGS;
  chazhi(jd: number, xt: 0 | 1 | 2): SxCoordinate;
  sun(jd: number): SxCoordinate; moon(jd: number): SxCoordinate; bse(jd: number): SxCoordinate;
  cd2bse(z: SxCoordinate, I: SxCoordinate): SxCoordinate;
  bse2cd(z: SxCoordinate, I: SxCoordinate): SxCoordinate;
  bse2db(z: SxCoordinate, I: SxCoordinate, f: 0 | 1): SxGroundPoint;
  bseXY2db(x: number, y: number, I: SxCoordinate, f: 0 | 1): SxGroundPoint;
  bseM(jd: number): SxCoordinate;
  Vxy(x: number, y: number, s: number, vx: number, vy: number): {
    vx: number; vy: number; Vx: number; Vy: number; V: number;
  };
  rSM(mR: number): RsShadowRadius;
  qrd(jd: number, dx: number, dy: number, fs: 0 | 1): SxGroundPoint;
  feature(jd: number): RsGSFeature;
  jieX(jd: number): RsGSBoundaryResult;
  jieX2(jd: number): RsGSOutlineResult;
  /** 寿星原兼容文本界线表。 */
  jieX3(jd: number): string;
};

export interface RsPLSecState {
  t: number; x: number; y: number;
  mCJ: number; mCW: number; mR: number; mCJ2: number; mCW2: number; mR2: number;
  sCJ: number; sCW: number; sR: number; sCJ2: number; sCW2: number; sR2: number;
  mr: number; sr: number;
}

export interface RsPLResult {
  /** 初亏、食甚、复圆、食既、生光；不可见或不存在为 0。 */
  sT: [number, number, number, number, number];
  LX: '' | '偏' | '全' | '环';
  sf: number; sf2: number; sf3: number; sflx: ' ' | '#' | '*';
  b1: number; dur: number; P1: number; V1: number; P2: number; V2: number;
  /** 日出、日没，J2000.0 起算的 UT1 日数。 */
  sun_s: number; sun_j: number;
}

export interface RsPLBoundaryResult { V: number[]; Vc: '' | '全' | '环'; Vb: string; }

export const rsPL: {
  nasa_r: 0 | 1; sT: number[]; LX: '' | '偏' | '全' | '环';
  sf: number; sf2: number; sf3: number; sflx: string; b1: number; dur: number;
  P1: number; V1: number; P2: number; V2: number; sun_s: number; sun_j: number;
  secXY(jd: number, longitudeRadians: number, latitudeRadians: number,
    heightKm: number, result: Partial<RsPLSecState>): void;
  lineT(G: Pick<RsPLSecState, 't' | 'x' | 'y'>,
    v: number, u: number, r: number, n: 0 | 1): number;
  secMax(jd: number, longitudeRadians: number, latitudeRadians: number,
    heightKm: number): RsPLResult;
  V: number[]; Vc: '' | '全' | '环'; Vb: string;
  nbj(jd: number): RsPLBoundaryResult;
};

import type { EphemerisVector3 } from './ephemeris.js';
import type { SkyFrame } from './apparent.js';

export const TSC1_VERSION: 1;
export const TSC1_HEADER_SIZE: 132;
export const TSC1_STAR_RECORD_SIZE: 92;
export const TSC1_ALIAS_RECORD_SIZE: 16;
export const TSC1_ASTROMETRY_SOURCE: Readonly<{ UNKNOWN: 0; GAIA_DR3: 1; HIPPARCOS: 2; BSC5: 3; MANUAL: 4 }>;
export const TSC1_STAR_FLAGS: Readonly<{
  HAS_GAIA_ID: number; HAS_HIP_ID: number; HAS_HR_ID: number; HAS_HD_ID: number;
  HAS_RADIAL_VELOCITY: number; HAS_PARALLAX: number; SPECIAL_DIRECTION: number;
}>;

export interface Tsc1StarRecord {
  readonly index: number;
  readonly canonicalId: string;
  readonly displayName: string;
  readonly gaiaDr3SourceId: bigint;
  readonly hipId: number;
  readonly hrId: number;
  readonly hdId: number;
  readonly rightAscensionDeg: number;
  readonly declinationDeg: number;
  readonly properMotionRaMasPerYear: number;
  readonly properMotionDecMasPerYear: number;
  readonly parallaxMas: number;
  readonly radialVelocityKmPerSecond: number;
  readonly referenceEpoch: number;
  readonly magnitude: number;
  readonly astrometrySource: number;
  readonly flags: number;
}

export type Tsc1Input = ArrayBuffer | SharedArrayBuffer | Uint8Array;
export type FixedStarReference = string | number | Tsc1StarRecord;

export class Tsc1Catalog implements Iterable<Tsc1StarRecord> {
  constructor(input: Tsc1Input);
  readonly bytes: Uint8Array;
  readonly version: number;
  readonly flags: number;
  readonly starCount: number;
  readonly aliasCount: number;
  readonly catalogMinEpoch: number;
  readonly catalogMaxEpoch: number;
  string(offset: number): string;
  getStar(index: number): Tsc1StarRecord;
  find(key: string): Tsc1StarRecord | null;
  [Symbol.iterator](): Iterator<Tsc1StarRecord>;
}

export interface FixedStarIcrfState {
  star: Tsc1StarRecord;
  jdTT: number;
  referenceJdTT: number;
  positionAu: EphemerisVector3;
  velocityAuPerDay: EphemerisVector3;
}
export interface FixedStarOptions { frame?: SkyFrame; aberration?: boolean; solarDeflection?: boolean }
export interface FixedStarPosition {
  star: Tsc1StarRecord; jdTT: number; frame: SkyFrame;
  longitudeDeg: number; latitudeDeg: number; distanceAu: number;
  rightAscensionDeg: number; declinationDeg: number;
  astrometricPositionAu: EphemerisVector3;
  eclipticPositionAu: EphemerisVector3;
  equatorialPositionAu: EphemerisVector3;
}
export interface FixedStarState extends FixedStarPosition {
  longitudeSpeedDegPerDay: number; latitudeSpeedDegPerDay: number;
  rightAscensionSpeedDegPerDay: number; declinationSpeedDegPerDay: number;
  distanceSpeedAuPerDay: number;
  eclipticVelocityAuPerDay: EphemerisVector3;
  equatorialVelocityAuPerDay: EphemerisVector3;
}

export function normalizeTsc1Alias(value: string): string;
export function tsc1AliasHash(value: string | Uint8Array): bigint;
export function parseTsc1Catalog(input: Tsc1Input): Tsc1Catalog;
export function fixedStarIcrfState(catalog: Tsc1Catalog, star: FixedStarReference, jdTT: number): FixedStarIcrfState;
export function fixedStarPosition(catalog: Tsc1Catalog, star: FixedStarReference, jdTT: number, options?: FixedStarOptions): FixedStarPosition;
export function fixedStarState(catalog: Tsc1Catalog, star: FixedStarReference, jdTT: number, options?: FixedStarOptions): FixedStarState;

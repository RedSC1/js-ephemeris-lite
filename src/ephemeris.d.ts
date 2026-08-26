export { J2000, iau2000bNutation, vondrak2011PrecessionMatrix } from './coordinates.js';

export type EphemerisVector3 = [number, number, number];
export type MoonLatitudeTerms = number | 'full';

export interface ScalarState {
  value: number;
  rate: number;
}

export interface CartesianState {
  position: EphemerisVector3;
  velocity: EphemerisVector3;
}

export interface CorrectionOptions {
  corrections?: boolean;
}

export interface MoonDirectionOptions extends CorrectionOptions {
  latitudeTerms?: MoonLatitudeTerms;
}

export interface MoonCorrectionState {
  shifts: [ScalarState, ScalarState, ScalarState, ScalarState];
  rotation: ScalarState;
}

export const AU_KM: number;
export const EARTH_MOON_MASS_RATIO: number;
export function correctionWeight(jdTT: number): number;
export function moonCorrectionState(jdTT: number, corrections?: boolean): MoonCorrectionState;
export function moonPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function moonElpLongitudeState(jdTT: number, options?: CorrectionOptions): ScalarState;
export function moonDirectionState(jdTT: number, options?: MoonDirectionOptions): CartesianState;
export function moonState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function earthLongitudeCorrectionState(jdTT: number, corrections?: boolean): ScalarState;
export function earthPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function earthState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function earthDirectionState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function embPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function embState(jdTT: number, options?: CorrectionOptions): CartesianState;

export function earthHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function earthHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function sunGeocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function sunGeocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function moonGeocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function moonGeocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function moonHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function moonHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function embHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function embHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;

export const MOON_MODEL_INFO: Readonly<{
  longitudeTerms: number;
  latitudeTerms: number;
  radiusTerms: number;
  eventDirectionSkipsRadius: boolean;
  directionLatitudeTerms: readonly [0, 5, 10, 20, 'full'];
}>;

export const EPHEMERIS_FRAME_INFO: Readonly<{
  frame: string;
  geometric: boolean;
  lightTimeApplied: boolean;
  earthHeliocentricUnit: string;
  sunGeocentricUnit: string;
  moonGeocentricUnit: string;
  moonHeliocentricUnit: string;
  embHeliocentricUnit: string;
  velocityTimeUnit: string;
}>;

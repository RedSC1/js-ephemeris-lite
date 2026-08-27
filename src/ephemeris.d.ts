export { J2000, iau2000bNutation, vondrak2011PrecessionMatrix } from './coordinates.js';

export type EphemerisVector3 = [number, number, number];
export type MoonLatitudeTerms = number | 'full';
export type Planet = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

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

export type PlanetCorrectionState = [ScalarState, ScalarState, ScalarState];

export interface PlanetCorrectionMetric {
  rms: number;
  p95Abs: number;
  maxAbs: number;
}

export interface PlanetCorrectionAccuracy {
  longitudeArcsec: PlanetCorrectionMetric;
  latitudeArcsec: PlanetCorrectionMetric;
  radiusKm: PlanetCorrectionMetric;
}

export const AU_KM: number;
export const EARTH_MOON_MASS_RATIO: number;
export const PLANET: Readonly<{
  MERCURY: 'mercury';
  VENUS: 'venus';
  EARTH: 'earth';
  MARS: 'mars';
  JUPITER: 'jupiter';
  SATURN: 'saturn';
  URANUS: 'uranus';
  NEPTUNE: 'neptune';
}>;
export function correctionWeight(jdTT: number): number;
export function moonCorrectionState(jdTT: number, corrections?: boolean): MoonCorrectionState;
export function moonPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function moonElpLongitudeState(jdTT: number, options?: CorrectionOptions): ScalarState;
export function moonDirectionState(jdTT: number, options?: MoonDirectionOptions): CartesianState;
export function moonState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function earthLongitudeCorrectionState(jdTT: number, corrections?: boolean): ScalarState;
export function planetCorrectionState(planet: Planet, jdTT: number, corrections?: boolean): PlanetCorrectionState;
export function earthPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function earthState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function earthDirectionState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function embPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function embState(jdTT: number, options?: CorrectionOptions): CartesianState;

export function earthHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function earthHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function planetHeliocentricPosition(planet: Planet, jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function planetHeliocentricState(planet: Planet, jdTT: number, options?: CorrectionOptions): CartesianState;
export function planetGeocentricPosition(planet: Planet, jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function planetGeocentricState(planet: Planet, jdTT: number, options?: CorrectionOptions): CartesianState;
export function mercuryHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function mercuryHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function venusHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function venusHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function marsHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function marsHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function jupiterHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function jupiterHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function saturnHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function saturnHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function uranusHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function uranusHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
export function neptuneHeliocentricPosition(jdTT: number, options?: CorrectionOptions): EphemerisVector3;
export function neptuneHeliocentricState(jdTT: number, options?: CorrectionOptions): CartesianState;
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

export const PLANET_MODEL_INFO: Readonly<Record<Planet, Readonly<{
  longitudeTerms: number;
  latitudeTerms: number;
  radiusTerms: number;
  totalTerms: number;
}>>>;

export const PLANET_CORRECTION_INFO: Readonly<{
  oracle: 'JPL DE441';
  coordinates: readonly ['heliocentric longitude', 'heliocentric latitude', 'radius'];
  modernFitIntervalYears: readonly [1000, 3000];
  longFitIntervalYears: readonly [-6000, 10000];
  blendDistanceFromJ2000Years: readonly [800, 1000];
  validation: Readonly<Partial<Record<Planet, Readonly<{
    modern: Readonly<PlanetCorrectionAccuracy>;
    long: Readonly<PlanetCorrectionAccuracy>;
  }>>>>;
}>;

export const EPHEMERIS_FRAME_INFO: Readonly<{
  frame: string;
  geometric: boolean;
  lightTimeApplied: boolean;
  earthHeliocentricUnit: string;
  planetHeliocentricUnit: string;
  planetGeocentricUnit: string;
  sunGeocentricUnit: string;
  moonGeocentricUnit: string;
  moonHeliocentricUnit: string;
  embHeliocentricUnit: string;
  velocityTimeUnit: string;
}>;

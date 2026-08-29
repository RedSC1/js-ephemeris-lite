export { J2000, iau2000bNutation, vondrak2011PrecessionMatrix } from './coordinates.js';

export type EphemerisVector3 = [number, number, number];
export type MoonLatitudeTerms = number | 'full';
export type Planet = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

export interface ScalarState {
  value: number;
  rate: number;
}

export interface CartesianState {
  position: EphemerisVector3;
  velocity: EphemerisVector3;
}

export interface MoonDirectionOptions {
  latitudeTerms?: MoonLatitudeTerms;
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
  PLUTO: 'pluto';
}>;
export function moonPosition(jdTT: number): EphemerisVector3;
export function moonElpLongitudeState(jdTT: number): ScalarState;
export function moonDirectionState(jdTT: number, options?: MoonDirectionOptions): CartesianState;
export function moonState(jdTT: number): CartesianState;
export function earthPosition(jdTT: number): EphemerisVector3;
export function earthState(jdTT: number): CartesianState;
export function earthDirectionState(jdTT: number): CartesianState;
export function embPosition(jdTT: number): EphemerisVector3;
export function embState(jdTT: number): CartesianState;

export function earthHeliocentricPosition(jdTT: number): EphemerisVector3;
export function earthHeliocentricState(jdTT: number): CartesianState;
export function planetHeliocentricPosition(planet: Planet, jdTT: number): EphemerisVector3;
/** Pluto is recommended for 1600..2200; other dates still compute with low accuracy. */
export function planetHeliocentricState(planet: Planet, jdTT: number): CartesianState;
export function planetGeocentricPosition(planet: Planet, jdTT: number): EphemerisVector3;
export function planetGeocentricState(planet: Planet, jdTT: number): CartesianState;
export function mercuryHeliocentricPosition(jdTT: number): EphemerisVector3;
export function mercuryHeliocentricState(jdTT: number): CartesianState;
export function venusHeliocentricPosition(jdTT: number): EphemerisVector3;
export function venusHeliocentricState(jdTT: number): CartesianState;
export function marsHeliocentricPosition(jdTT: number): EphemerisVector3;
export function marsHeliocentricState(jdTT: number): CartesianState;
export function jupiterHeliocentricPosition(jdTT: number): EphemerisVector3;
export function jupiterHeliocentricState(jdTT: number): CartesianState;
export function saturnHeliocentricPosition(jdTT: number): EphemerisVector3;
export function saturnHeliocentricState(jdTT: number): CartesianState;
export function uranusHeliocentricPosition(jdTT: number): EphemerisVector3;
export function uranusHeliocentricState(jdTT: number): CartesianState;
export function neptuneHeliocentricPosition(jdTT: number): EphemerisVector3;
export function neptuneHeliocentricState(jdTT: number): CartesianState;
/** Warning: outside 1600..2200 Pluto remains computable but uses a coarse fallback. */
export function plutoHeliocentricPosition(jdTT: number): EphemerisVector3;
/** Warning: outside 1600..2200 Pluto remains computable but uses a coarse fallback. */
export function plutoHeliocentricState(jdTT: number): CartesianState;
export function sunGeocentricPosition(jdTT: number): EphemerisVector3;
export function sunGeocentricState(jdTT: number): CartesianState;
export function moonGeocentricPosition(jdTT: number): EphemerisVector3;
export function moonGeocentricState(jdTT: number): CartesianState;
export function moonHeliocentricPosition(jdTT: number): EphemerisVector3;
export function moonHeliocentricState(jdTT: number): CartesianState;
export function embHeliocentricPosition(jdTT: number): EphemerisVector3;
export function embHeliocentricState(jdTT: number): CartesianState;

export const PLUTO_MODEL_INFO: Readonly<{
  recommendedIntervalYears: readonly [1600, 2200];
  modelIntervalYears: readonly [-6000, 10000];
  transitionIntervalsYears: readonly [readonly [1590, 1600], readonly [2200, 2210]];
  positionTarget: 'Pluto-system barycenter';
  warning: string;
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

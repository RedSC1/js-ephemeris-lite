import type { JulianTime, Ut1Input, ZonedTime } from './time.js';

export const SOLAR_ALTITUDE_STATE: Readonly<{
  NOT_FOUND: 'not-found';
  CROSSES: 'crosses';
  ALWAYS_ABOVE: 'always-above';
  ALWAYS_BELOW: 'always-below';
  TANGENT: 'tangent';
}>;
export type SolarAltitudeState = typeof SOLAR_ALTITUDE_STATE[keyof typeof SOLAR_ALTITUDE_STATE];

export const SOLAR_LIMB: Readonly<{
  UPPER: 'upper';
  CENTER: 'center';
  LOWER: 'lower';
}>;
export type SolarLimb = typeof SOLAR_LIMB[keyof typeof SOLAR_LIMB];

export interface AtmosphereOptions {
  pressureMbar?: number;
  temperatureCelsius?: number;
}

export interface SolarObserver extends AtmosphereOptions {
  longitudeDeg: number;
  latitudeDeg: number;
  heightMeters?: number;
}

export interface SolarVisibilityOptions {
  limb?: SolarLimb;
  refraction?: boolean;
  fixedDiscSize?: boolean;
  horizonDegrees?: number;
}

export interface SolarAltitudeSample {
  slopeRadPerDay: number;
  centerAltitudeRad: number;
  apparentAltitudeRad: number;
  azimuthRad: number;
}

export interface SolarRiseSetResult {
  altitudeState: SolarAltitudeState;
  rise: JulianTime | null;
  set: JulianTime | null;
  limb: SolarLimb;
  refraction: boolean;
}

export function hybridAtmosphericRefraction(
  altitudeRad: number,
  options?: AtmosphereOptions,
): number;
export function solarAltitude(
  time: Ut1Input,
  observer: SolarObserver,
  options?: SolarVisibilityOptions,
): SolarAltitudeSample;
export function computeSolarRiseSetFast(
  center: Ut1Input,
  observer: SolarObserver,
  options?: SolarVisibilityOptions,
): SolarRiseSetResult;
/** ZonedTime selects a local civil day; number/JulianTime selects a centered UT1 window. */
export function solarRiseSetForDate(
  dateOrCenter: number | JulianTime | ZonedTime,
  observer: SolarObserver,
  options?: SolarVisibilityOptions,
): SolarRiseSetResult;

export const SOLAR_VISIBILITY_INFO: Readonly<{
  ordinaryLatitudeLimitDeg: number;
  fallbackWindowStepHours: number;
  refractionModel: string;
  defaultLimb: SolarLimb;
  defaultRefraction: boolean;
}>;

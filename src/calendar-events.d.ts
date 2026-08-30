import type { MoonLatitudeTerms, ScalarState } from './ephemeris.js';
import type { JulianTime } from './time.js';

export type EventAccuracy = 'fast' | 'mid' | 'accurate';

export interface EventSolveOptions {
  /** Event model used for this call; default mid. */
  accuracy?: EventAccuracy;
  /** Mid/accurate only; specifying this in fast mode throws. */
  toleranceSeconds?: number;
  /** Safeguarded is available only in mid/accurate mode. */
  solver?: 'auto' | 'safeguarded';
}

export interface LunarEventSolveOptions extends EventSolveOptions {
  /** Custom budgets are mid-only; fast fixes 10, accurate fixes full. */
  moonLatitudeTerms?: MoonLatitudeTerms;
}

export interface LowModelOptions {
  withDrift?: boolean;
  termCount?: number;
}

export interface LowElongationOptions {
  withDrift?: boolean;
  moonTermCount?: number;
  earthTermCount?: number;
}

export const DEFAULT_NEW_MOON_LATITUDE_TERMS: 10;
/** Full L/B and 30-term Earth R for solar aberration; rate in radians/day. */
export function solarLongitudeState(jdTT: number): ScalarState;
export function moonLongitudeState(
  jdTT: number,
  options?: { latitudeTerms?: MoonLatitudeTerms },
): ScalarState;
export function elongationState(
  jdTT: number,
  options?: { moonLatitudeTerms?: MoonLatitudeTerms },
): ScalarState;
export function lowSolarLongitudeState(jdTT: number, options?: LowModelOptions): ScalarState;
export function lowElongationState(jdTT: number, options?: LowElongationOptions): ScalarState;
export function solveSolarLongitude(
  targetLongitude: number,
  nearJdTT: number,
  options?: EventSolveOptions,
): JulianTime;
export function solveLunarPhase(
  targetElongation: number,
  nearJdTT: number,
  options?: LunarEventSolveOptions,
): JulianTime;
export function solveNewMoon(
  nearJdTT: number,
  options?: LunarEventSolveOptions,
): JulianTime;

export interface EventTimeOptions {
  /** Numerical root tolerance, seconds; default 0.01. Not an absolute ephemeris accuracy bound. */
  toleranceSeconds?: number;
}
/** Unwrapped solar longitude (radians) → TT JD; truncated fixed-stage model, no tolerance guarantee. */
export function solarLongitudeTimeFast(longitude: number): number;
/** Unwrapped elongation (radians) → TT JD; 2*pi*k selects new moons. Truncated, no tolerance guarantee. */
export function lunarPhaseTimeFast(elongation: number): number;
/** Full library apparent-position chain; unwrapped solar longitude (radians) → TT JD. */
export function solarLongitudeTimeAccurate(longitude: number, options?: EventTimeOptions): number;
/** Full library apparent-position chain; unwrapped elongation (radians) → TT JD. */
export function lunarPhaseTimeAccurate(elongation: number, options?: EventTimeOptions): number;

export const LOW_MODEL_INFO: Readonly<{
  earthLongitudeTerms: readonly Readonly<{ power: number; serial: number }>[];
  moonLongitudeTerms: readonly Readonly<{ power: number; serial: number }>[];
  earthRadiusTerms: readonly Readonly<{ power: number; serial: number }>[];
  nutationTerms: number;
}>;

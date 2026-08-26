import type { MoonLatitudeTerms, ScalarState } from './ephemeris.js';

export interface LowModelOptions {
  withDrift?: boolean;
  termCount?: number;
}

export interface LowElongationOptions {
  withDrift?: boolean;
  moonTermCount?: number;
  earthTermCount?: number;
}

export interface EventRoot {
  estimateJdTT: number;
  jdTT: number;
  jdUT1: number;
  deltaTSeconds: number;
  iterations: number;
  usedBisection: boolean;
  residualRadians: number;
  correctionSeconds: number;
}

export interface NewMoonRoot extends EventRoot {
  moonLatitudeTerms: MoonLatitudeTerms;
}

export const DEFAULT_NEW_MOON_LATITUDE_TERMS: 10;
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
  options?: { toleranceSeconds?: number },
): EventRoot;
export function solveLunarPhase(
  targetElongation: number,
  nearJdTT: number,
  options?: { toleranceSeconds?: number; moonLatitudeTerms?: MoonLatitudeTerms },
): NewMoonRoot;
export function solveNewMoon(
  nearJdTT: number,
  options?: { toleranceSeconds?: number; moonLatitudeTerms?: MoonLatitudeTerms },
): NewMoonRoot;

export const LOW_MODEL_INFO: Readonly<{
  earthLongitudeTerms: readonly Readonly<{ power: number; serial: number }>[];
  moonLongitudeTerms: readonly Readonly<{ power: number; serial: number }>[];
  earthRadiusTerms: readonly Readonly<{ power: number; serial: number }>[];
  nutationTerms: number;
}>;

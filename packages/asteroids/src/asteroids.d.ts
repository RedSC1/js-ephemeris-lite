import type { Accuracy } from 'js-ephemeris-lite/accuracy';
import type { EphemerisVector3 } from 'js-ephemeris-lite/ephemeris';

export type Asteroid =
  | 'ceres' | 'pallas' | 'juno' | 'vesta' | 'eros' | 'lilith_1181'
  | 'chiron' | 'pholus' | 'nessus';

export declare const ASTEROID: Readonly<{
  CERES: 'ceres';
  PALLAS: 'pallas';
  JUNO: 'juno';
  VESTA: 'vesta';
  EROS: 'eros';
  LILITH_1181: 'lilith_1181';
  CHIRON: 'chiron';
  PHOLUS: 'pholus';
  NESSUS: 'nessus';
}>;

/** Geometric heliocentric position in fixed mean-J2000 ecliptic axes, in AU. */
export declare function asteroidHeliocentricPosition(
  body: Asteroid,
  jdTT: number,
): EphemerisVector3;

/** Geometric geocentric position in fixed mean-J2000 ecliptic axes, in AU. */
export declare function asteroidGeocentricPosition(
  body: Asteroid,
  jdTT: number,
  accuracy?: Accuracy,
): EphemerisVector3;

export declare const ASTEROID_MODEL_INFO: Readonly<{
  bodies: readonly Asteroid[];
  intervalYears: readonly [-3000, 3000];
  frame: 'J2000 mean/dynamical ecliptic and equinox';
  center: 'Sun';
  unit: 'AU';
  model: string;
  continuity: 'quintic boundary correction';
  positionErrorBudgetKm: Readonly<Record<Asteroid, number>>;
}>;

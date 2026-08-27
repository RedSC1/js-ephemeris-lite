import type { CorrectionOptions, EphemerisVector3 } from './ephemeris.js';
export type SkyBody = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
export type SkyFrame = 'j2000' | 'mean-of-date' | 'true-of-date';
export interface ApparentOptions extends CorrectionOptions {
  frame?: SkyFrame;
  lightTime?: boolean;
  aberration?: boolean;
  solarDeflection?: boolean;
}
export interface ApparentPosition {
  body: SkyBody;
  jdTT: number;
  frame: SkyFrame;
  longitudeDeg: number;
  latitudeDeg: number;
  distanceAu: number;
  rightAscensionDeg: number;
  declinationDeg: number;
  lightTimeDays: number;
  eclipticPositionAu: EphemerisVector3;
  equatorialPositionAu: EphemerisVector3;
}
export interface ApparentState extends ApparentPosition {
  longitudeSpeedDegPerDay: number;
  latitudeSpeedDegPerDay: number;
  rightAscensionSpeedDegPerDay: number;
  declinationSpeedDegPerDay: number;
  distanceSpeedAuPerDay: number;
  eclipticVelocityAuPerDay: EphemerisVector3;
  equatorialVelocityAuPerDay: EphemerisVector3;
}
export const SKY_BODIES: readonly SkyBody[];
export const SKY_FRAME: Readonly<{ J2000: 'j2000'; MEAN_OF_DATE: 'mean-of-date'; TRUE_OF_DATE: 'true-of-date' }>;
export const LIGHT_TIME_DAYS_PER_AU: number;
export const APPARENT_MODEL_INFO: Readonly<Record<string, string | boolean>>;
/** Input JD(TT), output degrees and AU, true equinox of date by default. */
export function apparentBodyPosition(body: SkyBody, jdTT: number, options?: ApparentOptions): ApparentPosition;
export function apparentBodyState(body: SkyBody, jdTT: number, options?: ApparentOptions): ApparentState;
/** GAST in degrees. Input JD(UT1); optional explicit JD(TT). */
export function greenwichSiderealTime(jdUT1: number, jdTT?: number): number;

import type { ApparentOptions, SkyBody } from './apparent.js';
import type { SolarObserver, SolarAltitudeState, SolarLimb } from './solar-visibility.js';
export type SkyObserver = SolarObserver;
export interface BodyVisibilityOptions {
  apparent?: Omit<ApparentOptions, 'frame'> & { frame?: 'true-of-date' };
  refraction?: boolean;
  horizonDegrees?: number;
  limb?: SolarLimb;
}
export interface BodyHorizontalPosition {
  body: SkyBody; jdUT1: number; jdTT: number;
  azimuthDeg: number; geometricAltitudeDeg: number; apparentAltitudeDeg: number;
  rightAscensionDeg: number; declinationDeg: number; distanceAu: number; hourAngleDeg: number;
}
export interface BodyRiseSetResult {
  body: SkyBody; dayStartUT1: number; dayEndUT1: number;
  altitudeState: SolarAltitudeState;
  /** All event times are JD(UT1), in the half-open requested day. */
  rises: number[]; sets: number[]; upperTransits: number[]; lowerTransits: number[];
  limb: SolarLimb; refraction: boolean;
}
export function bodyHorizontalPosition(body: SkyBody, jdUT1: number, observer: SkyObserver, options?: BodyVisibilityOptions): BodyHorizontalPosition;
export function bodyRiseSetForDay(body: SkyBody, dayStartUT1: number, observer: SkyObserver, options?: BodyVisibilityOptions): BodyRiseSetResult;

import type { JulianTime } from './time.js';
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
  /** All event times are physical instants in the half-open requested UT1 day. */
  rises: JulianTime[]; sets: JulianTime[]; upperTransits: JulianTime[]; lowerTransits: JulianTime[];
  limb: SolarLimb; refraction: boolean;
}
export function bodyHorizontalPosition(body: SkyBody, jdUT1: number, observer: SkyObserver, options?: BodyVisibilityOptions): BodyHorizontalPosition;
export function bodyRiseSetForDay(body: SkyBody, dayStartUT1: number, observer: SkyObserver, options?: BodyVisibilityOptions): BodyRiseSetResult;

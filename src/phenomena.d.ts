import type { ApparentOptions, SkyBody } from './apparent.js';
export const BODY_DISC_RADIUS_KM: Readonly<Record<SkyBody, number>>;
export interface BodyPhenomena {
  body: SkyBody;
  jdTT: number;
  distanceAu: number;
  /** Null for the Sun (self luminous). */
  phaseAngleDeg: number | null;
  illuminatedFraction: number | null;
  solarElongationDeg: number;
  apparentDiameterArcsec: number;
  horizontalParallaxDeg: number;
}
export function bodyPhenomena(body: SkyBody, jdTT: number, options?: ApparentOptions): BodyPhenomena;
/** phaseCycle: 0=new, .25=first quarter, .5=full, .75=last quarter. */
export function moonIllumination(jdTT: number, options?: ApparentOptions): BodyPhenomena & { phaseCycle: number; waxing: boolean };

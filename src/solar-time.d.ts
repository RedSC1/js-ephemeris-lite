import type { CivilDateTime, JulianTime, Ut1Input } from './time.js';

export type SolarClockMode = 'mean' | 'apparent';

export interface EquationOfTimeResult {
  readonly jdUT1: number;
  readonly jdTT: number;
  readonly equationDays: number;
  readonly equationSeconds: number;
  readonly apparentSunRightAscensionRad: number;
  readonly gastRad: number;
}

export class SolarClock implements CivilDateTime {
  private constructor();
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly mode: SolarClockMode;
  readonly longitudeDeg: number;
  readonly jdSolar: number;
  readonly instant: JulianTime;
  readonly equationOfTimeSeconds: number;
  toJSON(): CivilDateTime & {
    mode: SolarClockMode;
    longitudeDeg: number;
    jdSolar: number;
    jdUT1: number;
    jdTT: number;
    equationOfTimeSeconds: number;
  };
}

export function equationOfTime(time: Ut1Input): EquationOfTimeResult;
export function meanSolarTime(time: Ut1Input, longitudeDeg: number): SolarClock;
export function trueSolarTime(time: Ut1Input, longitudeDeg: number): SolarClock;
export const localMeanSolarTime: typeof meanSolarTime;
export const localApparentSolarTime: typeof trueSolarTime;
export function localMeanToApparentSolarTime(jdLocalMean: number, longitudeDeg: number): number;
export function localApparentToMeanSolarTime(jdLocalApparent: number, longitudeDeg: number): number;

export const SOLAR_TIME_INFO: Readonly<{
  longitudeConvention: string;
  meanDefinition: string;
  apparentDefinition: string;
  clockIsVirtual: true;
}>;

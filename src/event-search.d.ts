import type { ApparentOptions, SkyBody, SkyFrame } from './apparent.js';
export interface SearchOptions { stepDays?: number; toleranceDays?: number; }
export interface SkySearchOptions extends SearchOptions { apparent?: ApparentOptions; }
export interface SkyEvent {
  body: SkyBody;
  jdTT: number;
  frame: SkyFrame;
  longitudeDeg: number;
  longitudeSpeedDegPerDay: number;
  /** For stations, direction immediately AFTER the station. */
  direction: 'direct' | 'retrograde';
}
/** Half-open interval [start,end); sign-changing roots only. */
export function searchCrossings(evaluate: (time: number) => number, start: number, end: number, options?: SearchOptions): Array<{ time: number; residual: number }>;
export function searchAngleCrossings(evaluateDegrees: (time: number) => number, targetDeg: number, start: number, end: number, options?: SearchOptions): Array<{ time: number; residualDeg: number }>;
export function searchLongitudeCrossings(body: SkyBody, targetDeg: number, startTT: number, endTT: number, options?: SkySearchOptions): Array<SkyEvent & { targetDeg: number }>;
export function searchRelativeLongitude(body: SkyBody, other: SkyBody, angleDeg: number, startTT: number, endTT: number, options?: SkySearchOptions): Array<SkyEvent & { other: SkyBody; angleDeg: number }>;
export function searchStations(body: SkyBody, startTT: number, endTT: number, options?: SkySearchOptions): SkyEvent[];
export function searchIngresses(body: SkyBody, startTT: number, endTT: number, options?: SkySearchOptions): Array<SkyEvent & { boundaryDeg: number; fromSign: number; toSign: number }>;

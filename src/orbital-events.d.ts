import type { CorrectionOptions } from './ephemeris.js';
import type { SkyBody, SkyFrame } from './apparent.js';
import type { SearchOptions, SkySearchOptions } from './event-search.js';
export interface GeometricSearchOptions extends SearchOptions, CorrectionOptions {}
export interface LunarNodeOptions extends GeometricSearchOptions { frame?: SkyFrame; }
export interface ApsisEvent {
  body: 'moon' | 'earth'; center: 'earth' | 'sun'; jdTT: number;
  kind: 'periapsis' | 'apoapsis'; distanceKm: number; distanceAu: number;
}
export interface LunarNodeEvent {
  body: 'moon'; jdTT: number; frame: SkyFrame; kind: 'ascending' | 'descending';
  longitudeDeg: number; latitudeDeg: number; distanceKm: number;
}
export interface ElongationEvent {
  body: 'mercury' | 'venus'; jdTT: number; frame: SkyFrame; kind: 'eastern' | 'western';
  elongationDeg: number; longitudeDeg: number; latitudeDeg: number;
}
/** Geometric distance extrema. Searches use half-open JD(TT) intervals. */
export function searchLunarApsides(startTT: number, endTT: number, options?: GeometricSearchOptions): ApsisEvent[];
export function searchEarthApsides(startTT: number, endTT: number, options?: GeometricSearchOptions): ApsisEvent[];
/** Actual lunar crossings of the selected ecliptic plane, not mean orbital nodes. */
export function searchLunarNodes(startTT: number, endTT: number, options?: LunarNodeOptions): LunarNodeEvent[];
export function searchGreatestElongations(body: 'mercury' | 'venus', startTT: number, endTT: number, options?: SkySearchOptions): ElongationEvent[];
export function searchRelativeRightAscension(body: SkyBody, other: SkyBody, angleDeg: number, startTT: number, endTT: number, options?: SkySearchOptions): Array<{
  body: SkyBody; other: SkyBody; jdTT: number; frame: SkyFrame; angleDeg: number;
  rightAscensionDeg: number; declinationDeg: number; declinationDifferenceDeg: number;
}>;
export function searchRightAscensionStations(body: SkyBody, startTT: number, endTT: number, options?: SkySearchOptions): Array<{
  body: SkyBody; jdTT: number; frame: SkyFrame; direction: 'direct' | 'retrograde';
  rightAscensionDeg: number; declinationDeg: number; rightAscensionSpeedDegPerDay: number;
}>;

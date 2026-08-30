import type { AstroTime, JulianTime, ZonedTime } from './time.js';
import type { EcFastType } from './eclipses.js';

export type EclipseTimeInput = number | Date | JulianTime | ZonedTime | AstroTime;
export interface ObserverLocation { longitudeDeg: number; latitudeDeg: number; heightMeters?: number; }
export interface ResolvedObserverLocation { longitudeDeg: number; latitudeDeg: number; heightMeters: number; }
export interface TimedGroundPoint { time: JulianTime; longitudeDeg: number; latitudeDeg: number; }

export interface SolarEclipseEvent {
  code: Exclude<EcFastType, 'N'>;
  kind: 'partial' | 'total' | 'annular' | 'hybrid';
  conjunction: JulianTime;
  maximum: JulianTime;
  magnitude: number;
  maximumLocation: { longitudeDeg: number; latitudeDeg: number };
  pathWidthKm: number;
  centralDurationSeconds: number;
  contacts: {
    partialBegin: TimedGroundPoint | null;
    centralBegin: TimedGroundPoint | null;
    maximum: JulianTime;
    centralEnd: TimedGroundPoint | null;
    partialEnd: TimedGroundPoint | null;
  };
}

export interface LunarEclipseEvent {
  kind: 'penumbral' | 'partial' | 'total';
  maximum: JulianTime;
  magnitude: number;
  umbralMagnitude: number;
  penumbralMagnitude: number;
  contacts: {
    penumbralBegin: JulianTime | null;
    partialBegin: JulianTime | null;
    totalBegin: JulianTime | null;
    maximum: JulianTime;
    totalEnd: JulianTime | null;
    partialEnd: JulianTime | null;
    penumbralEnd: JulianTime | null;
  };
}

export interface LocalSolarEclipseEvent {
  global: SolarEclipseEvent;
  observer: ResolvedObserverLocation;
  visible: boolean;
  kind: 'none' | 'partial' | 'total' | 'annular';
  magnitude: number;
  horizonClipped: 'sunrise' | 'sunset' | null;
  contacts: {
    partialBegin: JulianTime | null;
    maximum: JulianTime | null;
    partialEnd: JulianTime | null;
    centralBegin: JulianTime | null;
    centralEnd: JulianTime | null;
  };
  sunrise: JulianTime | null;
  sunset: JulianTime | null;
}

export interface LocalLunarContact {
  time: JulianTime;
  azimuthDeg: number;
  geometricAltitudeDeg: number;
  apparentAltitudeDeg: number;
  /** Whether the refracted Moon centre is above the astronomical horizon. */
  visible: boolean;
}

export interface LocalLunarEclipseEvent {
  global: LunarEclipseEvent;
  observer: ResolvedObserverLocation;
  /** True when any part of the named eclipse interval has the Moon centre above the horizon. */
  visible: boolean;
  contacts: {
    penumbralBegin: LocalLunarContact | null;
    partialBegin: LocalLunarContact | null;
    totalBegin: LocalLunarContact | null;
    maximum: LocalLunarContact;
    totalEnd: LocalLunarContact | null;
    partialEnd: LocalLunarContact | null;
    penumbralEnd: LocalLunarContact | null;
  };
  moonrises: JulianTime[];
  moonsets: JulianTime[];
  horizonClipped: 'moonrise' | 'moonset' | 'both' | null;
}

export function searchSolarEclipses(start: EclipseTimeInput, end: EclipseTimeInput): SolarEclipseEvent[];
export function searchLunarEclipses(start: EclipseTimeInput, end: EclipseTimeInput): LunarEclipseEvent[];
export function getSolarEclipseDetails(date: EclipseTimeInput): SolarEclipseEvent | null;
export function getLunarEclipseDetails(date: EclipseTimeInput): LunarEclipseEvent | null;
export function getLocalSolarEclipse(date: EclipseTimeInput, location: ObserverLocation): LocalSolarEclipseEvent | null;
export function getLocalLunarEclipse(date: EclipseTimeInput, location: ObserverLocation): LocalLunarEclipseEvent | null;

export const ECLIPSE_SEARCH_INFO: Readonly<{
  interval: 'half-open [start,end)';
  maximumLunations: 5000;
  mapRenderer: false;
}>;

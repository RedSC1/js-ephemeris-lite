import type { CalendarDayBoundaryMode, CalendarMode } from './chinese-calendar.js';
import type { JulianTime, CivilDate, CivilDateTime } from './time.js';

export const SOLAR_TERM_NAMES: readonly string[];
export const LUNAR_PHASE_NAMES: Readonly<Record<number, string>>;

export interface QiShuoYearOptions {
  utcOffsetMinutes?: number;
  mode?: CalendarMode;
  dayBoundaryMode?: CalendarDayBoundaryMode;
  meridianDeg?: number;
  includeSolarTerms?: boolean;
  includePentads?: boolean;
  lunarPhaseAnglesDeg?: number[];
}

export interface QiShuoEventBase {
  kind: 'solar-term' | 'pentad' | 'lunar-phase';
  name: string;
  index: number;
  time: JulianTime;
  localTime: CivilDateTime & { offsetMinutes: number };
  localCivilDayNumber: number;
  localDate: CivilDate;
  assignedCivilDayNumber: number;
  assignedDate: CivilDate;
  assignmentSource: 'historical-profile' | 'china-astronomical' | 'local-astronomical';
  assignmentDiffersFromLocalDate: boolean;
}

export interface QiShuoSolarEvent extends QiShuoEventBase {
  kind: 'solar-term' | 'pentad';
  /** Target-angle index, not a unique occurrence ID; may repeat within a civil year. */
  index: number;
  termIndex: number;
  pentadIndex?: number;
  targetLongitude: number;
  targetLongitudeDeg: number;
}

export interface QiShuoLunarPhaseEvent extends QiShuoEventBase {
  kind: 'lunar-phase';
  phaseAngle: number;
  phaseAngleDeg: number;
}

export type QiShuoEvent = QiShuoSolarEvent | QiShuoLunarPhaseEvent;

export interface QiShuoYear {
  civilYear: number;
  utcOffsetMinutes: number;
  mode: CalendarMode;
  dayBoundaryMode: CalendarDayBoundaryMode;
  meridianDeg?: number;
  startJdUT1: number;
  endJdUT1: number;
  /** All occurrences in the civil year; the pentad count is not fixed at 72. */
  events: QiShuoEvent[];
}

export function getQiShuoYear(civilYear: number, options?: QiShuoYearOptions): QiShuoYear;

export const QI_SHUO_INFO: Readonly<{
  rangeStartYear: -6000;
  rangeEndYear: 10000;
  defaultUtcOffsetMinutes: 480;
  defaultDayBoundaryMode: 'fixed-utc-offset';
  dayBoundaryModes: readonly CalendarDayBoundaryMode[];
  civilCalendar: string;
}>;

import type { CalendarMode } from './chinese-calendar.js';
import type { CivilDate, CivilDateTime } from './time.js';
import type { EventRoot, NewMoonRoot } from './calendar-events.js';

export const SOLAR_TERM_NAMES: readonly string[];
export const LUNAR_PHASE_NAMES: Readonly<Record<number, string>>;

export interface QiShuoYearOptions {
  utcOffsetMinutes?: number;
  mode?: CalendarMode;
  meridianDeg?: number;
  includeSolarTerms?: boolean;
  includePentads?: boolean;
  lunarPhaseAnglesDeg?: number[];
}

export interface QiShuoEventBase {
  kind: 'solar-term' | 'pentad' | 'lunar-phase';
  name: string;
  index: number;
  localTime: CivilDateTime & { offsetMinutes: number };
  localCivilDayNumber: number;
  localDate: CivilDate;
  assignedCivilDayNumber: number;
  assignedDate: CivilDate;
  assignmentSource: 'historical-profile' | 'china-astronomical' | 'local-astronomical';
  assignmentDiffersFromLocalDate: boolean;
}

export interface QiShuoSolarEvent extends QiShuoEventBase, EventRoot {
  kind: 'solar-term' | 'pentad';
  termIndex: number;
  pentadIndex?: number;
  targetLongitude: number;
  targetLongitudeDeg: number;
}

export interface QiShuoLunarPhaseEvent extends QiShuoEventBase, NewMoonRoot {
  kind: 'lunar-phase';
  phaseAngle: number;
  phaseAngleDeg: number;
}

export type QiShuoEvent = QiShuoSolarEvent | QiShuoLunarPhaseEvent;

export interface QiShuoYear {
  civilYear: number;
  utcOffsetMinutes: number;
  mode: CalendarMode;
  meridianDeg?: number;
  startJdUT1: number;
  endJdUT1: number;
  events: QiShuoEvent[];
}

export function getQiShuoYear(civilYear: number, options?: QiShuoYearOptions): QiShuoYear;

export const QI_SHUO_INFO: Readonly<{
  rangeStartYear: -6000;
  rangeEndYear: 10000;
  defaultUtcOffsetMinutes: 480;
  civilCalendar: string;
}>;

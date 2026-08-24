export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface CivilDateTime extends CivilDate {
  hour: number;
  minute: number;
  second: number;
}

export interface CalendarInput extends CivilDate {
  hour?: number;
  minute?: number;
  second?: number;
}

export interface ZonedTimeInput extends CalendarInput {
  offsetMinutes: number;
}

export type Ut1Input = number | JulianTime;

export function deltaTSeconds(decimalYear: number): number;
export function julianDay(fields: CalendarInput): number;
export function calendarDateFromJulianDay(jd: number): CivilDateTime;
export function decimalYearFromJulianDay(jd: number): number;
export function deltaTSecondsFromUt1(jdUT1: number): number;
export function deltaTSecondsFromTt(jdTT: number): number;
export function ttToUt1(jdTT: number, deltaT?: number): number;
export function ut1ToTt(jdUT1: number, deltaT?: number): number;

export class JulianTime {
  constructor(jdUT1: number);
  readonly jdUT1: number;
  readonly jdTT: number;
  readonly deltaTSeconds: number;
  static fromUT1(jdUT1: number): JulianTime;
  static fromTT(jdTT: number): JulianTime;
  static fromUnixMilliseconds(unixMilliseconds: number): JulianTime;
  static fromDate(date: Date): JulianTime;
  toUnixMilliseconds(): number;
  toDate(): Date;
  toZonedTime(offsetMinutes: number): ZonedTime;
  toJSON(): {
    jdUT1: number;
    jdTT: number;
    deltaTSeconds: number;
  };
}

export class ZonedTime implements CivilDateTime {
  constructor(fields: ZonedTimeInput);
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly offsetMinutes: number;
  static fromJulianTime(time: Ut1Input, offsetMinutes: number): ZonedTime;
  static fromDate(date: Date, offsetMinutes: number): ZonedTime;
  toJulianTime(): JulianTime;
  toDate(): Date;
  toJSON(): CivilDateTime & { offsetMinutes: number };
}

export function asUt1JulianDay(value: Ut1Input): number;

export const TIME_INFO: Readonly<{
  unixEpochJd: number;
  utcConvention: string;
  civilCalendar: string;
}>;

export const DELTA_T_INFO: Readonly<{
  s15StartYear: number;
  earlyJoinStartYear: number;
  earlyJoin: string;
  annualStartYear: number;
  annualEndYear: number;
  extrapolationJoinEndYear: number;
  annualInterpolation: string;
}>;

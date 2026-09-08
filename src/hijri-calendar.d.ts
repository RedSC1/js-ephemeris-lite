import type { CivilDate, Ut1Input } from './time.js';
/** Arithmetic Hijri; years <= 0 are proleptic labels, not historical AH dates. */
export interface HijriDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}
/** Civil years -6000..10000; hybrid Julian/Gregorian date, clock fields not used. */
export function solarToHijri(date: CivilDate): HijriDate;
/** Returns a civil date (not a physical instant); rejects impossible Hijri dates. */
export function hijriToSolar(date: HijriDate): Readonly<CivilDate>;
/** Explicit fixed offset in integer minutes, ±14 hours; day starts at midnight. */
export function instantToHijri(time: Ut1Input, offsetMinutes: number): HijriDate;
/** Hijri years -10000..10000, including proleptic year zero. */
export function isHijriLeapYear(year: number): boolean;
export function hijriMonthDays(year: number, month: number): number;

// Arithmetic Hijri rules compatible with Shou Xing oba.getHuiLi().
// Integer cycle arithmetic and reverse conversion; see docs/time-and-calendar.md.
import { asUt1JulianDay, calendarDateFromJulianDay, julianDay, ZonedTime } from './time.js';

const EPOCH_DAY = 1948440; // Civil day number (floor(local JD + 0.5)) of 1 AH.
const CYCLE_DAYS = 10631;
const yearStart = n => 354 * n + Math.floor((11 * n + 14) / 30);
const monthStart = n => 29 * n + Math.floor((n + 1) / 2);
function validateYear(year) {
  if (!Number.isInteger(year) || Math.abs(year) > 10000)
    throw new RangeError('Hijri year must be an integer within -10000..10000');
}
function yearIndex(year) {
  validateYear(year);
  return ((year - 1) % 30 + 30) % 30;
}
export function isHijriLeapYear(year) {
  const n = yearIndex(year);
  return yearStart(n + 1) - yearStart(n) === 355;
}
export function hijriMonthDays(year, month) {
  validateYear(year);
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new RangeError('Hijri month must be an integer within 1..12');
  return month === 12 ? (isHijriLeapYear(year) ? 30 : 29) : (month % 2 ? 30 : 29);
}
function civilDay(date) {
  if (date === null || typeof date !== 'object') throw new TypeError('Expected a civil date');
  const { year, month, day } = date;
  if (!Number.isInteger(year) || year < -6000 || year > 10000)
    throw new RangeError('Civil year must be within -6000..10000');
  // Validate only date fields. This API intentionally does not interpret a clock.
  new ZonedTime({ year, month, day, hour: 12, offsetMinutes: 0 });
  return Math.floor(julianDay({ year, month, day, hour: 12 }) + 0.5);
}
function fromDay(dayNumber) {
  const days = dayNumber - EPOCH_DAY, cycle = Math.floor(days / CYCLE_DAYS);
  const inCycle = days - cycle * CYCLE_DAYS;
  let n = Math.min(29, Math.floor(inCycle / 354));
  if (yearStart(n) > inCycle) n--;
  const dayOfYear = inCycle - yearStart(n);
  const month = Math.min(12, Math.floor(dayOfYear / 29.5) + 1);
  return Object.freeze({ year: cycle * 30 + n + 1, month, day: dayOfYear - monthStart(month - 1) + 1 });
}
/** Hybrid Julian/Gregorian civil date -> arithmetic Hijri. No implicit timezone. */
export function solarToHijri(date) {
  return fromDay(civilDay(date));
}
/** Arithmetic Hijri -> hybrid Julian/Gregorian civil date, not an instant. */
export function hijriToSolar(date) {
  if (date === null || typeof date !== 'object') throw new TypeError('Expected a Hijri date');
  const { year, month, day } = date, length = hijriMonthDays(year, month);
  if (!Number.isInteger(day) || day < 1 || day > length)
    throw new RangeError('Invalid day in the arithmetic Hijri month');
  const cycle = Math.floor((year - 1) / 30), n = year - 1 - cycle * 30;
  const dayNumber = EPOCH_DAY + cycle * CYCLE_DAYS + yearStart(n) + monthStart(month - 1) + day - 1;
  const solar = calendarDateFromJulianDay(dayNumber - 0.5);
  const result = Object.freeze({ year: solar.year, month: solar.month, day: solar.day });
  civilDay(result); // Both directions have the same civil-year support range.
  return result;
}
/** UT1 instant -> arithmetic Hijri using an explicit fixed offset; midnight boundary. */
export function instantToHijri(time, offsetMinutes) {
  const local = ZonedTime.fromJulianTime(asUt1JulianDay(time), offsetMinutes);
  return solarToHijri(local);
}

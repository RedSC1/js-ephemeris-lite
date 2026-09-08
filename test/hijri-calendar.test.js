import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { solarToHijri, hijriToSolar, instantToHijri, hijriMonthDays, isHijriLeapYear,
  JulianTime, ZonedTime, julianDay, calendarDateFromJulianDay } from '../src/index.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/hijri-calendar.json', import.meta.url)));
const dateAt = d0 => calendarDateFromJulianDay(2451545 + d0);
// Original getHuiLi arithmetic retained only as an independent compatibility oracle.
function legacy(d0) {
  let d = Math.floor(d0 + .5) + 503105;
  const cycle = Math.floor(d / 10631); d -= cycle * 10631;
  const year = Math.floor((d + .5) / 354.366); d -= Math.floor(year * 354.366 + .5);
  const month = Math.floor((d + .11) / 29.51); d -= Math.floor(month * 29.5 + .5);
  return { year: cycle * 30 + year + 1, month: month + 1, day: d + 1 };
}
test('old Dart Hijri fixtures and wide-span frozen compatibility samples', () => {
  for (const {d0, expected} of fixture.samples) {
    assert.deepEqual(solarToHijri(dateAt(d0)), expected);
    const solar = hijriToSolar(expected);
    assert.equal(julianDay({...solar, hour:12}), 2451545 + d0);
  }
});
test('every day of five full cycles preserves old arithmetic and round trips', () => {
  for (const cycle of [-100,-1,0,46,100]) for (let day=0;day<10631;day++) {
    const d0=-503105+cycle*10631+day, date=dateAt(d0), actual=solarToHijri(date);
    assert.deepEqual(actual,legacy(d0));
    assert.deepEqual(hijriToSolar(actual),{year:date.year,month:date.month,day:date.day});
  }
});
test('leap years and real month lengths, including proleptic years', () => {
  assert.deepEqual(Array.from({length:30},(_,i)=>i+1).filter(isHijriLeapYear),[2,5,7,10,13,16,18,21,24,26,29]);
  for(let year=-30;year<=60;year++) {
    let days=0;
    for(let month=1;month<=12;month++) {
      const length=hijriMonthDays(year,month);days+=length;
      const end={year,month,day:length};
      assert.deepEqual(solarToHijri(hijriToSolar(end)),end);
      assert.throws(()=>hijriToSolar({year,month,day:length+1}),RangeError);
    }
    assert.equal(days,isHijriLeapYear(year)?355:354);
    assert.equal(isHijriLeapYear(year),isHijriLeapYear(year+30));
  }
});
test('explicit offsets select civil midnight, without an implicit Beijing or sunset rule', () => {
  const before=JulianTime.fromUT1(julianDay({year:2000,month:1,day:1,hour:15,minute:59,second:59}));
  const boundary=JulianTime.fromUT1(julianDay({year:2000,month:1,day:1,hour:16}));
  assert.deepEqual(instantToHijri(before,480),{year:1420,month:9,day:24});
  assert.deepEqual(instantToHijri(boundary,480),{year:1420,month:9,day:25});
  assert.deepEqual(instantToHijri(boundary,0),{year:1420,month:9,day:24});
  for(const offset of [-840,-300,0,330,480,840]) {
    const local=ZonedTime.fromJulianTime(boundary,offset);
    assert.deepEqual(instantToHijri(boundary,offset),solarToHijri(local));
  }
  assert.throws(()=>instantToHijri(boundary),RangeError);
  for(const offset of [NaN,Infinity,480.5,841,-841]) assert.throws(()=>instantToHijri(boundary,offset),RangeError);
});
test('date validation, support boundaries and immutable records', () => {
  for(const date of [{year:2026,month:2,day:30},{year:1582,month:10,day:10},{year:2000,month:0,day:1},{year:2000,month:1,day:1.5},{year:-6001,month:1,day:1},{year:10001,month:1,day:1}])
    assert.throws(()=>solarToHijri(date));
  for(const year of [-6000,0,10000]) for(const [month,day] of [[1,1],[12,31]]) {
    const date={year,month,day};assert.deepEqual(hijriToSolar(solarToHijri(date)),date);
  }
  for(const date of [{year:1,month:2,day:30},{year:1,month:12,day:30},{year:2,month:13,day:1},{year:0.5,month:1,day:1}]) assert.throws(()=>hijriToSolar(date),RangeError);
  assert.throws(()=>solarToHijri(null),TypeError);assert.throws(()=>hijriToSolar(null),TypeError);
  assert.throws(()=>instantToHijri(NaN,0));
  assert.ok(Object.isFrozen(solarToHijri({year:2000,month:1,day:1})));
  assert.ok(Object.isFrozen(hijriToSolar({year:1,month:1,day:1})));
});

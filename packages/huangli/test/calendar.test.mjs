import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HuangliCalendar, getHuangliDay, createFlyingStarBoard, getThreeCyclesNinePeriods, ALMANAC_GODS } from '../src/index.js';
import { getQiShuoYear, ZonedTime } from 'js-ephemeris-lite';

const cal=new HuangliCalendar();
const fixture=JSON.parse(readFileSync(new URL('./fixtures/calendar-dart.json',import.meta.url)));
test('368 clock-time calendar cases match Dart outside documented source bugs', () => {
  const instances=new Map();
  assert.equal(fixture.samples.length,368);
  for(const {date:[y,m,d,z,h,exact],result:old} of fixture.samples) {
    const key=`${z}/${exact}`;
    if(!instances.has(key)) instances.set(key,new HuangliCalendar({utcOffsetMinutes:z*60,exactJieQiTime:exact}));
    const x=instances.get(key).getDay(y,m,d,{hour:h});
    const actual={lunar:[x.lunarDate.year,x.lunarDate.month,x.lunarDate.day,x.lunarDate.isLeap],
      ganzhi:[x.pillarNames.year,x.pillarNames.month,x.pillarNames.day],term:x.solarTerm?.name??null,
      mansion:x.mansion.fullName,officer:x.officer,dutyGod:x.dutyGod.name,
      gods:[x.auspiciousGods,x.inauspiciousGods],activities:[x.suitableActivities,x.tabooActivities].map(a=>[...a].sort()),
      pengzu:x.pengZu,taishen:x.taiShen,hours:x.hours.map(h=>[h.branchName,h.isHuangDao]),dailyFlyingStars:x.flyingStars.day};
    for(const field of Object.keys(actual)) assert.deepEqual(actual[field],field==='activities'?old[field].map(a=>[...a].sort()):old[field],`${y}-${m}-${d} ${field}`);
  }
});

test('small Cold day does not subtract the solar year twice; LiChun instant is optional', () => {
  assert.equal(cal.getDay(2026,1,5).pillarNames.year,'乙巳');
  assert.equal(cal.getDay(2026,1,5).pillarNames.month,'己丑');
  const exact=new HuangliCalendar({exactJieQiTime:true});
  assert.equal(cal.getDay(2026,2,4,{hour:0}).pillarNames.year,'丙午');
  assert.equal(exact.getDay(2026,2,4,{hour:0}).pillarNames.year,'乙巳');
  assert.equal(exact.getDay(2026,2,4,{hour:12}).pillarNames.year,'丙午');
});

test('year/month flying stars retain the previous solar year before LiChun', () => {
  // Dart NineStarBoard asks getSpecificJieQi(year - 1, 21), although that API
  // already handles its pre-equinox year adjustment. Do not copy that offset.
  for(const year of [1900,2000,2026]) {
    const c=new HuangliCalendar();
    const jan=c.getDay(year,1,1), feb=c.getDay(year,2,1);
    const mod=(x,n)=>((x%n)+n)%n;
    const expected=9-mod(year-1-2027,9);
    assert.equal(jan.flyingStars.year[4],expected);
    assert.equal(feb.flyingStars.year[4],expected);
    assert.equal(jan.pillars.year,feb.pillars.year);
  }
});

test('1914 historical new-moon assignment remains distinct from astronomical mode', () => {
  // Dart LunarDate uses SSQ historical day assignments. The difference is in
  // the calendar inputs to the rules, not the ported Yi/Ji evaluator.
  const modern=cal.getDay(1914,11,17);
  const historical=new HuangliCalendar({mode:'historical'}).getDay(1914,11,17);
  assert.deepEqual([modern.lunarDate.month,modern.lunarDate.day],[9,30]);
  assert.deepEqual([historical.lunarDate.month,historical.lunarDate.day],[10,1]);
  assert(historical.festivals.includes('寒衣节'));
  assert(!modern.festivals.includes('寒衣节'));
});

test('midnight and late-Zi rules agree across day pillar and daily flying stars', () => {
  const before=cal.getDay(2026,2,4,{hour:22}), late=cal.getDay(2026,2,4,{hour:23});
  const midnight=cal.getDay(2026,2,5,{hour:0}), noon=cal.getDay(2026,2,5,{hour:12});
  assert.notEqual(before.pillars.day,late.pillars.day);
  assert.equal(late.pillars.day,midnight.pillars.day);
  assert.deepEqual(late.flyingStars.day,midnight.flyingStars.day);
  assert.deepEqual(midnight.flyingStars.day,noon.flyingStars.day);
  assert.equal(late.lunarDate.day,before.lunarDate.day); // Display date never silently advances.
  const split=new HuangliCalendar({ratHourMode:'current-day'}).getDay(2026,2,4,{hour:23});
  const tomorrowStem=new HuangliCalendar({ratHourMode:'current-day-tomorrow-stem'}).getDay(2026,2,4,{hour:23});
  assert.equal(split.pillars.day,before.pillars.day);
  assert.equal(tomorrowStem.pillars.day,before.pillars.day);
  assert.notEqual(split.pillars.hour,tomorrowStem.pillars.hour);
});

test('fractional-hour offsets determine local SiJue/SiLi days without hour rounding', () => {
  // 2026 LiChun is shortly after midnight at +04:00, still yesterday at +03:30.
  const a=new HuangliCalendar({utcOffsetMinutes:240}), b=new HuangliCalendar({utcOffsetMinutes:210});
  assert.equal(a.getDay(2026,2,3).flags.isSiJue,true);
  assert.equal(b.getDay(2026,2,3).flags.isSiJue,false);
  assert.equal(b.getDay(2026,2,2).flags.isSiJue,true);
});

test('civil dates, leap months, holidays and JSON preserve the supplied clock', () => {
  assert.equal(cal.getMonth(2026,2).length,28);
  assert.equal(cal.getMonth(0,2).length,29);
  const reform=cal.getMonth(1582,10);
  assert.equal(reform.length,21);
  assert.deepEqual(reform.slice(3,5).map(d=>d.solarDate.day),[4,15]);
  assert.equal(cal.getDay(2025,7,25).lunarDate.isLeap,true);
  assert(cal.getDay(2026,2,17).festivals.includes('春节'));
  const date={year:2026,month:3,day:16,hour:10,minute:11,second:12.5};
  const result=getHuangliDay(date,{utcOffsetMinutes:345});
  assert.deepEqual(result.solarDate,{...date,offsetMinutes:345});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
});

test('nine-palace ordering, boundaries and solstice switching', () => {
  assert.deepEqual(createFlyingStarBoard(5),[4,9,2,3,5,7,8,1,6]);
  assert.deepEqual(getThreeCyclesNinePeriods(2026),{cycle:'下元',period:9});
  const d=cal.getDay(2026,3,16,{hour:10});
  assert.deepEqual(d.flyingStars.year,[9,5,7,8,1,3,4,6,2]);
  assert.deepEqual(d.flyingStars.month,[6,2,4,5,7,9,1,3,8]);
  assert.deepEqual(new HuangliCalendar({flyingStarBoundary:'lunar'}).getDay(2026,3,16).flyingStars.month,[7,3,5,6,8,1,2,4,9]);
  // Mangzhong occurs after 23:00. All-day month stars follow the same
  // civil-day boundary as month pillars, not Dart's extra 23:00 cutoff.
  assert.equal(cal.getDay(2026,6,5).flyingStars.month[4],4);
  assert.equal(new HuangliCalendar({exactJieQiTime:true}).getDay(2026,6,5).flyingStars.month[4],5);
  const event=getQiShuoYear(2026).events.find(e=>e.kind==='solar-term'&&e.termIndex===6);
  const exact=new HuangliCalendar({exactJieQiTime:true});
  const at=delta=>{const t=ZonedTime.fromJulianTime(event.jdUT1+delta,480);return exact.getDay(t.year,t.month,t.day,{hour:t.hour,minute:t.minute,second:t.second});};
  assert.equal(at(-1/86400).flyingStars.forward,true);
  assert.equal(at(1/86400).flyingStars.forward,false);
  assert.equal(new HuangliCalendar({flyingStarMethod:'discontinuous'}).getDay(2026,6,21).flyingStars.day[4],9);
});

test('explicit TuWang flag, defensive validation and cached-result isolation', () => {
  const id=ALMANAC_GODS.find(g=>g.key==='tu_wang_yong_shi').index;
  assert(cal.getDay(2026,3,16,{isTuWangYongShi:true}).godIds.includes(id));
  assert(!cal.getDay(2026,3,16).godIds.includes(id));
  assert.throws(()=>{cal.options={};},TypeError);
  assert.throws(()=>new HuangliCalendar({utcOffsetMinutes:481.5}));
  assert.throws(()=>new HuangliCalendar({longitude:116}));
  assert.throws(()=>cal.getDay(2026,2,30));
  assert.throws(()=>cal.getDay(2026,2,1,{hour:24}));
  assert.throws(()=>cal.getDay(2026,2,1,{timezone:8}));
  const x=cal.getDay(2026,3,16); x.suitableActivities.length=0;x.flyingStars.day[0]=999;
  assert(cal.getDay(2026,3,16).suitableActivities.length>0);
  assert.notEqual(cal.getDay(2026,3,16).flyingStars.day[0],999);
  const term=cal.getDay(2026,2,4).solarTerm;
  term.localTime.hour=99;term.assignedDate.year=99;
  assert.notEqual(cal.getDay(2026,2,4).solarTerm.localTime.hour,99);
  assert.equal(cal.getDay(2026,2,4).solarTerm.assignedDate.year,2026);
});

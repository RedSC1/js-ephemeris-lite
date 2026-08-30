import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HuangliCalendar, getHuangliDay, createFlyingStarBoard, getThreeCyclesNinePeriods,
  ALMANAC_GODS, HUANGLI_LOCALE, localizeHuangliText, getAlmanacGodCatalog,
  getAlmanacActivityCatalog, getPalaceDirections, calculatePaiLong, evaluateAlmanacRules,
} from '../src/index.js';
import { getQiShuoYear, JulianTime, ZonedTime, calendarDateFromJulianDay, julianDay, ganzhiIndex, lunarToSolar } from 'js-ephemeris-lite';
import { getFestivalDetails } from '../src/festivals.js';

const cal=new HuangliCalendar();
const majorFestivals=new HuangliCalendar({festivalMode:'major'});
const allFestivals=new HuangliCalendar({festivalMode:'all'});
const fixture=JSON.parse(readFileSync(new URL('./fixtures/calendar-dart.json',import.meta.url)));
const additions=JSON.parse(readFileSync(new URL('./fixtures/additions-dart.json',import.meta.url)));
test('almanac event accuracy belongs to each instance and cache', () => {
  const dates=[];
  for(const accuracy of ['mid','fast','accurate','mid']) {
      const instance=new HuangliCalendar({eventAccuracy:accuracy});
      const actual=instance.getDay(2026,6,21).solarTerm;
      assert.ok(actual.time instanceof JulianTime);
      assert.equal(actual.time.toZonedTime(480).offsetMinutes,480);
      assert.equal('jdTT' in actual,false);
      const fresh=new HuangliCalendar({eventAccuracy:accuracy}).getDay(2026,6,21).solarTerm;
      assert.equal(actual.time.jdTT,fresh.time.jdTT);
      const event=getQiShuoYear(2026,{eventAccuracy:accuracy,lunarPhaseAnglesDeg:[]}).events.find(e=>e.kind==='solar-term' && e.termIndex===6);
      assert.equal(actual.time.jdTT,event.time.jdTT);
      assert.equal('residualRadians' in event,false);
      dates.push(actual.time.jdTT);
  }
  assert.notEqual(dates[0],dates[1]);
  assert.notEqual(dates[1],dates[2]);
  assert.equal(dates[0],dates[3]);
  assert.throws(()=>new HuangliCalendar({eventAccuracy:'high'}),/eventAccuracy/);
});

test('Traditional Chinese localizes every display layer without changing rule identity', () => {
  const simplified=allFestivals.getDay(2026,8,29);
  const traditional=new HuangliCalendar({festivalMode:'all',locale:HUANGLI_LOCALE.TRADITIONAL}).getDay(2026,8,29);
  assert.equal(traditional.settings.locale,'zh-Hant');
  assert.deepEqual(traditional.godIds,simplified.godIds);
  assert.deepEqual(traditional.suitableIds,simplified.suitableIds);
  assert.deepEqual(traditional.ruleInput,simplified.ruleInput);
  assert(traditional.auspiciousGods.includes('普護'));
  assert(traditional.inauspiciousGods.includes('勾陳'));
  assert(traditional.suitableActivities.includes('修飾垣牆'));
  assert.equal(traditional.dutyGod.name,'勾陳');
  assert.equal(traditional.pengZu,'乙不栽植千株不長，亥不嫁娶不利新郎');
  assert.equal(traditional.godDirections.財神,'東北');
  assert.equal(traditional.hours[1].branchName,'丑');
  assert.equal(traditional.hours[1].pillarName,'丁丑');
  assert.equal(traditional.hours[0].nayin,'澗下水');
  assert.equal(new HuangliCalendar({locale:'zh-Hant'}).getDay(2026,3,5).solarTerm.name,'驚蟄');
  const memorial=new HuangliCalendar({locale:'zh-Hant',festivalMode:'all'}).getDay(2026,12,13).festivalDetails[0];
  assert.equal(memorial.name,'南京大屠殺死難者國家公祭日');
  assert.equal(memorial.shortName,'國家公祭');
  assert.equal(localizeHuangliText('天干丑時與防治荒漠化和干旱日','zh-Hant'),'天干丑時與防治荒漠化和乾旱日');
  assert.equal(localizeHuangliText('黄历、农历与历法','zh-Hant'),'黃曆、農曆與曆法');

  const pure=evaluateAlmanacRules(simplified.ruleInput,{locale:'zh-Hant'});
  assert.deepEqual(pure.godIds,simplified.godIds);
  assert(pure.inauspiciousGods.includes('勾陳'));
  assert(getAlmanacGodCatalog('zh-Hant').some(item=>item.label==='勾陳'));
  assert(getAlmanacActivityCatalog('zh-Hant').some(item=>item.label==='修飾垣牆'));
  assert.deepEqual(getPalaceDirections('zh-Hant'),['東南','正南','西南','正東','中宮','正西','東北','正北','西北']);
  assert.equal(calculatePaiLong('壬','午',{locale:'zh-Hant'}).facingStar,'祿存');
  assert.throws(()=>new HuangliCalendar({locale:'en'}),/locale/);
  assert.throws(()=>evaluateAlmanacRules(simplified.ruleInput,{locale:'en'}),/locale/);
});
test('368 clock-time calendar cases match Dart outside documented source bugs', () => {
  const instances=new Map();
  assert.equal(fixture.samples.length,368);
  for(const {date:[y,m,d,z,h,exact],result:old} of fixture.samples) {
    const key=`${z}/${exact}`;
    if(!instances.has(key)) instances.set(key,new HuangliCalendar({utcOffsetMinutes:z*60,exactJieQiTime:exact,tuWangMethod:'manual'}));
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
  assert(historical.festivals.includes('祭祖节(十月朝)'));
  assert(!modern.festivals.includes('祭祖节(十月朝)'));
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

test('festival details expose formal names, compact labels, levels and aliases', () => {
  for (const [month,day,name,shortName,level,alias] of [
    [3,15,'国际消费者权益日','消费者权益日','popular','消费者权益日'],
    [7,1,'中国共产党成立纪念日','建党日','historical','中共诞辰'],
    [8,1,'中国人民解放军建军纪念日','建军节','historical','建军节'],
    [9,3,'中国人民抗日战争暨世界反法西斯战争胜利纪念日','抗战胜利','historical','抗日战争胜利纪念'],
    [12,13,'南京大屠杀死难者国家公祭日','国家公祭','historical','南京大屠杀纪念日'],
  ]) {
    const result=allFestivals.getDay(2026,month,day);
    const detail=result.festivalDetails.find(f=>f.name===name);
    assert(detail,`${month}-${day}: ${name}`);
    assert.equal(detail.shortName,shortName);
    assert.equal(detail.level,level);
    assert(detail.aliases.includes(alias));
    assert.deepEqual(result.festivals,result.festivalDetails.map(f=>f.name));
  }
  assert(allFestivals.getDay(2026,4,23).festivalDetails[0].aliases.includes('世界读书日'));
});

test('sxwnl lunar aliases merge while distinct folk observances remain separate', () => {
  const qixi=allFestivals.getDay(2026,8,19,{hour:23});
  assert(qixi.festivals.includes('七夕节'));
  assert.deepEqual(qixi.festivalDetails.find(f=>f.name==='七夕节').aliases.sort(),['乞巧节','女儿节']);
  const dragon=getFestivalDetails({year:2026,month:1,day:2},{month:2,day:2,monthDays:30,isLeap:false},null,5,'all');
  assert.deepEqual(dragon.map(f=>[f.name,f.level]),[['龙抬头','traditional'],['畲族会亲节','ethnic']]);
  assert(dragon[0].aliases.includes('春龙节'));
  assert.deepEqual(getFestivalDetails({year:2026,month:1,day:2},{month:2,day:2,monthDays:30,isLeap:true},null,5,'all'),[]);
});

test('festival date rules keep Qingming, weekday holidays and both year-end lengths', () => {
  for(const [month,day,name] of [[4,5,'清明节'],[5,10,'母亲节'],[6,21,'父亲节'],[11,26,'感恩节']]) {
    assert(cal.getDay(2026,month,day).festivals.includes(name));
    assert(!cal.getDay(2026,month,day+1).festivals.includes(name));
  }
  const solar={year:2026,month:1,day:2};
  for(const monthDays of [29,30]) {
    const lunar={month:12,day:monthDays,monthDays,isLeap:false};
    assert(getFestivalDetails(solar,lunar,null,5).some(f=>f.name==='除夕'));
    assert(!getFestivalDetails(solar,{...lunar,day:monthDays-1},null,5).some(f=>f.name==='除夕'));
  }
  const book=cal.getDay(2026,4,23).festivalDetails.find(f=>f.name==='世界图书和版权日');
  assert(book.aliases.includes('世界读书日'));
  assert(!cal.getDay(2026,5,23).festivalDetails.some(f=>f.name.includes('读书')||f.name.includes('版权')));
});

test('seasonal markers follow the mode-resolved solar-term civil days', () => {
  const solar={year:2026,month:7,day:20};
  const lunar={month:6,day:7,monthDays:30,isLeap:true};
  const context={dayNumber:120,dayIndex:6};
  const modernTerms=[
    {name:'夏至',dayNumber:100,assignedDate:{year:2026}},
    {name:'立秋',dayNumber:160,assignedDate:{year:2026}},
  ];
  const historicalTerms=[
    {name:'夏至',dayNumber:101,assignedDate:{year:2026}},
    {name:'立秋',dayNumber:160,assignedDate:{year:2026}},
  ];
  const modern=getFestivalDetails(solar,lunar,null,1,'all',{...context,terms:modernTerms});
  const historical=getFestivalDetails(solar,lunar,null,1,'all',{...context,terms:historicalTerms});
  assert(modern.some(item=>item.name==='初伏'));
  assert(!historical.some(item=>item.name.includes('伏')));
});

test('festival details are fresh JSON snapshots, including nested aliases and sources', () => {
  const day=allFestivals.getDay(2026,8,19);
  assert.deepEqual(JSON.parse(JSON.stringify(day.festivalDetails)),day.festivalDetails);
  day.festivalDetails[0].aliases.push('changed');
  day.festivalDetails[0].shortName='changed';
  day.festivals.length=0;
  const again=allFestivals.getDay(2026,8,19);
  assert.deepEqual(again.festivalDetails[0],{
    name:'七夕节',shortName:'七夕节',level:'traditional',calendarDisplay:'secondary',source:'lunar',isPublicHoliday:false,aliases:['乞巧节','女儿节'],
  });
  assert.deepEqual(again.festivals,['七夕节','末伏第6天']);
});

test('festival calendar display preserves sxwnl A/B/C density independently of semantic level', () => {
  assert.equal(allFestivals.getDay(2026,9,10).festivalDetails.find(f=>f.name==='教师节').calendarDisplay,'secondary');
  assert.equal(allFestivals.getDay(2026,9,9).festivalDetails.find(f=>f.name==='毛泽东逝世纪念日').calendarDisplay,'detail');
  assert.equal(allFestivals.getDay(2026,8,25).festivalDetails.find(f=>f.name==='侗族吃新节').calendarDisplay,'detail');
  assert.equal(allFestivals.getDay(2026,5,31).festivalDetails.find(f=>f.name==='世界无烟日').calendarDisplay,'secondary');
});

test('source-era National Day schedule placeholders are not recurring festivals', () => {
  assert(allFestivals.getDay(2026,10,1).festivals.includes('国庆节'));
  assert(!allFestivals.getDay(2026,10,2).festivals.includes('国庆节假日'));
  assert(!allFestivals.getDay(2026,10,3).festivals.includes('国庆节假日'));
});

test('festival modes separate principal, broadly relevant and complete source data', () => {
  assert(majorFestivals.getDay(2026,8,1).festivals.includes('中国人民解放军建军纪念日'));
  assert(!majorFestivals.getDay(2026,8,6).festivals.includes('火把节'));
  assert(cal.getDay(2026,8,6).festivals.includes('火把节'));
  assert(cal.getDay(2026,5,31).festivals.includes('世界无烟日'));
  assert(!cal.getDay(2026,3,1).festivals.includes('国际海豹日'));
  assert(allFestivals.getDay(2026,3,1).festivals.includes('国际海豹日'));
  assert(!allFestivals.getDay(1926,8,1).festivals.includes('中国人民解放军建军纪念日'));
  assert(allFestivals.getDay(1927,8,1).festivals.includes('中国人民解放军建军纪念日'));
  assert.throws(()=>new HuangliCalendar({festivalMode:'religious'}),/invalid festivalMode/);
  assert.throws(()=>new HuangliCalendar({festivalMode:null}),/invalid festivalMode/);
});

test('festival selection applies to batch queries without changing any Yi/Ji or calendar results', () => {
  const majorYear=majorFestivals.getYear(2026), commonYear=cal.getYear(2026), fullYear=allFestivals.getYear(2026);
  for(let i=0;i<commonYear.length;i++) {
    const {festivals,festivalDetails,settings,...common}=commonYear[i];
    const {festivals:fullNames,festivalDetails:fullDetails,settings:fullSettings,...full}=fullYear[i];
    const majorNames=new Set(majorYear[i].festivals);
    assert.deepEqual(common,full);
    assert.deepEqual(settings,{...fullSettings,festivalMode:'common'});
    assert.deepEqual(festivals,festivalDetails.map(f=>f.name));
    assert.deepEqual(festivalDetails,fullDetails.filter(f=>festivals.includes(f.name)));
    assert([...majorNames].every(name=>festivals.includes(name)));
    assert(!fullNames.includes('杨公忌'));
  }
});

test('Yang Gong Ji remains in the independent rule engine, never in either festival selection', () => {
  const id=ALMANAC_GODS.find(g=>g.key==='yang_gong_ji').index;
  const date=lunarToSolar({year:2026,month:7,day:29,isLeap:false});
  for(const calendar of [cal,allFestivals]) {
    const result=calendar.getDay(date.year,date.month,date.day);
    assert(result.godIds.includes(id));
    assert(!result.festivals.includes('杨公忌'));
    assert(!result.festivalDetails.some(f=>f.name.includes('杨公忌')||f.aliases.includes('杨公忌')));
  }
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
  const at=delta=>{const t=ZonedTime.fromJulianTime(event.time.jdUT1+delta,480);return exact.getDay(t.year,t.month,t.day,{hour:t.hour,minute:t.minute,second:t.second});};
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

test('twelve-hour pillars, Nayin, duty gods and ranges cover all 60 days against Dart', () => {
  const first=julianDay({year:2000,month:1,day:7,hour:12});
  assert.equal(additions.hours.length,720);
  for(let i=0;i<60;i++) {
    const d=calendarDateFromJulianDay(first+i);
    const result=cal.getDay(d.year,d.month,d.day);
    assert.equal(ganzhiIndex(result.pillars.day),i);
    for(const [day,branch,pillarName,nayin,element,god,isHuangDao,start,end,range] of additions.hours.slice(i*12,(i+1)*12)) {
      const h=result.hours[branch];
      assert.deepEqual([i,h.branch,h.pillarName,h.nayin,h.nayinElement,h.name,h.isHuangDao,h.startHour,h.endHour,h.timeRange],
        [day,branch,pillarName,nayin,element,god,isHuangDao,start,end,range]);
    }
  }
});

test('civil hourly table partitions a day and handles both Zi slots in all conventions', () => {
  for(const ratHourMode of ['next-day','current-day','current-day-tomorrow-stem']) {
    const c=new HuangliCalendar({ratHourMode,utcOffsetMinutes:345});
    for(const [year,month,day] of [[2026,2,16],[1582,10,4],[9999,12,31]]) {
      const hours=c.getHours(year,month,day);
      assert.equal(hours.length,13);
      assert.equal(hours[0].segment,'early-zi');
      assert.equal(hours[12].segment,'late-zi');
      assert.equal(hours[12].endHour,24);
      assert.equal(hours[12].endJdUT1-hours[0].startJdUT1,1);
      for(let i=0;i<13;i++) {
        const h=hours[i], x=c.getDay(year,month,day,{hour:h.startHour});
        assert.equal(h.pillar,x.pillars.hour);
        assert.equal(h.dayPillar,x.pillars.day);
        assert.deepEqual(h.flyingStars,x.flyingStars.hour);
        if(i) assert.equal(hours[i-1].endJdUT1,h.startJdUT1);
      }
      assert.equal(hours[12].pillar===hours[0].pillar,ratHourMode==='current-day');
      assert.equal(hours[12].dayPillar===hours[0].dayPillar,ratHourMode!=='next-day');
      if(year===1582)assert.equal(hours[12].endTime.day,15);
      assert.deepEqual(JSON.parse(JSON.stringify(hours)),hours);
    }
  }
  assert.throws(()=>cal.getHours(1582,10,10));
  assert.throws(()=>cal.getHours(10000,1,1));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HuangliCalendar, getHuangliDay, createFlyingStarBoard, getThreeCyclesNinePeriods, ALMANAC_GODS } from '../src/index.js';
import { getQiShuoYear, JulianTime, ZonedTime, calendarDateFromJulianDay, julianDay, ganzhiIndex, lunarToSolar, setEventAccuracy, getEventAccuracy } from 'js-ephemeris-lite';
import { getFestivalDetails } from '../src/festivals.js';

const cal=new HuangliCalendar();
const allFestivals=new HuangliCalendar({festivalMode:'all'});
const fixture=JSON.parse(readFileSync(new URL('./fixtures/calendar-dart.json',import.meta.url)));
const additions=JSON.parse(readFileSync(new URL('./fixtures/additions-dart.json',import.meta.url)));
test('existing almanac instances do not reuse event caches across accuracy modes', () => {
  const saved=getEventAccuracy(), instance=new HuangliCalendar(), dates=[];
  try {
    for(const accuracy of ['mid','fast','accurate','mid']) {
      setEventAccuracy(accuracy);
      const actual=instance.getDay(2026,6,21).solarTerm;
      assert.ok(actual.time instanceof JulianTime);
      assert.equal(actual.time.toZonedTime(480).offsetMinutes,480);
      assert.equal('jdTT' in actual,false);
      const fresh=new HuangliCalendar().getDay(2026,6,21).solarTerm;
      assert.equal(actual.time.jdTT,fresh.time.jdTT);
      const event=getQiShuoYear(2026,{lunarPhaseAnglesDeg:[]}).events.find(e=>e.kind==='solar-term' && e.termIndex===6);
      assert.equal(actual.time.jdTT,event.time.jdTT);
      assert.equal('residualRadians' in event,false);
      dates.push(actual.time.jdTT);
    }
    assert.notEqual(dates[0],dates[1]);
    assert.notEqual(dates[1],dates[2]);
    assert.equal(dates[0],dates[3]);
  } finally { setEventAccuracy(saved); }
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

test('festival display names retain source labels and searchable aliases', () => {
  for (const [month, day, source, name, category] of [
    [1,1,'元旦节','元旦','civic'],
    [2,7,'京汉铁路罢工纪念','二七纪念日','historical'],
    [3,8,'国际劳动妇女节','妇女节','civic'],
    [3,12,'中国植树节','植树节','civic'],
    [4,1,'国际愚人节','愚人节','popular'],
    [5,1,'国际劳动节','劳动节','civic'],
    [5,4,'中国青年节','青年节','civic'],
    [6,1,'国际儿童节','儿童节','civic'],
    [7,7,'中国人民抗日战争纪念日','七七抗战纪念日','historical'],
    [8,1,'中国人民解放军建军节','中国人民解放军建军纪念日','civic'],
    [9,3,'中国抗日战争胜利纪念日','中国人民抗日战争胜利纪念日','historical'],
    [9,10,'中国教师节','教师节','civic'],
    [9,18,'“九·一八”事变纪念日','九一八纪念日','historical'],
    [12,13,'南京大屠杀纪念日','南京大屠杀死难者国家公祭日','historical'],
  ]) {
    const result = allFestivals.getDay(2026,month,day);
    const detail = result.festivalDetails.find(f=>f.name===name);
    assert(detail, `${month}-${day}: ${name}`);
    assert.equal(detail.category,category);
    assert(detail.aliases.includes(source));
    assert.deepEqual(detail.sourceNames,[source]);
    assert(!result.festivals.includes(source));
    assert.deepEqual(result.festivals,result.festivalDetails.map(f=>f.name));
  }
  assert(cal.getDay(2026,8,1).festivalDetails.find(f=>f.category==='civic').aliases.includes('建军节'));
  const march12=allFestivals.getDay(2026,3,12).festivalDetails;
  assert(march12.some(f=>f.name==='孙中山逝世纪念日'&&f.category==='historical'));
  assert(allFestivals.getDay(2026,5,27).festivalDetails.some(f=>f.name==='上海解放日'&&f.category==='local'));
});

test('combined lunar observances split into separate traditional and religious entries', () => {
  const solar={year:2026,month:1,day:2}; // No solar festival.
  for (const [month,day,source,expected] of [
    [2,2,'春龙节-福德土地正神诞',[['龙抬头','traditional'],['福德土地正神诞','religious']]],
    [3,3,'三月三-玄天上帝诞',[['三月三','traditional'],['玄天上帝诞','religious']]],
    [7,7,'七夕-魁星诞',[['七夕节','traditional'],['魁星诞','religious']]],
    [7,13,'长真谭真人诞-大势至菩萨诞',[['长真谭真人诞','religious'],['大势至菩萨诞','religious']]],
    [9,9,'重阳节-酆都大帝诞',[['重阳节','traditional'],['酆都大帝诞','religious']]],
    [12,8,'腊八节-释迦如来成佛之辰',[['腊八节','traditional'],['释迦如来成佛之辰','religious']]],
  ]) {
    const lunar={month,day,monthDays:30,isLeap:false};
    const details=getFestivalDetails(solar,lunar,null,5,'all');
    assert.deepEqual(details.map(f=>[f.name,f.category]),expected);
    for(const detail of details) {
      assert.deepEqual(detail.sourceNames,[source]);
      assert(!detail.aliases.includes(source));
    }
    assert.deepEqual(getFestivalDetails(solar,{...lunar,isLeap:true},null,5,'all'),[]);
  }
  const qixi=allFestivals.getDay(2026,8,19,{hour:23});
  assert.deepEqual(qixi.festivals,['七夕节','魁星诞']);
  assert.deepEqual(qixi.festivalDetails.filter(f=>f.category==='traditional').map(f=>f.name),['七夕节']);
  assert(qixi.festivalDetails[0].aliases.includes('七夕'));
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

test('festival details are fresh JSON snapshots, including nested aliases and sources', () => {
  const day=allFestivals.getDay(2026,8,19);
  assert.deepEqual(JSON.parse(JSON.stringify(day.festivalDetails)),day.festivalDetails);
  day.festivalDetails[0].aliases.push('changed');
  day.festivalDetails[0].sourceNames.length=0;
  day.festivalDetails[0].category='changed';
  day.festivals.length=0;
  const again=allFestivals.getDay(2026,8,19);
  assert.deepEqual(again.festivalDetails[0],{
    name:'七夕节',category:'traditional',aliases:['七夕'],sourceNames:['七夕-魁星诞'],
  });
  assert.deepEqual(again.festivals,['七夕节','魁星诞']);
});

test('common festivals keep familiar dates and leave detailed observances opt-in', () => {
  assert.deepEqual(cal.getDay(2026,2,17).festivals,['春节']);
  assert.deepEqual(cal.getDay(2026,8,19).festivals,['七夕节']);
  assert.deepEqual(cal.getDay(2026,3,12).festivals,['植树节']);
  assert(!cal.getDay(2026,5,27).festivals.includes('上海解放日'));
  assert(!cal.getDay(2026,3,1).festivals.includes('国际海豹日'));
  assert(allFestivals.getDay(2026,3,1).festivals.includes('国际海豹日'));
  const dragon=getFestivalDetails({year:2026,month:1,day:2},{month:2,day:2,monthDays:30,isLeap:false},null,5);
  assert.deepEqual(dragon,[{name:'龙抬头',category:'traditional',aliases:['春龙节'],sourceNames:['春龙节-福德土地正神诞']}]);
  assert.throws(()=>new HuangliCalendar({festivalMode:'religious'}),/invalid festivalMode/);
  assert.throws(()=>new HuangliCalendar({festivalMode:null}),/invalid festivalMode/);
});

test('festival selection applies to batch queries without changing any Yi/Ji or calendar results', () => {
  const commonYear=cal.getYear(2026), fullYear=allFestivals.getYear(2026);
  const names=new Set();
  for(let i=0;i<commonYear.length;i++) {
    const {festivals,festivalDetails,settings,...common}=commonYear[i];
    const {festivals:fullNames,festivalDetails:fullDetails,settings:fullSettings,...full}=fullYear[i];
    assert.deepEqual(common,full);
    assert.deepEqual(settings,{...fullSettings,festivalMode:'common'});
    assert.deepEqual(festivals,festivalDetails.map(f=>f.name));
    assert(festivalDetails.every(f=>f.category!=='religious'&&f.category!=='local'));
    assert.deepEqual(festivalDetails,fullDetails.filter(f=>festivals.includes(f.name)));
    assert(!fullNames.includes('杨公忌'));
    festivals.forEach(name=>names.add(name));
  }
  assert.deepEqual([...names].sort(),[
    '元旦','春节','清明节','劳动节','端午节','中秋节','国庆节',
    '除夕','元宵节','龙抬头','三月三','七夕节','中元节','重阳节','寒衣节','下元节','腊八节','小年',
    '妇女节','青年节','儿童节','中国人民解放军建军纪念日','植树节','教师节',
    '情人节','愚人节','母亲节','父亲节','感恩节','平安夜','圣诞节',
    '中国共产党诞生日','香港回归纪念日','七七抗战纪念日','中国人民抗日战争胜利纪念日',
    '九一八纪念日','南京大屠杀死难者国家公祭日',
    '国际消费者权益日','世界图书和版权日','世界环境日',
  ].sort());
});

test('Yang Gong Ji remains in the independent rule engine, never in either festival selection', () => {
  const id=ALMANAC_GODS.find(g=>g.key==='yang_gong_ji').index;
  const date=lunarToSolar({year:2026,month:7,day:29,isLeap:false});
  for(const calendar of [cal,allFestivals]) {
    const result=calendar.getDay(date.year,date.month,date.day);
    assert(result.godIds.includes(id));
    assert(!result.festivals.includes('杨公忌'));
    assert(!result.festivalDetails.some(f=>f.sourceNames.includes('杨公忌')));
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

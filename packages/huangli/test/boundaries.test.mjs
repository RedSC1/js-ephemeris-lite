import test from 'node:test';
import assert from 'node:assert/strict';
import {HuangliCalendar,evaluateAlmanacRules,createFlyingStarBoard,ALMANAC_GODS} from '../src/index.js';
import {getQiShuoYear,ZonedTime,julianDay,calendarDateFromJulianDay,solarToLunar} from 'js-ephemeris-lite';

const mod=(n,m)=>(n%m+m)%m;
const civilDay=d=>Math.floor(julianDay({...d,hour:12,minute:0,second:0})+0.5);
// Only pass clock fields: getDay intentionally rejects unknown options.
const query=(calendar,time)=>calendar.getDay(time.year,time.month,time.day,
  {hour:time.hour,minute:time.minute,second:time.second});

test('24 terms switch year/month at the selected local day or physical instant',()=>{
  for(const offset of [-720,0,210,345,420,480,840]){
    const terms=getQiShuoYear(2026,{utcOffsetMinutes:offset,mode:'china-astronomical'}).events.filter(e=>e.kind==='solar-term');
    const exact=new HuangliCalendar({utcOffsetMinutes:offset,exactJieQiTime:true});
    const daily=new HuangliCalendar({utcOffsetMinutes:offset});
    for(const term of terms){
      const before=query(exact,ZonedTime.fromJulianTime(term.jdUT1-2/86400,offset));
      const after=query(exact,ZonedTime.fromJulianTime(term.jdUT1+2/86400,offset));
      const monthBranch=mod(Math.floor(mod(term.termIndex+5,24)/2)+1,12);
      assert.equal(after.ruleInput.monthBranch,monthBranch);
      assert.equal(before.ruleInput.monthBranch,mod(monthBranch-(term.termIndex%2),12));
      assert.equal(mod(after.ruleInput.yearIndex-before.ruleInput.yearIndex,60),term.termIndex===21?1:0);
      const midnight=daily.getDay(term.localTime.year,term.localTime.month,term.localTime.day,{hour:0});
      assert.equal(midnight.ruleInput.monthBranch,monthBranch);
      assert.equal(midnight.ruleInput.yearIndex,after.ruleInput.yearIndex);
      // Modern seasonal Yi/Ji retains the source's physical next-term input,
      // independently of the all-day year/month pillar convention.
      assert.equal(before.ruleInput.nextSolarTermIndex,mod(term.termIndex+5,24));
      assert.equal(after.ruleInput.nextSolarTermIndex,mod(term.termIndex+6,24));
    }
  }
});

test('solstice day/hour stars obey integer days at midnight and late Zi across offsets',()=>{
  for(const offset of [-720,0,210,345,420,480,840]){
    const terms=[2025,2026].flatMap(y=>getQiShuoYear(y,{utcOffsetMinutes:offset,mode:'china-astronomical'}).events)
      .filter(e=>e.kind==='solar-term'&&[6,18].includes(e.termIndex));
    for(const ratHourMode of ['next-day','current-day','current-day-tomorrow-stem'])
      for(const exactJieQiTime of [false,true])for(const flyingStarMethod of ['consecutive','discontinuous']){
        const c=new HuangliCalendar({utcOffsetMinutes:offset,ratHourMode,exactJieQiTime,flyingStarMethod});
        const metaEvent=e=>e.localCivilDayNumber+(ratHourMode==='next-day'&&e.localTime.hour>=23?1:0);
        for(const event of terms.filter(e=>e.localTime.year===2026))for(const shift of [-1,0,1]){
          const date=calendarDateFromJulianDay(event.localCivilDayNumber+shift);
          for(const [hour,minute,second] of [[0,0,0],[0,0,1],[22,59,59],[23,0,0],[23,0,1]]){
            const x=c.getDay(date.year,date.month,date.day,{hour,minute,second});
            const day=civilDay(date)+(ratHourMode==='next-day'&&hour===23?1:0);
            const solstice=terms.filter(e=>exactJieQiTime?e.jdUT1<=x.jdUT1:metaEvent(e)<=day).at(-1);
            const forward=solstice.termIndex===18;
            let anchor=metaEvent(solstice);
            if(flyingStarMethod==='consecutive'){
              const cycle=mod(anchor-2451551,60);
              anchor+=cycle>29?60-cycle:-cycle;
            }
            const center=forward?mod(day-anchor,9)+1:9-mod(day-anchor,9);
            const dayBranch=mod(day-2451551,12);
            const base=3*(dayBranch%3),hourBranch=Math.floor((hour+1)/2)%12;
            const hourCenter=mod((forward?base:8-base)+(forward?hourBranch:-hourBranch),9)+1;
            assert.equal(x.flyingStars.forward,forward);
            assert.deepEqual(x.flyingStars.day,createFlyingStarBoard(center,forward));
            assert.deepEqual(x.flyingStars.hour,createFlyingStarBoard(hourCenter,forward));
            assert.equal(civilDay(x.ruleDate),day);
          }
        }
      }
  }
});

test('historical seasonal rules follow assigned term dates, ignoring the exact-time flag',()=>{
  for(const year of [700,1914,2026]){
    const terms=getQiShuoYear(year,{mode:'historical'}).events.filter(e=>e.kind==='solar-term');
    const c=new HuangliCalendar({mode:'historical'}),exact=new HuangliCalendar({mode:'historical',exactJieQiTime:true});
    for(const term of terms){
      const {year:y,month,day}=term.assignedDate;
      const morning=c.getDay(y,month,day,{hour:0}),afternoon=c.getDay(y,month,day,{hour:18});
      assert.equal(morning.solarTerm?.name,term.name);
      assert.equal(morning.ruleInput.nextSolarTermIndex,mod(term.termIndex+6,24));
      assert.deepEqual(morning.ruleInput,afternoon.ruleInput);
      const override=exact.getDay(y,month,day,{hour:0});
      assert.deepEqual(morning.ruleInput,override.ruleInput);
      assert.deepEqual(morning.flyingStars,override.flyingStars);
    }
  }
});

test('rule provenance is replayable, JSON-safe and isolated from caller-owned masks',()=>{
  const mask=[0,1,2,3],c=new HuangliCalendar({flyingStarBoundary:'lunar'});
  const x=c.getDay(2026,2,16,{hour:23,activityMask:mask});
  assert.deepEqual(x.ruleDate,{year:2026,month:2,day:17});
  assert.equal(x.lunarDate.month,12);
  assert.equal(x.ruleLunarDate.month,1);
  assert.equal(x.ruleLunarDate.day,1);
  const next=c.getDay(2026,2,17,{hour:0});
  assert.deepEqual(x.flyingStars.year,next.flyingStars.year);
  assert.deepEqual(x.flyingStars.month,next.flyingStars.month);
  const replay=evaluateAlmanacRules(x.ruleInput);
  for(const [key,value] of Object.entries(replay))assert.deepEqual(x[key],value);
  assert.deepEqual(JSON.parse(JSON.stringify(x)),x);
  mask.push(4);
  assert.deepEqual(x.ruleInput.activityMask,[0,1,2,3]);
  x.ruleLunarDate.day=99;x.ruleDate.day=99;x.ruleInput.dayIndex=99;
  const again=c.getDay(2026,2,16,{hour:23});
  assert.equal(again.ruleLunarDate.day,1);
  assert.equal(again.ruleDate.day,17);
  assert.notEqual(again.ruleInput.dayIndex,99);
});

test('early historical thirteenth month is preserved without mapping it to month one',()=>{
  const c=new HuangliCalendar({mode:'historical',flyingStarBoundary:'lunar'});
  const x=c.getDay(-720,11,25);
  assert.equal(x.lunarDate.month,13);
  assert.equal(x.lunarDate.isLeap,true);
  assert.equal(x.ruleInput.lunarMonth,13);
  assert.deepEqual(x.godIds,evaluateAlmanacRules(x.ruleInput).godIds);
  assert.equal(c.getMonth(-720,11).length,30);
});

test('Chinese calendar structure and local UTC+7 structure are explicit choices',()=>{
  const event=getQiShuoYear(2020,{mode:'china-astronomical',utcOffsetMinutes:420}).events
    .find(e=>e.kind==='lunar-phase'&&e.phaseAngleDeg===0&&e.localCivilDayNumber!==e.assignedCivilDayNumber);
  assert(event,'fixture needs a new moon between local and Chinese midnight');
  const date=event.localTime;
  const local=new HuangliCalendar({mode:'local-astronomical',utcOffsetMinutes:420});
  const china=new HuangliCalendar({mode:'china-astronomical',utcOffsetMinutes:420});
  const a=query(local,date),b=query(china,date);
  assert.equal(a.lunarDate.day,1);
  assert.notEqual(b.lunarDate.day,1);
  assert.deepEqual(a.lunarDate,solarToLunar(date,{mode:'local-astronomical',utcOffsetMinutes:420}));
  assert.deepEqual(a.moonPhases,b.moonPhases); // Both show actual local sky events.
});

test('batch queries use the same clock/settings as individual days, including the reform gap',()=>{
  for(const [year,month,mode] of [[2026,2,'local-astronomical'],[1582,10,'historical'],[-720,11,'historical']]){
    const calendar=new HuangliCalendar({mode,utcOffsetMinutes:345,ratHourMode:'current-day-tomorrow-stem'});
    const options={hour:23,minute:45,second:12.5,activityMask:[]};
    const days=calendar.getMonth(year,month,options);
    for(const d of days){
      assert.equal(d.solarDate.hour,23);
      assert.deepEqual(d,calendar.getDay(year,month,d.solarDate.day,options));
      assert.deepEqual(d.suitableActivities,[]);
      assert.deepEqual(d.tabooActivities,[]);
    }
    if(year===1582)assert.deepEqual(days.slice(3,5).map(d=>d.solarDate.day),[4,15]);
  }
  const calendar=new HuangliCalendar();
  const year=calendar.getYear(2026,{hour:0});
  assert.equal(year.length,365);
  assert.deepEqual(year[0],calendar.getDay(2026,1,1,{hour:0}));
  assert.deepEqual(year.at(-1),calendar.getDay(2026,12,31,{hour:0}));
  for(const field of ['hour','minute','second'])assert.throws(()=>calendar.getDay(2026,1,1,{[field]:NaN}));
  assert.throws(()=>calendar.getDay(1582,10,10));
  assert.throws(()=>calendar.getMonth(2026,13));
  assert.throws(()=>calendar.getYear(10000));
  assert.throws(()=>calendar.getDay(2026,1,1,{activityMask:[98]}));
});

test('TuWang uses exactly the 18 rule days before each assigned season start',()=>{
  const id=ALMANAC_GODS.find(g=>g.key==='tu_wang_yong_shi').index;
  for(const mode of ['china-astronomical','historical','local-astronomical'])
    for(const utcOffsetMinutes of [210,480]) {
      const c=new HuangliCalendar({mode,utcOffsetMinutes});
      const exact=new HuangliCalendar({mode,utcOffsetMinutes,exactJieQiTime:true});
      const periods=c.getTuWangPeriods(2026);
      assert.equal(periods.length,4);
      const terms=getQiShuoYear(2026,{mode,utcOffsetMinutes}).events
        .filter(e=>e.kind==='solar-term'&&[21,3,9,15].includes(e.termIndex));
      for(let i=0;i<4;i++) {
        const p=periods[i],start=civilDay(p.startDate),end=civilDay(p.endDateExclusive);
        assert.equal(end-start,18);
        assert.equal(end,mode==='historical'?terms[i].assignedCivilDayNumber:terms[i].localCivilDayNumber);
        for(const offset of [-1,0,1,16,17,18]) {
          const date=calendarDateFromJulianDay(start+offset);
          const x=c.getDay(date.year,date.month,date.day);
          const expected=offset>=0&&offset<18;
          assert.equal(x.flags.isTuWangYongShi,expected);
          assert.equal(x.godIds.includes(id),expected);
          assert.equal(x.tuWangYongShi.source,'calendar');
          assert.equal(exact.getDay(date.year,date.month,date.day).flags.isTuWangYongShi,expected);
          const replay=evaluateAlmanacRules(x.ruleInput);
          assert.deepEqual(x.tabooIds,replay.tabooIds);
        }
        const previous=calendarDateFromJulianDay(start-1);
        assert(c.getDay(previous.year,previous.month,previous.day,{hour:23}).flags.isTuWangYongShi);
        const split=new HuangliCalendar({mode,utcOffsetMinutes,ratHourMode:'current-day'});
        assert(!split.getDay(previous.year,previous.month,previous.day,{hour:23}).flags.isTuWangYongShi);
      }
    }
});

test('TuWang manual mode and explicit false overrides preserve caller control',()=>{
  const c=new HuangliCalendar(), manual=new HuangliCalendar({tuWangMethod:'manual'});
  const date=c.getTuWangPeriods(2026)[0].startDate;
  const args=[date.year,date.month,date.day];
  assert(c.getDay(...args).flags.isTuWangYongShi);
  const suppressed=c.getDay(...args,{isTuWangYongShi:false});
  assert(!suppressed.flags.isTuWangYongShi);
  assert.equal(suppressed.tuWangYongShi.source,'override');
  assert(!manual.getDay(...args).flags.isTuWangYongShi);
  assert.equal(manual.getDay(...args).tuWangYongShi.source,'manual');
  assert(manual.getDay(...args,{isTuWangYongShi:true}).flags.isTuWangYongShi);
  assert.throws(()=>new HuangliCalendar({tuWangMethod:'invented'}));
  assert.throws(()=>c.getDay(...args,{isTuWangYongShi:null}));
  assert.throws(()=>c.getTuWangPeriods(10000));
  const p=c.getTuWangPeriods(2026);p[0].startDate.year=99;
  assert.equal(c.getTuWangPeriods(2026)[0].startDate.year,2026);
});

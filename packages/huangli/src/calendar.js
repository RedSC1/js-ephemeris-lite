import {
  ZonedTime, julianDay, calendarDateFromJulianDay, CALENDAR_MODE,
  solarToLunar, fourPillarsForZonedTime, ganzhiIndex, ganzhiName, makeGanzhi, getMonthGanzhi,
  RAT_HOUR_MODE, getQiShuoYear, getHourGanzhi, ganzhiStem, getNayinId, getNayinElement,
} from 'js-ephemeris-lite';
import { DATA } from './data.js';
import { evaluateAlmanacRules } from './rules.js';
import { mod, integer } from './rule-tables.js';
import { createFlyingStarBoard, getThreeCyclesNinePeriods } from './feng-shui.js';
import { getFestivalDetails } from './festivals.js';
export { createFlyingStarBoard, getThreeCyclesNinePeriods, PALACE_DIRECTIONS } from './feng-shui.js';

const DUTY_NAMES=['青龙','明堂','天刑','朱雀','金匮','天德','白虎','玉堂','天牢','玄武','司命','勾陈'];
const SEASON_STARTS = [21, 3, 9, 15];
const NAYIN_NAMES = '海中金 炉中火 大林木 路旁土 剑锋金 山头火 涧下水 城头土 白蜡金 杨柳木 泉中水 屋上土 霹雳火 松柏木 长流水 沙中金 山下火 平地木 壁上土 金箔金 覆灯火 天河水 大驿土 钗钏金 桑柘木 大溪水 沙中土 天上火 石榴木 大海水'.split(' ');
const WUXING_NAMES = ['水', '木', '金', '土', '火'];
const hourText = hour => String(hour).padStart(2, '0') + ':00';
function duty(target, source) {
  const index=mod(target-mod(source-2,6)*2,12);
  return { index, name:DUTY_NAMES[index], isHuangDao:[0,1,4,5,7,10].includes(index) };
}
function dateAt(day) { const {year,month,day:d}=calendarDateFromJulianDay(day); return {year,month,day:d}; }
function tuWangPeriod(term) {
  return { seasonStart: term.name, startDate: dateAt(term.dayNumber - 18), endDateExclusive: dateAt(term.dayNumber) };
}
function describeHour(dayPillar, branch, pillar = getHourGanzhi(ganzhiStem(dayPillar), branch)) {
  const startHour = mod(branch * 2 - 1, 24), endHour = (branch * 2 + 1) % 24;
  const nayinId = getNayinId(pillar);
  return { branch, branchName: '子丑寅卯辰巳午未申酉戌亥'[branch], ...duty(branch, dayPillar & 15),
    dayPillar, pillar, pillarName: ganzhiName(pillar), nayinId, nayin: NAYIN_NAMES[nayinId],
    nayinElement: WUXING_NAMES[getNayinElement(pillar)], startHour, endHour,
    timeRange: `${hourText(startHour)} - ${hourText(endHour)}` };
}
/** Explicit clock time, fixed minute offset, and shared js-ephemeris-lite calendar. */
export class HuangliCalendar {
  #cache=new Map();
  constructor(options={}) {
    const config={utcOffsetMinutes:480, ratHourMode:RAT_HOUR_MODE.NEXT_DAY, exactJieQiTime:false,
      mode:CALENDAR_MODE.CHINA_ASTRONOMICAL, flyingStarMethod:'consecutive', flyingStarBoundary:'solar',
      isYeargodDuty:true, tuWangMethod:'four-seasons-18-days', festivalMode:'common', ...options};
    integer(config.utcOffsetMinutes,-840,840,'utcOffsetMinutes');
    if(!Object.values(RAT_HOUR_MODE).includes(config.ratHourMode)) throw new RangeError('invalid ratHourMode');
    if(!Object.values(CALENDAR_MODE).includes(config.mode)) throw new RangeError('invalid calendar mode');
    if(!['consecutive','discontinuous'].includes(config.flyingStarMethod)) throw new RangeError('invalid flyingStarMethod');
    if(!['solar','lunar'].includes(config.flyingStarBoundary)) throw new RangeError('invalid flyingStarBoundary');
    if(!['four-seasons-18-days','manual'].includes(config.tuWangMethod)) throw new RangeError('invalid tuWangMethod');
    if(!['common','all'].includes(config.festivalMode)) throw new RangeError('invalid festivalMode');
    if(typeof config.exactJieQiTime!=='boolean' || typeof config.isYeargodDuty!=='boolean') throw new TypeError('flags must be boolean');
    // The almanac boundary is the selected clock offset, not an inferred longitude.
    for(const key of Object.keys(options)) if(!['utcOffsetMinutes','ratHourMode','exactJieQiTime','mode','flyingStarMethod','flyingStarBoundary','isYeargodDuty','tuWangMethod','festivalMode'].includes(key)) throw new RangeError(`unknown almanac option: ${key}`);
    this.options=Object.freeze(config);
    Object.freeze(this); // Configuration cannot change underneath the event cache.
  }
  #events(year) {
    if(!this.#cache.has(year)) {
      const result=getQiShuoYear(year,{mode:this.options.mode,utcOffsetMinutes:this.options.utcOffsetMinutes,
        lunarPhaseAnglesDeg:[0,90,180,270]});
      const events=result.events.map(e=>({...e,dayNumber:this.options.mode==='historical' && e.kind==='solar-term'?e.assignedCivilDayNumber:e.localCivilDayNumber}));
      this.#cache.set(year,events);
      if(this.#cache.size>6) this.#cache.delete(this.#cache.keys().next().value);
    }
    return this.#cache.get(year);
  }
  getDay(year,month,day,options={}) {
    integer(year,-5999,9999,'year');
    const {hour=12,minute=0,second=0,isTuWangYongShi,activityMask}=options;
    for(const key of Object.keys(options)) if(!['hour','minute','second','isTuWangYongShi','activityMask'].includes(key)) throw new RangeError(`unknown day option: ${key}`);
    if(isTuWangYongShi!==undefined && typeof isTuWangYongShi!=='boolean') throw new TypeError('isTuWangYongShi must be boolean');
    const cfg=this.options, date=new ZonedTime({year,month,day,hour,minute,second,offsetMinutes:cfg.utcOffsetMinutes});
    const jdUT1=date.toJulianTime().jdUT1;
    const localDay=Math.floor(julianDay({year,month,day,hour:12})+0.5);
    const nextDay=cfg.ratHourMode===RAT_HOUR_MODE.NEXT_DAY && hour>=23;
    const metaDay=localDay+(nextDay?1:0), metaDate=dateAt(metaDay);
    const all=[...this.#events(year-1),...this.#events(year),...this.#events(year+1)].sort((a,b)=>a.jdTT-b.jdTT);
    const terms=all.filter(e=>e.kind==='solar-term');
    const nextSeason=terms.find(e=>SEASON_STARTS.includes(e.termIndex) && e.dayNumber>metaDay);
    const automaticTuWang=nextSeason.dayNumber-metaDay<=18;
    const tuWangYongShi={...tuWangPeriod(nextSeason),
      active:isTuWangYongShi ?? (cfg.tuWangMethod==='four-seasons-18-days' && automaticTuWang),
      source:isTuWangYongShi!==undefined?'override':cfg.tuWangMethod==='manual'?'manual':'calendar'};
    const passed=e=>cfg.exactJieQiTime && cfg.mode!=='historical'?e.jdUT1<=jdUT1:e.dayNumber<=localDay;
    const previous=terms.filter(passed).at(-1);
    // Historical terms are day assignments, not physical instants. In that
    // mode the seasonal Yi/Ji input must advance on the assigned day too.
    const upcoming=terms.find(e=>cfg.mode==='historical'?e.dayNumber>localDay:e.jdUT1>jdUT1);
    const todayTerm=terms.find(e=>e.dayNumber===localDay) ?? null;
    const tomorrowTerm=terms.find(e=>e.dayNumber===localDay+1);
    const lichun=terms.filter(e=>e.termIndex===21 && passed(e)).at(-1);
    const solarYear=lichun.assignedDate.year;
    const termIndex=mod(previous.termIndex+5,24), monthBranch=(Math.floor(termIndex/2)+1)%12;
    const yearIndex=mod(solarYear-1984,60), yearPillar=makeGanzhi(yearIndex%10,yearIndex%12);
    const calendarOptions={mode:cfg.mode,utcOffsetMinutes:cfg.utcOffsetMinutes,ratHourMode:cfg.ratHourMode};
    const pillars={...fourPillarsForZonedTime(date,calendarOptions), year:yearPillar,month:getMonthGanzhi(yearIndex%10,mod(monthBranch-2,12))};
    const lunar=solarToLunar({year,month,day},calendarOptions), metaLunar=nextDay?solarToLunar(metaDate,calendarOptions):lunar;
    const dayIndex=ganzhiIndex(pillars.day), mansion=DATA.mansions[mod(metaDay-2451545+16,28)];
    const flags={isSiJue:!!tomorrowTerm && [21,3,9,15].includes(tomorrowTerm.termIndex),
      isSiLi:!!tomorrowTerm && [0,6,12,18].includes(tomorrowTerm.termIndex),isTuWangYongShi:tuWangYongShi.active};
    const ruleInput={monthBranch,dayIndex,yearIndex,lunarMonth:metaLunar.month,lunarDay:metaLunar.day,
      mansion:mansion.fullName,nextSolarTermIndex:mod(upcoming.termIndex+5,24),...flags,
      isPhaseOfMoon:all.some(e=>e.kind==='lunar-phase' && e.localCivilDayNumber===metaDay),isYeargodDuty:cfg.isYeargodDuty,
      ...(activityMask===undefined?{}:{activityMask:Array.isArray(activityMask)?[...activityMask]:activityMask})};
    const rules=evaluateAlmanacRules(ruleInput);
    const weekday=mod(localDay,7)+1;
    const festivalDetails=getFestivalDetails({year,month,day},lunar,todayTerm,weekday,cfg.festivalMode);
    // Solstice side and nearest Jiazi anchor reproduce the source's actual
    // consecutive/discontinuous anchor algorithms. Integer civil days avoid
    // the source's epsilon subtraction assigning exact midnight to yesterday.
    const metaTermDay=e=>e.dayNumber+(cfg.mode!=='historical' && cfg.ratHourMode===RAT_HOUR_MODE.NEXT_DAY && e.localTime.hour>=23?1:0);
    const solstice=terms.filter(e=>[6,18].includes(e.termIndex) &&
      (cfg.exactJieQiTime && cfg.mode!=='historical'?e.jdUT1<=jdUT1:metaTermDay(e)<=metaDay)).at(-1);
    const forward=solstice.termIndex===18;
    let anchor=metaTermDay(solstice), n=mod(anchor-2451551,60);
    if(cfg.flyingStarMethod==='consecutive') anchor+=n>29?60-n:-n;
    const dayCenter=(forward?mod(metaDay-anchor,9):8-mod(metaDay-anchor,9))+1;
    const hourIndex=Math.floor((hour+1)/2)%12;
    const hourBase=(dayIndex%12%3)*3;
    const hourCenter=mod((forward?hourBase:8-hourBase)+hourIndex*(forward?1:-1),9)+1;
    const starYear=cfg.flyingStarBoundary==='lunar'?metaLunar.year:solarYear;
    const starMonthBranch=cfg.flyingStarBoundary==='lunar'?(metaLunar.month+1)%12:monthBranch;
    const starYearBranch=mod(starYear-1984,12);
    const result={
      solarDate:date.toJSON(), lunarDate:lunar, jdUT1, weekday, pillars,
      ruleDate:metaDate, ruleLunarDate:{...metaLunar}, ruleInput,
      pillarNames:Object.fromEntries(Object.entries(pillars).map(([k,v])=>[k,ganzhiName(v)])),
      solarTerm:todayTerm?{name:todayTerm.name,jdTT:todayTerm.jdTT,jdUT1:todayTerm.jdUT1,localTime:{...todayTerm.localTime},assignedDate:{...todayTerm.assignedDate}}:null,
      moonPhases:all.filter(e=>e.kind==='lunar-phase' && e.localCivilDayNumber===localDay).map(e=>({name:e.name,jdTT:e.jdTT,jdUT1:e.jdUT1})),
      mansion:{...mansion}, festivals:festivalDetails.map(f=>f.name), festivalDetails,
      flags, tuWangYongShi, ...rules, dutyGod:duty(dayIndex%12,monthBranch),
      pengZu:`${DATA.pengzuStem[dayIndex%10]}，${DATA.pengzuBranch[dayIndex%12]}`,
      taiShen:DATA.taishen[dayIndex],godDirections:{...DATA.directions[dayIndex%10]},
      chongSha:{branch:'子丑寅卯辰巳午未申酉戌亥'[(dayIndex%12+6)%12],animal:'鼠牛虎兔龙蛇马羊猴鸡狗猪'[(dayIndex%12+6)%12],direction:['南','东','北','西'][dayIndex%4]},
      hours:Array.from({length:12},(_,branch)=>describeHour(pillars.day,branch)),
      flyingStars:{year:createFlyingStarBoard(9-mod(starYear-2027,9)),
        month:createFlyingStarBoard(mod(7-3*(starYearBranch%3)-mod(starMonthBranch-2,12),9)+1),
        day:createFlyingStarBoard(dayCenter,forward),hour:createFlyingStarBoard(hourCenter,forward),forward},
      ...getThreeCyclesNinePeriods(year),
    };
    // Plain data: JSON.stringify(result) includes birth/clock time and settings.
    return {...result,settings:{...cfg}};
  }
  getMonth(year,month,options={}) {
    integer(year,-5999,9999,'year'); integer(month,1,12,'month');
    const start=julianDay({year,month,day:1,hour:12});
    const end=julianDay({year:month===12?year+1:year,month:month===12?1:month+1,day:1,hour:12});
    return Array.from({length:Math.round(end-start)},(_,i)=>{const d=calendarDateFromJulianDay(start+i);return this.getDay(d.year,d.month,d.day,options);});
  }
  getYear(year,options={}) { integer(year,-5999,9999,'year'); return Array.from({length:12},(_,i)=>this.getMonth(year,i+1,options)).flat(); }
  getTuWangPeriods(year) {
    integer(year,-5999,9999,'year');
    return this.#events(year).filter(e=>e.kind==='solar-term' && SEASON_STARTS.includes(e.termIndex))
      .sort((a,b)=>a.dayNumber-b.dayNumber).map(tuWangPeriod);
  }
  /** Civil-day intervals; day/hour pillars and stars are sampled at each interval start. */
  getHours(year,month,day) {
    integer(year,-5999,9999,'year');
    const offsetMinutes=this.options.utcOffsetMinutes;
    const nextDate=dateAt(Math.floor(julianDay({year,month,day,hour:12})+0.5)+1);
    const starts=[0,1,3,5,7,9,11,13,15,17,19,21,23];
    return starts.map((hour,i)=>{
      const endHour=starts[i+1]??24;
      const start=new ZonedTime({year,month,day,hour,offsetMinutes});
      const end=new ZonedTime(endHour===24?{...nextDate,offsetMinutes}:{year,month,day,hour:endHour,offsetMinutes});
      const result=this.getDay(year,month,day,{hour});
      const branch=Math.floor((hour+1)/2)%12;
      return {...describeHour(result.pillars.day,branch,result.pillars.hour),
        startHour:hour,endHour,timeRange:`${hourText(hour)} - ${hourText(endHour)}`,
        segment:i===0?'early-zi':i===12?'late-zi':'hour',
        startTime:start.toJSON(),endTime:end.toJSON(),
        startJdUT1:start.toJulianTime().jdUT1,endJdUT1:end.toJulianTime().jdUT1,
        flyingStars:[...result.flyingStars.hour],forward:result.flyingStars.forward};
    });
  }
}

export function getHuangliDay(date,options={}) {
  const {year,month,day,...clock}=date;
  return new HuangliCalendar(options).getDay(year,month,day,clock);
}

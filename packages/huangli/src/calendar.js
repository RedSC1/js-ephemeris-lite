import {
  ZonedTime, julianDay, calendarDateFromJulianDay, CALENDAR_MODE,
  solarToLunar, fourPillarsForZonedTime, ganzhiIndex, ganzhiName, makeGanzhi, getMonthGanzhi,
  RAT_HOUR_MODE, getQiShuoYear,
} from 'js-ephemeris-lite';
import { DATA } from './data.js';
import { evaluateAlmanacRules } from './rules.js';
import { mod, integer } from './rule-tables.js';

const DUTY_NAMES=['青龙','明堂','天刑','朱雀','金匮','天德','白虎','玉堂','天牢','玄武','司命','勾陈'];
const BOARD_PATH=[4,8,5,6,1,7,2,3,0];
export const PALACE_DIRECTIONS=Object.freeze(['东南','正南','西南','正东','中宫','正西','东北','正北','西北']);
export function createFlyingStarBoard(centerNumber, forward=true) {
  integer(centerNumber,1,9,'centerNumber');
  if(typeof forward!=='boolean') throw new TypeError('forward must be boolean');
  const board=new Array(9);
  for(let i=0;i<9;i++) board[BOARD_PATH[i]]=mod(centerNumber-1+i*(forward?1:-1),9)+1;
  return board;
}
export function getThreeCyclesNinePeriods(year) {
  integer(year,-6000,10000,'year'); const n=mod(year-1864,180);
  return { cycle:['上元','中元','下元'][Math.floor(n/60)], period:Math.floor(n/20)+1 };
}
function duty(target, source) {
  const index=mod(target-mod(source-2,6)*2,12);
  return { index, name:DUTY_NAMES[index], isHuangDao:[0,1,4,5,7,10].includes(index) };
}
function dateAt(day) { const {year,month,day:d}=calendarDateFromJulianDay(day); return {year,month,day:d}; }
function festivals(solar,lunar,term,weekday) {
  const f=DATA.festivals, items=[];
  const add=s=>{ if(s) items.push(...s.split(',')); };
  add(f.solar[solar.month]?.[solar.day]); add(f.otherSolar[solar.month-1]?.[solar.day]);
  if(!lunar.isLeap) {
    add(f.lunar[lunar.month]?.[lunar.day]);
    add(f.otherLunar[lunar.month-1]?.[lunar.month===12 && lunar.day===lunar.monthDays?30:lunar.day]);
  }
  if(term) add(f.term[term.name]);
  for(const [nth,dow,name] of f.week[solar.month] ?? []) if(nth===Math.floor((solar.day-1)/7)+1 && dow===weekday) add(name);
  return [...new Set(items)];
}

/** Explicit clock time, fixed minute offset, and shared js-ephemeris-lite calendar. */
export class HuangliCalendar {
  #cache=new Map();
  constructor(options={}) {
    const config={utcOffsetMinutes:480, ratHourMode:RAT_HOUR_MODE.NEXT_DAY, exactJieQiTime:false,
      mode:CALENDAR_MODE.CHINA_ASTRONOMICAL, flyingStarMethod:'consecutive', flyingStarBoundary:'solar',
      isYeargodDuty:true, ...options};
    integer(config.utcOffsetMinutes,-840,840,'utcOffsetMinutes');
    if(!Object.values(RAT_HOUR_MODE).includes(config.ratHourMode)) throw new RangeError('invalid ratHourMode');
    if(!Object.values(CALENDAR_MODE).includes(config.mode)) throw new RangeError('invalid calendar mode');
    if(!['consecutive','discontinuous'].includes(config.flyingStarMethod)) throw new RangeError('invalid flyingStarMethod');
    if(!['solar','lunar'].includes(config.flyingStarBoundary)) throw new RangeError('invalid flyingStarBoundary');
    if(typeof config.exactJieQiTime!=='boolean' || typeof config.isYeargodDuty!=='boolean') throw new TypeError('flags must be boolean');
    // The almanac boundary is the selected clock offset, not an inferred longitude.
    for(const key of Object.keys(options)) if(!['utcOffsetMinutes','ratHourMode','exactJieQiTime','mode','flyingStarMethod','flyingStarBoundary','isYeargodDuty'].includes(key)) throw new RangeError(`unknown almanac option: ${key}`);
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
    const {hour=12,minute=0,second=0,isTuWangYongShi=false,activityMask}=options;
    for(const key of Object.keys(options)) if(!['hour','minute','second','isTuWangYongShi','activityMask'].includes(key)) throw new RangeError(`unknown day option: ${key}`);
    if(typeof isTuWangYongShi!=='boolean') throw new TypeError('isTuWangYongShi must be boolean');
    const cfg=this.options, date=new ZonedTime({year,month,day,hour,minute,second,offsetMinutes:cfg.utcOffsetMinutes});
    const jdUT1=date.toJulianTime().jdUT1;
    const localDay=Math.floor(julianDay({year,month,day,hour:12})+0.5);
    const nextDay=cfg.ratHourMode===RAT_HOUR_MODE.NEXT_DAY && hour>=23;
    const metaDay=localDay+(nextDay?1:0), metaDate=dateAt(metaDay);
    const all=[...this.#events(year-1),...this.#events(year),...this.#events(year+1)].sort((a,b)=>a.jdTT-b.jdTT);
    const terms=all.filter(e=>e.kind==='solar-term');
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
      isSiLi:!!tomorrowTerm && [0,6,12,18].includes(tomorrowTerm.termIndex),isTuWangYongShi};
    const ruleInput={monthBranch,dayIndex,yearIndex,lunarMonth:metaLunar.month,lunarDay:metaLunar.day,
      mansion:mansion.fullName,nextSolarTermIndex:mod(upcoming.termIndex+5,24),...flags,
      isPhaseOfMoon:all.some(e=>e.kind==='lunar-phase' && e.localCivilDayNumber===metaDay),isYeargodDuty:cfg.isYeargodDuty,
      ...(activityMask===undefined?{}:{activityMask:Array.isArray(activityMask)?[...activityMask]:activityMask})};
    const rules=evaluateAlmanacRules(ruleInput);
    const weekday=mod(localDay,7)+1;
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
      mansion:{...mansion}, festivals:festivals({year,month,day},lunar,todayTerm,weekday),
      flags, ...rules, dutyGod:duty(dayIndex%12,monthBranch),
      pengZu:`${DATA.pengzuStem[dayIndex%10]}，${DATA.pengzuBranch[dayIndex%12]}`,
      taiShen:DATA.taishen[dayIndex],godDirections:{...DATA.directions[dayIndex%10]},
      chongSha:{branch:'子丑寅卯辰巳午未申酉戌亥'[(dayIndex%12+6)%12],animal:'鼠牛虎兔龙蛇马羊猴鸡狗猪'[(dayIndex%12+6)%12],direction:['南','东','北','西'][dayIndex%4]},
      hours:Array.from({length:12},(_,branch)=>({branch,branchName:'子丑寅卯辰巳午未申酉戌亥'[branch],...duty(branch,dayIndex%12)})),
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
}

export function getHuangliDay(date,options={}) {
  const {year,month,day,...clock}=date;
  return new HuangliCalendar(options).getDay(year,month,day,clock);
}

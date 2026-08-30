import { J2000 } from './coordinates.js';
import { rsGS, rsPL, ysPL } from './eclipses.js';
import { bodyHorizontalPosition, bodyRiseSetForDay } from './body-visibility.js';
import { JulianTime, ZonedTime } from './time.js';

const SYNODIC_MONTH=29.5306;
const RAD_TO_DEG=180/Math.PI;
const DEG_TO_RAD=Math.PI/180;
const MAX_LUNATIONS=5000;

function asJulianTime(value,name){
 if(value instanceof JulianTime) return value;
 if(value instanceof ZonedTime) return value.toJulianTime();
 if(value instanceof Date){
  if(!Number.isFinite(value.getTime())) throw new TypeError(`${name} Date must be valid`);
  return JulianTime.fromDate(value);
 }
 if(typeof value==='number'){
  if(!Number.isFinite(value)) throw new TypeError(`${name} UT1 Julian day must be finite`);
  return JulianTime.fromUT1(value);
 }
 if(value && Number.isFinite(value.jdTT) && Number.isFinite(value.jdUT1)) return new JulianTime(value);
 throw new TypeError(`${name} must be a UT1 Julian day, Date, JulianTime, ZonedTime, or AstroTime`);
}

function rangeSettings(startInput,endInput){
 const start=asJulianTime(startInput,'start');
 const end=asJulianTime(endInput,'end');
 if(end.jdTT<=start.jdTT) throw new RangeError('end must be later than start');
 const count=Math.ceil((end.jdTT-start.jdTT)/SYNODIC_MONTH)+3;
 if(count>MAX_LUNATIONS) throw new RangeError(`eclipse search exceeds ${MAX_LUNATIONS} lunations; split the interval`);
 return {start,end};
}

function tt(relativeDay){ return JulianTime.fromTT(J2000+relativeDay); }
function optionalTt(relativeDay){ return relativeDay ? tt(relativeDay) : null; }
function groundPoint(point){
 if(!point || !point[2]) return null;
 return {
  time:tt(point[2]),
  longitudeDeg:point[0]*RAD_TO_DEG,
  latitudeDeg:point[1]*RAD_TO_DEG,
 };
}

function solarKind(code){
 if(code==='P') return 'partial';
 if(code.startsWith('T')) return 'total';
 if(code.startsWith('A')) return 'annular';
 if(code.startsWith('H')) return 'hybrid';
 return 'none';
}

function solarEvent(feature){
 return {
  code:feature.lx,
  kind:solarKind(feature.lx),
  conjunction:tt(feature.jdSuo),
  maximum:tt(feature.jd),
  magnitude:feature.sf,
  maximumLocation:{longitudeDeg:feature.zxJ*RAD_TO_DEG,latitudeDeg:feature.zxW*RAD_TO_DEG},
  pathWidthKm:feature.dw,
  centralDurationSeconds:feature.tt*86400,
  contacts:{
   partialBegin:groundPoint(feature.gk3),
   centralBegin:groundPoint(feature.gk1),
   maximum:tt(feature.jd),
   centralEnd:groundPoint(feature.gk2),
   partialEnd:groundPoint(feature.gk4),
  },
 };
}

function solarNearRelative(relative){
 rsGS.init(relative,7);
 const feature=rsGS.feature(relative);
 return feature.lx==='N'?null:solarEvent(feature);
}
function solarNear(jdTT){ return solarNearRelative(jdTT-J2000); }

/** Return the solar eclipse belonging to the lunation near `date`, or null. */
export function getSolarEclipseDetails(date){
 return solarNear(asJulianTime(date,'date').jdTT);
}

/** Search global solar eclipses in the half-open interval [start,end). */
export function searchSolarEclipses(startInput,endInput){
 const {start,end}=rangeSettings(startInput,endInput);
 const startRelative=start.jdTT-J2000,endRelative=end.jdTT-J2000;
 const first=Math.floor((startRelative+8)/SYNODIC_MONTH)-1;
 const last=Math.ceil((endRelative+8)/SYNODIC_MONTH)+1;
 const events=[];
 for(let lunation=first;lunation<=last;lunation+=1){
  const event=solarNearRelative(lunation*SYNODIC_MONTH-8);
  if(!event || event.maximum.jdTT<start.jdTT || event.maximum.jdTT>=end.jdTT) continue;
  if(events.length===0 || Math.abs(event.maximum.jdTT-events.at(-1).maximum.jdTT)>1) events.push(event);
 }
 return events;
}

function lunarKind(result){
 if(result.LX==='全') return 'total';
 if(result.LX==='偏') return 'partial';
 if(result.lT[3] || result.lT[4]) return 'penumbral';
 return 'none';
}

function lunarEvent(result){
 const kind=lunarKind(result);
 if(kind==='none') return null;
 return {
  kind,
  maximum:tt(result.jd),
  magnitude:kind==='penumbral'?result.penumbralMagnitude:result.sf,
  umbralMagnitude:result.sf,
  penumbralMagnitude:result.penumbralMagnitude,
  contacts:{
   penumbralBegin:optionalTt(result.lT[3]),
   partialBegin:optionalTt(result.lT[0]),
   totalBegin:optionalTt(result.lT[5]),
   maximum:tt(result.jd),
   totalEnd:optionalTt(result.lT[6]),
   partialEnd:optionalTt(result.lT[2]),
   penumbralEnd:optionalTt(result.lT[4]),
  },
 };
}

/** Return the lunar eclipse belonging to the full moon near `date`, or null. */
export function getLunarEclipseDetails(date){
 const relative=asJulianTime(date,'date').jdTT-J2000;
 return lunarEvent(ysPL.lecMax(relative));
}

/** Search lunar eclipses in the half-open interval [start,end). */
export function searchLunarEclipses(startInput,endInput){
 const {start,end}=rangeSettings(startInput,endInput);
 const startRelative=start.jdTT-J2000,endRelative=end.jdTT-J2000;
 const first=Math.floor((startRelative-18)/SYNODIC_MONTH)-1;
 const last=Math.ceil((endRelative-18)/SYNODIC_MONTH)+1;
 const events=[];
 for(let lunation=first;lunation<=last;lunation+=1){
  const event=lunarEvent(ysPL.lecMax(lunation*SYNODIC_MONTH+18));
  if(!event || event.maximum.jdTT<start.jdTT || event.maximum.jdTT>=end.jdTT) continue;
  if(events.length===0 || Math.abs(event.maximum.jdTT-events.at(-1).maximum.jdTT)>1) events.push(event);
 }
 return events;
}

function checkedLocation(location){
 if(!location || typeof location!=='object') throw new TypeError('location must be an object');
 const longitudeDeg=location.longitudeDeg,latitudeDeg=location.latitudeDeg;
 const heightMeters=location.heightMeters??0;
 if(!Number.isFinite(longitudeDeg)||longitudeDeg<-180||longitudeDeg>180)
  throw new RangeError('longitudeDeg must be finite and within [-180, 180]');
 if(!Number.isFinite(latitudeDeg)||latitudeDeg<-90||latitudeDeg>90)
  throw new RangeError('latitudeDeg must be finite and within [-90, 90]');
 if(!Number.isFinite(heightMeters)) throw new TypeError('heightMeters must be finite');
 return {longitudeDeg,latitudeDeg,heightMeters};
}

/** Compute local circumstances for the solar eclipse near `date`. */
export function getLocalSolarEclipse(date,location){
 const instant=asJulianTime(date,'date');
 const global=solarNear(instant.jdTT);
 if(!global) return null;
 const observer=checkedLocation(location);
 const relative=instant.jdTT-J2000;
 const result=rsPL.secMax(
  relative,observer.longitudeDeg*DEG_TO_RAD,observer.latitudeDeg*DEG_TO_RAD,
  observer.heightMeters/1000,
 );
 const visible=result.sT.some(Boolean)||result.sflx==='#'||result.sflx==='*';
 const kind=result.LX==='全'?'total':result.LX==='环'?'annular':result.LX==='偏'?'partial':'none';
 return {
  global,observer,visible,kind,magnitude:result.sf,
  horizonClipped:result.sflx==='#'?'sunrise':result.sflx==='*'?'sunset':null,
  contacts:{
   partialBegin:optionalTt(result.sT[0]),
   maximum:optionalTt(result.sT[1]),
   partialEnd:optionalTt(result.sT[2]),
   centralBegin:optionalTt(result.sT[3]),
   centralEnd:optionalTt(result.sT[4]),
  },
  sunrise:result.sun_s?JulianTime.fromUT1(J2000+result.sun_s):null,
  sunset:result.sun_j?JulianTime.fromUT1(J2000+result.sun_j):null,
 };
}

function lunarContactCircumstance(time,observer){
 if(!time) return null;
 const position=bodyHorizontalPosition('moon',time.jdUT1,observer);
 return {
  time,azimuthDeg:position.azimuthDeg,
  geometricAltitudeDeg:position.geometricAltitudeDeg,
  apparentAltitudeDeg:position.apparentAltitudeDeg,
  visible:position.apparentAltitudeDeg>0,
 };
}

function moonHorizonEvents(startUT1,endUT1,observer){
 const rises=[],sets=[];
 const firstDay=Math.floor(startUT1-0.5)+0.5;
 for(let day=firstDay;day<endUT1;day+=1){
  const events=bodyRiseSetForDay('moon',day,observer,{limb:'upper'});
  rises.push(...events.rises.filter(time=>time.jdUT1>=startUT1&&time.jdUT1<=endUT1));
  sets.push(...events.sets.filter(time=>time.jdUT1>=startUT1&&time.jdUT1<=endUT1));
 }
 return {rises,sets};
}

/** Compute which phases of the lunar eclipse near `date` are visible locally. */
export function getLocalLunarEclipse(date,location){
 const global=getLunarEclipseDetails(date);
 if(!global) return null;
 const observer=checkedLocation(location);
 const contacts=Object.fromEntries(Object.entries(global.contacts).map(([name,time])=>[
  name,lunarContactCircumstance(time,observer),
 ]));
 const present=Object.values(global.contacts).filter(Boolean);
 const start=global.contacts.penumbralBegin??present[0]??global.maximum;
 const end=global.contacts.penumbralEnd??present.at(-1)??global.maximum;
 const horizon=moonHorizonEvents(start.jdUT1,end.jdUT1,observer);
 let visible=Object.values(contacts).some(contact=>contact?.visible);
 // A rise/set can occur between named contacts. Sample the short eclipse
 // interval so visibility describes any observable portion, not only contacts.
 for(let jd=start.jdUT1;!visible&&jd<=end.jdUT1;jd+=1/144){
  visible=bodyHorizontalPosition('moon',jd,observer).apparentAltitudeDeg>0;
 }
 const hasRise=horizon.rises.length>0,hasSet=horizon.sets.length>0;
 return {
  global,observer,visible,contacts,
  moonrises:horizon.rises,moonsets:horizon.sets,
  horizonClipped:hasRise&&hasSet?'both':hasRise?'moonrise':hasSet?'moonset':null,
 };
}

export const ECLIPSE_SEARCH_INFO=Object.freeze({interval:'half-open [start,end)',maximumLunations:MAX_LUNATIONS,mapRenderer:false});

import {
  CALENDAR_MODE,
  PILLAR_HISTORICAL_MODE,
  RAT_HOUR_MODE,
  SOLAR_LIMB,
  JulianTime,
  ZonedTime,
  calculateFourPillars,
  calculateChineseCalendarYear,
  describeFourPillars,
  earthHeliocentricState,
  PLANET,
  PLUTO_MODEL_INFO,
  plutoHeliocentricState,
  fourPillarsForZonedTime,
  moonGeocentricPosition,
  solarAltitude,
  solarRiseSetForDate,
  solveNewMoon,
  setEventAccuracy, getEventAccuracy, type EventAccuracy,
  solarLongitudeTimeFast, lunarPhaseTimeFast, solarLongitudeTimeAccurate, lunarPhaseTimeAccurate,
  sunGeocentricPosition,
  trueSolarTime,
  type CartesianState,
  type AstroTime,
  type ChineseCalendarYear,
  type EphemerisVector3,
  type SolarRiseSetResult,
  type SolarClock,
} from 'js-ephemeris-lite';
import { moonHeliocentricState } from 'js-ephemeris-lite/ephemeris';
const plutoState: CartesianState = plutoHeliocentricState(2451545);
const plutoYears: readonly [1600, 2200] = PLUTO_MODEL_INFO.recommendedIntervalYears;
void [plutoState, plutoYears, PLANET.PLUTO];
import { getPreviousJie } from 'js-ephemeris-lite/chinese-calendar';
import { iau2000bNutation } from 'js-ephemeris-lite/coordinates';
import { solarLongitudeState, solveSolarLongitude } from 'js-ephemeris-lite/calendar-events';
import { calculateDayPillar } from 'js-ephemeris-lite/ganzhi';
import { computeSolarRiseSetFast } from 'js-ephemeris-lite/solar-visibility';
import { deltaTSeconds } from 'js-ephemeris-lite/time';
import {
  apparentBodyPosition, apparentBodyState, SKY_FRAME, type ApparentPosition, type ApparentState,
} from 'js-ephemeris-lite/apparent';
import { searchRelativeLongitude, searchStations, searchIngresses } from 'js-ephemeris-lite/event-search';
import { moonIllumination, bodyPhenomena, type BodyPhenomena } from 'js-ephemeris-lite/phenomena';
import { bodyHorizontalPosition, bodyRiseSetForDay, type BodyHorizontalPosition, type BodyRiseSetResult } from 'js-ephemeris-lite/body-visibility';
import {
  searchLunarApsides, searchEarthApsides, searchLunarNodes, searchGreatestElongations,
  searchRelativeRightAscension, searchRightAscensionStations, type LunarNodeEvent,
} from 'js-ephemeris-lite/orbital-events';
import { HuangliCalendar, getHuangliDay, ACTIVITY_MASKS, type HuangliDay } from '../packages/huangli/src/index.js';
import { evaluateAlmanacRules } from '../packages/huangli/src/rules.js';
import {
  MOUNTAIN, createFengShuiChart, calculatePaiLong, mountainForAzimuth,
  type FengShuiChart,
} from 'huangli-lite/feng-shui';
import type { HuangliHourPeriod, TuWangPeriod, FestivalCategory, FestivalDetail } from 'huangli-lite';

const instant = JulianTime.fromDate(new Date());
const clock = new ZonedTime({
  year: 2000,
  month: 1,
  day: 1,
  hour: 23,
  minute: 30,
  offsetMinutes: 480,
});

const vector: EphemerisVector3 = sunGeocentricPosition(instant.jdTT);
const moonVector: EphemerisVector3 = moonGeocentricPosition(instant.jdTT);
const earth: CartesianState = earthHeliocentricState(instant.jdTT);
const moon: CartesianState = moonHeliocentricState(instant.jdTT);
const calendar: ChineseCalendarYear = calculateChineseCalendarYear(instant);
const root: number = solveNewMoon(instant.jdTT, { moonLatitudeTerms: 10 }).jdUT1;
const eventTime: AstroTime = solveNewMoon(instant.jdTT);
const instantTime: AstroTime = instant;
const serializedTime: AstroTime = instant.toJSON();
const termTime: AstroTime = getPreviousJie(instant).time;
const eventInstant: JulianTime = solveNewMoon(instant.jdTT);
const localEvent: ZonedTime = getPreviousJie(instant).time.toZonedTime(480);
const restoredInstant: JulianTime = new JulianTime(eventTime);
void [eventInstant, localEvent, restoredInstant];
// @ts-expect-error event records contain time rather than duplicate flat epochs
getPreviousJie(instant).jdTT;
void [eventTime, instantTime, serializedTime, termTime];
// @ts-expect-error folded calibration has no runtime switch
earthHeliocentricState(instant.jdTT, { corrections: false });
const angleEventDates: number[] = [solarLongitudeTimeFast(2 * Math.PI), lunarPhaseTimeFast(0), solarLongitudeTimeAccurate(2 * Math.PI, { toleranceSeconds: 0.001 }), lunarPhaseTimeAccurate(0)];
void angleEventDates;
solveSolarLongitude(0, instant.jdTT, { solver: 'auto', toleranceSeconds: 0.01 });
solveSolarLongitude(0, instant.jdTT, { solver: 'safeguarded' });
const accuracy: EventAccuracy = getEventAccuracy();
setEventAccuracy('fast');
// @ts-expect-error default event results do not carry diagnostics
solveNewMoon(instant.jdTT).residualRadians;
// @ts-expect-error latitude budgets belong to options, not event times
solveNewMoon(instant.jdTT).moonLatitudeTerms;
solveSolarLongitude(0, instant.jdTT, { accuracy: 'accurate', toleranceSeconds: 0.01 });
solveNewMoon(instant.jdTT, { accuracy: 'mid', moonLatitudeTerms: 'full' });
setEventAccuracy(accuracy);
// @ts-expect-error only the three named accuracy modes exist
setEventAccuracy('high');
// @ts-expect-error unknown per-call accuracy
solveNewMoon(instant.jdTT, { accuracy: 'low' });
const pillars = fourPillarsForZonedTime(clock, {
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  ratHourMode: RAT_HOUR_MODE.CURRENT_DAY_TOMORROW_STEM,
  pillarHistoricalMode: PILLAR_HISTORICAL_MODE.FOLLOW_CALENDAR,
});
const names: string = describeFourPillars(pillars).day;
const solarClock: SolarClock = trueSolarTime(clock, 116.4);
const sourcedSolarClock = trueSolarTime(clock, 116.4);
const sourceOffset: number = sourcedSolarClock.sourceClock.offsetMinutes;
const solarPillars = calculateFourPillars(instant, solarClock, {
  ratHourMode: RAT_HOUR_MODE.NEXT_DAY,
});
const riseSet: SolarRiseSetResult = solarRiseSetForDate(
  clock,
  {
    longitudeDeg: 116.4,
    latitudeDeg: 39.9,
  },
  {
    limb: SOLAR_LIMB.UPPER,
  },
);
const numericRiseSet: SolarRiseSetResult = solarRiseSetForDate(
  instant.jdUT1,
  { longitudeDeg: 116.4, latitudeDeg: 39.9 },
);
const altitude: number = solarAltitude(instant, {
  longitudeDeg: 116.4,
  latitudeDeg: 39.9,
}).apparentAltitudeRad;

getPreviousJie(instant);
iau2000bNutation(instant.jdTT);
solarLongitudeState(instant.jdTT);
calculateDayPillar(clock);
computeSolarRiseSetFast(instant, { longitudeDeg: 0, latitudeDeg: 0 });
deltaTSeconds(2025);

void [vector, moonVector, earth, moon, calendar, root, names, solarClock, sourceOffset, solarPillars,
  riseSet, numericRiseSet, altitude];

// @ts-expect-error invalid late-Zi convention must be rejected by the declarations
fourPillarsForZonedTime(clock, { ratHourMode: 'invented-mode' });
// @ts-expect-error plain calendar objects are intentionally not accepted
solarRiseSetForDate({ year: 2025, month: 1, day: 1 }, { longitudeDeg: 0, latitudeDeg: 0 });

const skyPosition: ApparentPosition = apparentBodyPosition('mars', instant.jdTT, { frame: SKY_FRAME.J2000 });
const skyState: ApparentState = apparentBodyState('moon', instant.jdTT, { frame: 'true-of-date' });
const phenomena: BodyPhenomena = bodyPhenomena('venus', instant.jdTT);
const horizontal: BodyHorizontalPosition = bodyHorizontalPosition('moon', instant.jdUT1, {
  longitudeDeg: 116.4, latitudeDeg: 39.9,
});
const bodyRiseSet: BodyRiseSetResult = bodyRiseSetForDay('moon', Math.floor(instant.jdUT1 - 0.5) + 0.5, {
  longitudeDeg: 116.4, latitudeDeg: 39.9,
});
searchStations('mercury', instant.jdTT, instant.jdTT + 180);
searchIngresses('moon', instant.jdTT, instant.jdTT + 30, { apparent: { frame: 'mean-of-date' } });
searchRelativeLongitude('moon', 'sun', 0, instant.jdTT, instant.jdTT + 31);
moonIllumination(instant.jdTT);
void [skyPosition, skyState, phenomena, horizontal, bodyRiseSet];

// @ts-expect-error Earth is the observer/origin here, not a supported sky target
apparentBodyPosition('earth', instant.jdTT);
// @ts-expect-error horizontal output and its GAST require date axes
bodyHorizontalPosition('moon', instant.jdUT1, { longitudeDeg: 0, latitudeDeg: 0 }, { apparent: { frame: 'j2000' } });

searchLunarApsides(instant.jdTT, instant.jdTT + 30);
searchEarthApsides(instant.jdTT, instant.jdTT + 365);
const nodeEvents: LunarNodeEvent[] = searchLunarNodes(instant.jdTT, instant.jdTT + 30, { frame: 'j2000' });
const nodeInstant: JulianTime | undefined = nodeEvents[0]?.time;
const moonRise: JulianTime | undefined = bodyRiseSet.rises[0];
const solarRise: JulianTime | null = riseSet.rise;
void [nodeInstant, moonRise, solarRise];
// @ts-expect-error sky event records do not expose a second flat TT value
nodeEvents[0].jdTT;
searchGreatestElongations('venus', instant.jdTT, instant.jdTT + 365, { apparent: { frame: 'true-of-date' } });
searchRelativeRightAscension('venus', 'moon', 0, instant.jdTT, instant.jdTT + 365);
searchRightAscensionStations('mercury', instant.jdTT, instant.jdTT + 365);
// @ts-expect-error greatest elongation only applies to the supported inferior planets
searchGreatestElongations('mars', 2451545, 2451555);

const almanac = new HuangliCalendar({utcOffsetMinutes: 480, ratHourMode: 'next-day'});
const almanacDay: HuangliDay = almanac.getDay(2026,3,16,{activityMask:ACTIVITY_MASKS.civilian37});
const festivalDetails: FestivalDetail[] = almanacDay.festivalDetails;
const festivalCategories: FestivalCategory[] = festivalDetails.map(f=>f.category);
const traditionalFestivalNames: string[] = festivalDetails.filter(f=>f.category==='traditional').map(f=>f.name);
new HuangliCalendar({festivalMode:'all'}).getYear(2026);
const festivalMode: 'common'|'all' = almanacDay.settings.festivalMode;
// @ts-expect-error festival mode is a selection, not a category name
new HuangliCalendar({festivalMode:'religious'});
void [festivalCategories,traditionalFestivalNames,festivalMode];
const clockDay: HuangliDay = getHuangliDay({year:2026,month:3,day:16,hour:10});
evaluateAlmanacRules(almanacDay.ruleInput);
const effectiveDate: number = almanacDay.ruleDate.day;
const effectiveLunarMonth: number = almanacDay.ruleLunarDate.month;
evaluateAlmanacRules({monthBranch:3,dayIndex:25,yearIndex:42,lunarMonth:1,lunarDay:28,mansion:'危',nextSolarTermIndex:5});
// @ts-expect-error clock offsets are explicit; no inferred true-solar clock
new HuangliCalendar({longitude:116});
// @ts-expect-error settings must not change after the event cache has been initialized
almanac.options.utcOffsetMinutes = 0;
void [nodeEvents,almanacDay,clockDay,effectiveDate,effectiveLunarMonth];

const earthChart: FengShuiChart = createFengShuiChart({period:9,sitting:MOUNTAIN.ZI});
calculatePaiLong('壬', mountainForAzimuth(180).key);
const hourlyPeriods: HuangliHourPeriod[] = almanac.getHours(2026,2,16);
const soilPeriods: TuWangPeriod[] = almanac.getTuWangPeriods(2026);
new HuangliCalendar({tuWangMethod:'manual'}).getDay(2026,1,20,{isTuWangYongShi:false});
// @ts-expect-error twenty-four mountains use named directions
createFengShuiChart({period:9,sitting:180});
// @ts-expect-error only explicit TuWang modes are supported
new HuangliCalendar({tuWangMethod:'unknown'});
void [earthChart,hourlyPeriods,soilPeriods];

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
  fourPillarsForZonedTime,
  moonGeocentricPosition,
  solarAltitude,
  solarRiseSetForDate,
  solveNewMoon,
  sunGeocentricPosition,
  trueSolarTime,
  type CartesianState,
  type ChineseCalendarYear,
  type EphemerisVector3,
  type SolarRiseSetResult,
  type SolarClock,
} from 'js-ephemeris-lite';
import { moonHeliocentricState } from 'js-ephemeris-lite/ephemeris';
import { getPreviousJie } from 'js-ephemeris-lite/chinese-calendar';
import { iau2000bNutation } from 'js-ephemeris-lite/coordinates';
import { solarLongitudeState } from 'js-ephemeris-lite/calendar-events';
import { calculateDayPillar } from 'js-ephemeris-lite/ganzhi';
import { computeSolarRiseSetFast } from 'js-ephemeris-lite/solar-visibility';
import { deltaTSeconds } from 'js-ephemeris-lite/time';

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
const riseSet: SolarRiseSetResult<ZonedTime> = solarRiseSetForDate(
  clock,
  {
    longitudeDeg: 116.4,
    latitudeDeg: 39.9,
  },
  {
    limb: SOLAR_LIMB.UPPER,
  },
);
const numericRiseSet: SolarRiseSetResult<number> = solarRiseSetForDate(
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

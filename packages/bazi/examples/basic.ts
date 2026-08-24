import {
  CALENDAR_MODE,
  RAT_HOUR_MODE,
  ZonedTime,
  describeFourPillars,
} from 'js-ephemeris-lite';
import {
  DAYUN_BOUNDARY_MODEL,
  GENDER,
  QIYUN_TIME_MODEL,
  SHEN_SHA,
  baziForZonedTime,
  calculateQiYun,
  collectNatalShenSha,
  generateDaYun,
  hasShenSha,
  shenShaNames,
  unpackPillar,
} from '@opendestiny/bazi-lite';

const birth = new ZonedTime({
  year: 2000, month: 1, day: 1,
  hour: 23, minute: 30, second: 0,
  offsetMinutes: 480,
});

const chart = baziForZonedTime(birth, {
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  ratHourMode: RAT_HOUR_MODE.NEXT_DAY,
});

const natalShenSha = collectNatalShenSha(chart, { gender: GENDER.MALE });
const qiYun = calculateQiYun(
  birth.toJulianTime(),
  birth,
  chart,
  GENDER.MALE,
  {
    mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
    timeModel: QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR,
  },
);
const daYun = generateDaYun(birth, chart, qiYun, {
  count: 8,
  boundaryModel: DAYUN_BOUNDARY_MODEL.CIVIL_YEARS,
});

console.log(describeFourPillars(chart.pillars));
console.log(shenShaNames(natalShenSha.day));
console.log(hasShenSha(natalShenSha.day, SHEN_SHA.KUI_GANG));
console.log(daYun.map((item) => unpackPillar(item.pillar).name));

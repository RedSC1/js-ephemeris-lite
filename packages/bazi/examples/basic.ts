import {
  CALENDAR_MODE,
  RAT_HOUR_MODE,
  ZonedTime,
  describeFourPillars,
} from 'js-ephemeris-lite';
import {
  BAZI_CLOCK_MODE,
  BaziChart,
  BaziOptions,
  DAYUN_BOUNDARY_MODEL,
  GENDER,
  QIYUN_TIME_MODEL,
  SHEN_SHA,
  hasShenSha,
  shenShaNames,
  unpackPillar,
} from 'bazi-lite';

const birth = new ZonedTime({
  year: 2000, month: 1, day: 1,
  hour: 23, minute: 30, second: 0,
  offsetMinutes: 480,
});

const options = new BaziOptions({
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  ratHourMode: RAT_HOUR_MODE.NEXT_DAY,
  gender: GENDER.MALE,
  clockMode: BAZI_CLOCK_MODE.CIVIL,
  qiYunTimeModel: QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR,
  daYunBoundaryModel: DAYUN_BOUNDARY_MODEL.CIVIL_YEARS,
  daYunCount: 8,
});

const chart = BaziChart.fromZonedTime(birth, options);
const natalShenSha = chart.getShenSha();
const qiYun = chart.getQiYun();
const daYun = chart.getDaYunTable();

console.log(describeFourPillars(chart.pillars));
console.log(qiYun.startCivilTime);
console.log(shenShaNames(natalShenSha.day));
console.log(hasShenSha(natalShenSha.day, SHEN_SHA.KUI_GANG));
console.log(daYun.map((item) => unpackPillar(item.pillar).name));

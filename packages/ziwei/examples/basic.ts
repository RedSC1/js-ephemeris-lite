import { ZonedTime } from 'js-ephemeris-lite';
import {
  PALACE,
  PALACE_NAMES,
  ZIWEI_GENDER,
  ZiweiChart,
  ZiweiOptions,
  brightnessName,
  getStar,
} from 'ziwei-lite';

const birth = new ZonedTime({
  year: 2003, month: 3, day: 13,
  hour: 14, minute: 15, second: 0,
  offsetMinutes: 480,
});

const chart = ZiweiChart.fromZonedTime(
  birth,
  new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
);

console.log({
  lunarDate: chart.facts.lunarDate,
  bureau: chart.anchors.bureau,
  lifePalace: chart.getPalace(PALACE.LIFE).branch,
  bodyPalace: chart.bodyPalace,
  lifeMaster: getStar(chart.lifeMaster).key,
  bodyMaster: getStar(chart.bodyMaster).key,
});

for (const palace of chart.palaces) {
  console.log(PALACE_NAMES[palace.palaceId], palace.branch);
  for (const star of chart.getStarsAtBranch(palace.branch)) {
    console.log({
      id: star.id,
      key: star.key,
      brightness: brightnessName(star.brightness),
      transformMask: star.transformMask,
    });
  }
}

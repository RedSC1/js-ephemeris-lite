import { ZonedTime } from 'js-ephemeris-lite';
import {
  PALACE,
  arrangeZiweiStars,
  PALACE_NAMES,
  ZIWEI_GENDER,
  ZiweiChart,
  ZiweiCastingChart,
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


// Manual placement changes the calculation inputs, not the recorded birthday.
const modified = chart.modify({
  yearGanIndex: 9,
  yearZhiIndex: 7,
  month: 3,
  updateBureau: true,
});
console.log(modified.placementInput, modified.anchors.bureau);
const shifted = modified.shiftLifePalace(1);
console.log(shifted.getPalace(PALACE.LIFE), shifted.reset() === chart);
const direct = arrangeZiweiStars({
  yearGanIndex: 9, yearZhiIndex: 7, month: 2, day: 30, hourZhiIndex: 6,
}, chart.options);
console.log(direct.starPositions, direct.omittedPlacements);


const casting = ZiweiCastingChart.fromInput({
  yearGanIndex: 9, yearZhiIndex: 7, month: 2, day: 30, hourZhiIndex: 6,
}, { gender: ZIWEI_GENDER.MALE });
const reported = ZiweiCastingChart.fromNumber('123456', casting.options);
const random = ZiweiCastingChart.random(casting.options);
console.log(casting.getPalace(PALACE.LIFE), reported.casting, random.casting);
console.log(casting.modify({ month: 3 }).reset() === casting);

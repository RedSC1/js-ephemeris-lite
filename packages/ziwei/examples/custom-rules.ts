import { ZonedTime } from 'js-ephemeris-lite';
import {
  ZIWEI_GENDER,
  ZiweiChart,
  ZiweiConfigLoader,
  ZiweiOptions,
} from 'ziwei-lite';

let ruleset = ZiweiConfigLoader.withOptions(
  ZiweiConfigLoader.getDefault(),
  {
    label: 'geng-option4',
    sihua: { geng: 'option4' },
  },
);

ruleset = ZiweiConfigLoader.overrideWith(ruleset, {
  label: 'local-profile',
  starsJson: JSON.stringify([{
    key: 'custom_star',
    type: 'minor',
    rule: { type: 'anchor_offset', anchor: 'ziwei', offset: 2 },
  }]),
  sihuaJson: JSON.stringify({ geng: { ke: 'custom_star' } }),
});

const chart = ZiweiChart.fromZonedTime(
  new ZonedTime({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    offsetMinutes: 480,
  }),
  new ZiweiOptions({
    gender: ZIWEI_GENDER.MALE,
    rules: { ruleset },
  }),
);

const customStarId = chart.findStarId('custom_star');
if (customStarId === undefined) throw new Error('custom star was not compiled');
console.log(chart.getStarPosition(customStarId));

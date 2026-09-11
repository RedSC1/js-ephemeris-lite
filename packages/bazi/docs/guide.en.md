# bazi-lite English guide

## Input paths

Use `BaziChart.fromZonedTime()` for a real fixed-offset wall clock. Use
`fromSolarDay()` or `fromLunarDay()` when a date picker supplies a day and a
separate time picker supplies the birth clock. The `hour` field is required;
minutes and seconds default to zero.

```js
import { ZonedTime } from 'js-ephemeris-lite';
import { BaziChart, BAZI_CLOCK_MODE, GENDER } from 'bazi-lite';

const chart = BaziChart.fromZonedTime(new ZonedTime({
  year: 2003, month: 3, day: 13, hour: 14, minute: 15,
  offsetMinutes: 480,
}), {
  gender: GENDER.MALE,
  clockMode: BAZI_CLOCK_MODE.CIVIL,
  eventAccuracy: 'mid',
});
```

For a true-solar chart, set `clockMode` to `true-solar` and provide
`longitudeDeg`. `fromInstant(instant, chartTime, options)` is a low-level entry:
it assumes the chart clock has already been resolved and does not apply solar
time a second time.

## Reading and fortune cycles

`chart.pillars` contains packed year, month, day, and hour pillars. `columns`
adds visible Ten Gods, hidden stems, life stages, and Na Yin. Additional pillars
are in `extraPillars`; `getShenSha()` and `collectChartRelations()` expose rule
layers. When only four pillars are known, use `analyzePillars()` instead of
inventing a birth instant.

```js
const qiYun = chart.getQiYun();
const decades = chart.getDaYunTable();
```

Gender is optional for basic construction but required for direction and
gender-dependent rules. Chart methods reuse the immutable `chart.options`.

## JSON and reverse lookup

`chart.toJSON()` emits schema `bazi-chart-v1`. `clockTime` is the original input,
`jdUT1` is the instant, and `chartTime` is the calculation clock. `virtualTime`
and `birthCivilTime` remain deprecated aliases.

`reverseLookupBazi()` requires a finite date range. Pass `chart.options` to
reproduce its boundary conventions. Supplying unrelated options is supported
for deliberate comparisons, but may change results around Jie and day boundaries.

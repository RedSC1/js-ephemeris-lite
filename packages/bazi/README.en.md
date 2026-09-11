# bazi-lite

[中文](./README.md)

BaZi and Four Pillars calculations for JavaScript and TypeScript. The package
includes Ten Gods, hidden stems, life stages, Na Yin, Shen Sha, stem/branch
relations, Qi Yun, Da Yun, solar clocks, and bounded birth-time reverse lookup.
Astronomy and Chinese-calendar calculations are provided by `js-ephemeris-lite`.

## Installation

```sh
npm install bazi-lite js-ephemeris-lite
```

Node.js 18 or a browser build environment with ES modules is required.

## Create a chart

```js
import { ZonedTime, describeFourPillars } from 'js-ephemeris-lite';
import { BaziChart, GENDER } from 'bazi-lite';

const birth = new ZonedTime({
  year: 2003, month: 3, day: 13,
  hour: 14, minute: 15, second: 0,
  offsetMinutes: 480,
});
const chart = BaziChart.fromZonedTime(birth, { gender: GENDER.MALE });

console.log(describeFourPillars(chart.pillars));
console.log(chart.getShenSha());
console.log(chart.getDaYunTable());
```

Calendar-day values do not contain a birth time. Pass the clock separately:

```js
const solarChart = BaziChart.fromSolarDay(
  { year: 2003, month: 3, day: 13 },
  { hour: 14, minute: 15 },
  chart.options,
);
const lunarChart = BaziChart.fromLunarDay(
  { year: 2003, month: 2, day: 11, isLeap: false },
  { hour: 14, minute: 15 },
  chart.options,
);
```

`fromLunarDay()` uses the same options for lunar-to-solar conversion and chart
construction. The clock uses `options.utcOffsetMinutes`; there is no second
timezone argument that can disagree with the calendar settings.

## Time model

- `birthClockTime` is the original fixed-offset wall clock.
- `birthJdUT1` identifies the physical instant.
- `birthChartTime` contains the civil, mean-solar, or apparent-solar clock fields
  actually used for day and hour pillars.

`birthCivilTime` and serialized `virtualTime` remain deprecated compatibility
aliases. New code should use `birthChartTime` and `birth.chartTime`.

The chart retains its calendar, timezone, solar-clock, Zi-hour, and event-accuracy
options. Chart-bound fortune methods reuse those options. Low-level functions may
accept different options for research comparisons, but mixed conventions can
disagree near Jie, day, leap-month, and historical-calendar boundaries. Rebuild
the chart when changing conventions unless the mismatch is intentional.

## Main APIs

| Task | API |
| --- | --- |
| Create from a wall clock | `BaziChart.fromZonedTime()` |
| Create from a solar/lunar day and clock | `fromSolarDay()` / `fromLunarDay()` |
| Create from an instant and resolved chart clock | `BaziChart.fromInstant()` |
| Analyze known pillars without a birth instant | `analyzePillars()` |
| Qi Yun and Da Yun | `chart.getQiYun()` / `chart.getDaYunTable()` |
| Shen Sha and relations | `chart.getShenSha()` / `collectChartRelations()` |
| Reverse lookup | `searchBaziDates()` / `reverseLookupBazi()` |
| Stable JSON snapshot | `chart.toJSON()` / `JSON.stringify(chart)` |

See the [English guide](./docs/guide.en.md) for clocks, options, fortune cycles,
JSON, and reverse lookup. The Chinese documentation remains the most extensive
rule reference.

## License

MPL-2.0. See [LICENSE](./LICENSE) and the
[Chinese third-party notices](./THIRD_PARTY_NOTICES.zh-CN.md).

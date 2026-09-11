# ziwei-lite

[中文](./README.md)

Zi Wei Dou Shu calculations for JavaScript and TypeScript. The package provides
natal charts, palaces, stars, brightness, transformations, limits and flows,
timeline navigation, immutable chart modifications, casting charts, custom
rules, and bounded reverse lookup. Astronomy and the Chinese calendar come from
`js-ephemeris-lite`.

## Installation

```sh
npm install ziwei-lite js-ephemeris-lite
```

## Create a natal chart

```js
import { ZonedTime } from 'js-ephemeris-lite';
import { ZiweiChart, ZIWEI_GENDER, PALACE } from 'ziwei-lite';

const chart = ZiweiChart.fromZonedTime(new ZonedTime({
  year: 2003, month: 3, day: 13,
  hour: 14, minute: 15,
  offsetMinutes: 480,
}), { gender: ZIWEI_GENDER.MALE });

console.log(chart.getPalace(PALACE.LIFE));
console.log(chart.getStarsInPalace(PALACE.LIFE));
```

Date objects represent a day, so the birth clock is a separate required input:

```js
const solarChart = ZiweiChart.fromSolarDay(
  { year: 2003, month: 3, day: 13 },
  { hour: 14, minute: 15 },
  chart.options,
);
const lunarChart = ZiweiChart.fromLunarDay(
  { year: 2003, month: 2, day: 11, isLeap: false },
  { hour: 14, minute: 15 },
  chart.options,
);
```

Both constructors use the chart options' fixed offset. `fromLunarDay()` also
uses the same calendar options for lunar-to-solar conversion. The older
`fromLunar()` remains only as a compatibility entry.

## Time and retained settings

- `birthClockTime` preserves the original wall clock.
- `facts.jdUT1` identifies the physical instant.
- `facts.chartTime` is the civil, mean-solar, or apparent-solar clock used by
  the chart.

`facts.virtualTime` and serialized `birth.virtualTime` are deprecated aliases.
Natal charts retain calendar, timezone, solar-clock, Zi-hour, leap-month,
boundary, and event-accuracy settings. Flow methods, timelines, and limit
managers reuse them. Low-level functions may accept other options for deliberate
comparisons, but mixed conventions can disagree near Jie, day, leap-month, and
historical-calendar boundaries.

## Flows

```js
const target = new ZonedTime({
  year: 2026, month: 8, day: 1, hour: 12,
  offsetMinutes: 480,
});
const flow = chart.resolveFlow(target);
const manager = chart.createLimitManager();
manager.setPhysicalTime(target);
manager.nextDay();
```

Flow targets and reverse candidates expose `chartTime`; `virtualTime` remains a
compatibility alias. See the [English guide](./docs/guide.en.md) and the Chinese
documentation for the complete rule and customization reference.

## License

MPL-2.0. See [LICENSE](./LICENSE) and the
[Chinese third-party notices](./THIRD_PARTY_NOTICES.zh-CN.md).

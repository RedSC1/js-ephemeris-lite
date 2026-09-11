# ziwei-lite English guide

## Birth inputs

Use `ZiweiChart.fromZonedTime()` for an actual fixed-offset wall clock.
`fromSolarDay()` and `fromLunarDay()` combine a date-picker value with a separate
time-picker value. `hour` is required; minutes and seconds default to zero.

`fromInstant()` is intentionally low level: the caller supplies both the
physical instant and the already-resolved chart clock. Applications normally
should prefer the higher-level constructors.

## Clock fields

| Value | Meaning |
| --- | --- |
| `birthClockTime` | Original fixed-offset wall clock |
| `facts.jdUT1` | Physical instant |
| `facts.chartTime` | Civil, mean-solar, or apparent-solar fields used by the chart |

The names `virtualTime`, `resolveZiweiVirtualTime()`, and `virtualTimeToUt1()`
remain deprecated aliases. Prefer `chartTime`, `resolveZiweiChartTime()`, and
`chartTimeToUt1()`.

## Options and flows

`ZiweiOptions` stores calendar mode, fixed offset, event accuracy, solar-clock
mode, longitude, Zi-hour rule, leap-month strategy, pillar and flow boundaries,
chart mode, and rule selection. The natal chart keeps this immutable snapshot.
`resolveFlow()`, `dynamicForTime()`, timelines, and limit managers reuse it.

Low-level functions permit another options object for comparison tools. Mixed
settings can make a target inconsistent with the natal chart near solar terms,
day changes, leap months, or historical reforms. Rebuild the chart when changing
conventions unless the comparison is intentional.

## JSON compatibility

`chart.toJSON()` keeps schema `ziwei-chart-v1`. New snapshots include
`birth.chartTime` and retain `birth.virtualTime`. Flow targets and reverse lookup
candidates follow the same compatibility policy.

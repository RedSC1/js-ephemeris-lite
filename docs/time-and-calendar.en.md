# Time and calendar API

`js-ephemeris-lite` separates a physical instant from the clock used to display
or interpret it:

- `JulianTime` stores `jdUT1`, `jdTT`, and the applied ΔT value. It has no timezone.
- `ZonedTime` is a validated civil clock with an explicit fixed UTC offset.
- `CivilDateTime` is a set of date/time fields without an offset. Chart packages
  use it for the resolved civil, mean-solar, or apparent-solar clock.

The lite runtime treats UTC as UT1 for JavaScript timestamp interoperability. It
does not ship leap-second, TAI, or Earth-orientation tables.

## Fixed-offset conversion

```js
import { ZonedTime } from 'js-ephemeris-lite';

const beijing = new ZonedTime({
  year: 2026, month: 8, day: 1, hour: 12,
  offsetMinutes: 480,
});

const utc = beijing.toUtc();
const tokyo = beijing.toZonedTime(540);
```

Both methods preserve the physical instant. Fixed offsets do not apply daylight
saving rules. Use an external timezone database when historical or regional DST
rules are required.

`JulianTime.toZonedTime(offsetMinutes)` performs the same display conversion from
a timezone-free instant. A `ZonedTime` can be converted directly; the longer
`clock.toJulianTime().toZonedTime(offset)` chain is no longer necessary.

## Chart clocks and Four Pillars

`normalizeChartTime(value)` validates and freezes a timezone-free chart clock.
`normalizeChartVirtualTime()` remains a deprecated alias.

```js
import { calculateFourPillars } from 'js-ephemeris-lite';

const instant = beijing.toJulianTime();
const chartTime = {
  year: 2026, month: 8, day: 1,
  hour: 12, minute: 0, second: 0,
};
const pillars = calculateFourPillars(instant, chartTime, {
  utcOffsetMinutes: 480,
});
```

The instant determines astronomical boundaries. `chartTime` determines the day
and hour clock fields after any civil, mean-solar, or apparent-solar conversion.
Higher-level Bazi and Ziwei packages perform that conversion and retain the
options used to construct the chart.

## Calendar options

`CalendarOptions` controls historical/astronomical calendar mode, civil-day
boundary, fixed offset or meridian, and the `fast`, `mid`, or `accurate` solar
term/new-moon solver. Historical calendar mode changes date assignment; it does
not replace the physical astronomical event time.

When converting a lunar day and then constructing a chart, use the same options
for both operations. Mixing offsets or calendar modes is supported for explicit
comparisons but can disagree near day, leap-month, solar-term, and historical
reform boundaries.

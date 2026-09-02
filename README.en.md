# js-ephemeris-lite

[简体中文](./README.md) · [English](./README.en.md)

A dependency-free JavaScript library for astronomy and Chinese calendars in browsers and Node.js. It provides planetary and lunar positions, sky events, eclipses, solar terms, lunar phases, Chinese calendar conversion, Ganzhi, and solar-time calculations. TypeScript declarations are included.

The planetary models are derived from VSOP2013 and TOP2013, the lunar model is derived from ELP/MPP02, and their compact published series are calibrated against DE441. Eclipse algorithms, historical Chinese calendar material, and some era-name records are derived from [Shou Xing Tian Wen Li](https://github.com/sxwnl/sxwnl). See [Third-Party Notices](./THIRD_PARTY_NOTICES.md) for sources, modifications, licenses, and limitations.

Website: [redsc1.com](https://www.redsc1.com/)  
Online tools: [redsc1.com/tools](https://www.redsc1.com/tools)

## Installation

Node.js 18 or later is required. Browser projects can use the package through an ES-module-aware bundler.

```sh
npm install js-ephemeris-lite
```

The API is still in beta and may change before the first stable release.

## Quick start

Convert between civil and Chinese calendar dates and generate a year's solar terms and lunar phases:

```js
import { solarToLunar, lunarToSolar, getQiShuoYear } from 'js-ephemeris-lite';

const options = {
  mode: 'china-astronomical',
  utcOffsetMinutes: 480,
};

const lunar = solarToLunar({ year: 2025, month: 1, day: 29 }, options);
console.log(lunar.month, lunar.day); // 1 1

const solar = lunarToSolar({
  year: 2033,
  month: 11,
  day: 1,
  isLeap: true,
}, options);
console.log(solar);

const year = getQiShuoYear(2026, {
  ...options,
  lunarPhaseAnglesDeg: [0, 90, 180, 270],
});
console.log(year.events);
```

Query heliocentric positions and apparent coordinates:

```js
import {
  apparentBodyPosition,
  planetHeliocentricState,
} from 'js-ephemeris-lite';

const jdTT = 2460000.5;

const mars = planetHeliocentricState('mars', jdTT);
console.log(mars.position); // AU
console.log(mars.velocity); // AU/day

const apparent = apparentBodyPosition('mars', jdTT);
console.log(apparent.rightAscensionDeg, apparent.declinationDeg);
```

Search for astronomical events:

```js
import {
  searchGreatestElongations,
  searchSolarEclipses,
  searchStations,
} from 'js-ephemeris-lite';

const startTT = 2461041.5;
const endTT = 2461406.5;

console.log(searchStations('mercury', startTT, endTT));
console.log(searchGreatestElongations('venus', startTT, endTT));
console.log(searchSolarEclipses(
  new Date('2026-01-01T00:00:00Z'),
  new Date('2027-01-01T00:00:00Z'),
));
```

## Main capabilities

- Position and velocity of the Sun, Moon, eight planets, and Pluto in heliocentric, geocentric, and Earth-Moon-barycentric forms.
- Apparent coordinates, horizontal coordinates, rise/set/transit events, illumination, angular diameter, and elongation.
- Longitude crossings, conjunctions, oppositions, stations, sign ingresses, apsides, nodes, and greatest elongations.
- Global and local solar/lunar eclipse searches, contacts, local visibility, and compatibility APIs including `ecFast`, `ysPL`, `rsGS`, and `rsPL`.
- Twenty-four solar terms, seventy-two pentads, new moons, and arbitrary principal lunar phases.
- Chinese calendar conversion, leap months, historical calendar reforms, Chinese era names, and Ganzhi.
- Mean solar time, apparent solar time, equation of time, sunrise/sunset, twilight, polar-day, and polar-night handling.
- TSC1 v1 star-catalog parsing, alias lookup, 3D space-motion propagation, and apparent fixed-star positions. The optional `taiyin-star-catalog-lite` package supplies the default bright-star catalog.

Asteroids are not currently supported. Eclipse search APIs do not include maps or administrative-region data.

## Time scales, units, and ranges

- Ephemeris positions and event solvers use **JD(TT)**. Calendar and horizon-observation APIs use **JD(UT1)**.
- Event `time` values are timezone-free `JulianTime` objects. Use `event.time.toZonedTime(offsetMinutes)` for a civil clock reading.
- The lightweight time layer assumes `UTC ≈ UT1`; it does not ship leap-second, TAI, or Earth-orientation tables.
- Geometric coordinates use the J2000 ecliptic frame. Planetary distance is in AU; geocentric lunar distance is in km. Each API documents any different units.
- Civil dates use the Gregorian calendar from 1582-10-15 and the Julian calendar before that date. Astronomical year 0 represents 1 BCE.
- The principal ephemeris models target astronomical years `-6000..10000`. Individual APIs may have narrower limits.
- Pluto's recommended interval is 1600–2200. Outside it, the package uses a lower-accuracy fallback model; do not treat those results as high precision.

Solver tolerance is not an absolute statement of astronomical accuracy. Accuracy varies by body, epoch, model, and time-scale inputs. See the Chinese [accuracy notes](./docs/accuracy.md) for current measurements and limitations.

Geometric position calls accept a direct optional accuracy argument, for example
`planetHeliocentricState('mars', jdTT, 'fast')`. Apparent positions use
`{ accuracy: 'fast' }` because that options object also selects the frame and physical
corrections. Both default to `accurate`; the tiers share one offline-ordered coefficient
table and do not use global accuracy state.

## Solar-term and lunar-phase accuracy modes

The calendar solvers expose three per-call or per-instance modes. These modes do more
than truncate coefficient counts: they select different event models, physical correction
chains, and root-solving routes.

| Mode | Calculation route | Intended use |
| --- | --- | --- |
| `fast` | Dedicated value-only model, simplified light-time/aberration, fixed-stage correction | Large batches and previews |
| `mid` | Dedicated event model with analytic angular rates and tolerance-driven iteration | Default for calendars and applications |
| `accurate` | Complete apparent-position chain with light-time, aberration, frame transforms, and applicable deflection | Validation and accuracy-sensitive work |

There is no module-level mutable accuracy setting. Direct `solve…` calls accept `{ accuracy }`; Chinese-calendar and higher-level packages keep the setting in their own query or instance options.

## Geometric positions versus full theories

The table reports **3D geometric position RMS against DE441, in km**, on the same
**2,050 dates in 1600–2200**. Lower values mean closer agreement on these samples.
The library uses its position `accurate` tier; full theories retain all supplied terms
and do not receive this library's DE441 corrections.

| Body | Library accurate | Full VSOP87A | Full VSOP2013 | Full TOP2013 |
| --- | ---: | ---: | ---: | ---: |
| Mercury | 6.05 | 14.8 | 5.71 | — |
| Venus | 10.5 | 23.5 | 4.47 | — |
| Earth–Moon barycentre¹ | 14.8 | 46.6 | 3.04 | — |
| Mars | 40.6 | 242 | 12.3 | — |
| Jupiter | 80.7 | 1,100 | 32.6 | 32.8 |
| Saturn | 91.2 | 2,012 | 8.83 | 13.1 |
| Uranus | 373 | 17,345 | 16,825 | 16,855 |
| Neptune | 791 | 55,682 | 5,152 | 5,096 |

¹ The Earth row compares the **Earth–Moon barycentre**, using `embPosition()`,
VSOP87A's `.emb` table, and body 3 of VSOP2013. It is not a physical-Earth-centre
error measurement. TOP2013 uses its full L/B/R tables and has no inner-planet entries here.

The Moon is measured separately relative to the Earth, also as 3D RMS in km,
with 2,050 dates per interval:

| Model | 1600–2200 | −1000–3000 | −6000–10000 |
| --- | ---: | ---: | ---: |
| Library accurate | 0.275 | 0.468 | 2.28 |
| Full ELP/MPP02 (DE405 parameters) | 0.058 | 50.7 | 1,290 |
| Full ELP2000-82B | 9.49 | 666 | 5,327 |

The library is calibrated against DE441; the original theories were fitted to different
references and epochs. This is not a ranking of intrinsic theory accuracy, an equal-budget
benchmark, or a speed comparison. Wide-range results include extrapolation of the original
theories and are not validity guarantees. Sample statistics are not continuous error bounds
and cannot be directly converted to seconds of event-time error.
See the [full results, accuracy tiers, frame conventions, and reproduction guide](./docs/model-comparison.md).

## Related packages

All packages can be installed separately. The Bazi, Ziwei, and Huangli packages depend on this core package.

| Package | Purpose |
| --- | --- |
| `js-ephemeris-lite` | Astronomy, time, events, and Chinese calendars |
| [`bazi-lite`](./packages/bazi) | Four Pillars, Ten Gods, hidden stems, Shen-Sha, luck cycles, and reverse lookup |
| [`ziwei-lite`](./packages/ziwei) | Zi Wei charts, time flows, custom rules, and star reverse lookup |
| [`huangli-lite`](./packages/huangli) | Daily Yi/Ji, Shen-Sha, festivals, flying stars, and Simplified/Traditional Chinese output |
| [`taiyin-star-catalog-lite`](./packages/star-catalog) | Optional TSC1 bright-star catalog |

## Documentation

The detailed guides are currently maintained in Chinese:

- [Positions](./docs/positions.md)
- [Time, solar time, Ganzhi, and Chinese calendars](./docs/time-and-calendar.md)
- [Sky events and visibility](./docs/sky-events.md)
- [Eclipse search](./docs/eclipse-search.md)
- [Accuracy and model limits](./docs/accuracy.md)
- [Architecture](./docs/architecture.md)
- [Development and tests](./docs/development.md)

## License and attribution

Code is licensed under [MPL-2.0](./LICENSE). Scientific theories, derived data, historical material, and their respective conditions are documented in [Third-Party Notices](./THIRD_PARTY_NOTICES.md). A [Chinese version](./THIRD_PARTY_NOTICES.zh-CN.md) is also available.

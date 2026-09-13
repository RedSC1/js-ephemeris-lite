# Asteroids and centaurs

The optional `asteroid-ephemeris-lite` package provides heliocentric and geocentric geometric positions for nine minor bodies in fixed mean-J2000 ecliptic axes. The functions return three-dimensional AU vectors for general geometric use; the models are not longitude-only or astrology-specific.

```sh
npm install js-ephemeris-lite asteroid-ephemeris-lite
```

```js
import {
  ASTEROID,
  asteroidGeocentricPosition,
  asteroidHeliocentricPosition,
} from 'asteroid-ephemeris-lite';

const jdTT = 2451545;
const ceresFromSun = asteroidHeliocentricPosition(ASTEROID.CERES, jdTT);
const chironFromEarth = asteroidGeocentricPosition(ASTEROID.CHIRON, jdTT, 'accurate');
```

The module includes Ceres, Pallas, Juno, Vesta, Eros, asteroid 1181 Lilith, Chiron, Pholus, and Nessus. `LILITH_1181` means asteroid 1181, not a lunar-apogee “Black Moon Lilith” point.

## Time, axes, and corrections

- Input is a finite `JD(TT)` in astronomical years -3000 through 3000.
- Output uses fixed mean-J2000 ecliptic and equinox axes, in AU.
- The heliocentric function is Sun-centered. The geocentric function subtracts the Earth model selected by `accuracy`.
- Positions are geometric. They do not include light time, aberration, gravitational deflection, precession-nutation, or topocentric parallax.
- Offline source samples use TDB. The millisecond-scale periodic TT–TDB difference is negligible relative to these lite-model budgets.

A quintic boundary correction keeps adjacent fitted segments position-continuous. The public module does not currently expose asteroid velocity and makes no analytic-velocity accuracy claim.

## Models and accuracy

Six moderate-eccentricity objects use segmented Poisson models of osculating elements. The three centaurs use adaptive Cartesian Chebyshev segments selected by three-dimensional position error rather than direction error alone.

The following independent cross-epoch sample results are observations, not strict all-time bounds. `ASTEROID_MODEL_INFO.positionErrorBudgetKm` publishes the more conservative regression limits.

| Body | 3D position RMS | Maximum 3D position | Maximum direction error |
| --- | ---: | ---: | ---: |
| Ceres | 14,835 km | 50,379 km | 26.94″ |
| Pallas | 24,994 km | 98,847 km | 72.48″ |
| Juno | 46,907 km | 232,321 km | 158.24″ |
| Vesta | 13,181 km | 34,484 km | 21.77″ |
| Eros | 19,662 km | 95,804 km | 113.08″ |
| 1181 Lilith | 7,649 km | 44,878 km | 26.75″ |
| Chiron | 557 km | 2,185 km | 0.31″ |
| Pholus | 590 km | 3,665 km | 0.48″ |
| Nessus | 496 km | 915 km | 0.09″ |

These models are intended for approximate positions, visualization, and candidate-event screening in size-constrained applications. Use an appropriate JPL SPK or another validated numerical ephemeris for measurement reduction, occultation prediction, spacecraft navigation, or work that requires kilometre-level guarantees.

## Sources and long-range limits

- Ceres, Pallas, Juno, and Vesta use JPL `sb441-n16` samples over the module's complete interval.
- Eros uses JPL `sb441-n373s` from approximately 1550 through 2650; dates outside that interval come from the project's continuous offline numerical integration.
- 1181 Lilith, Chiron, Pholus, and Nessus use JPL Horizons SPKs from approximately 1799 through 2101; dates outside that interval use the same offline data pipeline's numerical extensions.

The latter extensions are not direct JPL ephemerides. Their uncertainty depends on the initial orbit, perturbation model, and chaotic amplification around close encounters, and normally grows away from the official source interval.

The asteroid coefficients are not part of the `js-ephemeris-lite` core package. Projects download them only when they install the optional package.

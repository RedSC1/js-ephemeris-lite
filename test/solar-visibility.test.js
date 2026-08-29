import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SOLAR_ALTITUDE_STATE,
  SOLAR_VISIBILITY_INFO,
  computeSolarRiseSetFast,
  hybridAtmosphericRefraction,
  solarAltitude,
  solarRiseSetForDate,
} from '../src/solar-visibility.js';
import { JulianTime, ZonedTime } from '../src/time.js';

const DEG_TO_RAD = Math.PI / 180;

function zonedDate(year, month, day, offsetMinutes) {
  return new ZonedTime({ year, month, day, hour: 0, minute: 0, second: 0, offsetMinutes });
}

test('hybrid refraction matches the C++ oracle and cutoff behavior', () => {
  assert.ok(Math.abs(hybridAtmosphericRefraction(15 * DEG_TO_RAD, {
    pressureMbar: 1010,
    temperatureCelsius: 10,
  }) - 1.05132761341894705e-3) < 2e-15);
  assert.equal(hybridAtmosphericRefraction(-1.01 * DEG_TO_RAD), 0);
  assert.equal(SOLAR_VISIBILITY_INFO.refractionModel, 'C++ hybrid (Bennett/Smart blend)');
});

test('Denver fast sunrise/set tracks the C++ fast regression oracles', () => {
  const base = {
    longitudeDeg: -104.9903,
    latitudeDeg: 39.7392,
    heightMeters: 1609,
  };
  const variants = [
    [{}, 2460409.022335537709, 2460409.563677349128, 8, 10],
    [{ refraction: false }, 2460409.024388565216, 2460409.561618985143, 0.25, 0.25],
    [{ limb: 'center', refraction: false }, 2460409.025327078679, 2460409.562713850470, 4, 200],
    [{ limb: 'lower', refraction: false }, 2460409.026337929536, 2460409.559664948378, 0.25, 0.25],
    [{ fixedDiscSize: true, refraction: false }, 2460409.024387161247, 2460409.561620542314, 0.25, 0.25],
  ];
  for (const [options, expectedRise, expectedSet, riseTolerance, setTolerance] of variants) {
    const result = solarRiseSetForDate(
      zonedDate(2024, 4, 8, -360),
      base,
      options,
    );
    assert.equal(result.altitudeState, SOLAR_ALTITUDE_STATE.CROSSES);
    assert.ok(result.rise instanceof JulianTime);
    assert.ok(result.set instanceof JulianTime);
    assert.ok(Math.abs(result.rise.jdUT1 - expectedRise) * 86400 <= riseTolerance);
    assert.ok(Math.abs(result.set.jdUT1 - expectedSet) * 86400 <= setTolerance);
    assert.equal(result.rise.toZonedTime(-360).day, 8);
    assert.equal(result.set.toZonedTime(-360).day, 8);
  }
});

test('high-latitude fast window classifies crossings, polar day and polar night', () => {
  const location = { longitudeDeg: 18.9553, latitudeDeg: 69.6492, heightMeters: 10 };
  const spring = solarRiseSetForDate(
    zonedDate(2024, 4, 15, 120),
    location,
  );
  assert.equal(spring.altitudeState, SOLAR_ALTITUDE_STATE.CROSSES);
  assert.ok(spring.rise && spring.set);

  const summer = solarRiseSetForDate(
    zonedDate(2024, 6, 21, 120),
    location,
  );
  assert.equal(summer.altitudeState, SOLAR_ALTITUDE_STATE.ALWAYS_ABOVE);
  assert.equal(summer.rise, null);
  assert.equal(summer.set, null);

  const winter = solarRiseSetForDate(
    zonedDate(2024, 12, 21, 60),
    location,
  );
  assert.equal(winter.altitudeState, SOLAR_ALTITUDE_STATE.ALWAYS_BELOW);
});

test('typed center and standalone altitude APIs remain finite', () => {
  const center = new ZonedTime({
    year: 2025, month: 1, day: 1, hour: 12, minute: 0, offsetMinutes: 480,
  }).toJulianTime();
  const observer = { longitudeDeg: 116.4, latitudeDeg: 39.9, heightMeters: 50 };
  const result = computeSolarRiseSetFast(center, observer);
  assert.equal(result.altitudeState, SOLAR_ALTITUDE_STATE.CROSSES);
  const altitude = solarAltitude(center, observer);
  assert.ok(Number.isFinite(altitude.centerAltitudeRad));
  assert.ok(Number.isFinite(altitude.apparentAltitudeRad));
  assert.ok(Number.isFinite(altitude.azimuthRad));
  assert.equal("residualRad" in altitude, false);
  assert.deepEqual(Object.keys(result).sort(), ["altitudeState", "limb", "refraction", "rise", "set"]);

  const numeric = solarRiseSetForDate(center.jdUT1, observer);
  assert.ok(numeric.rise instanceof JulianTime);
  assert.ok(numeric.set instanceof JulianTime);
  const typed = solarRiseSetForDate(center, observer);
  assert.ok(typed.rise instanceof JulianTime);
  assert.ok(typed.set instanceof JulianTime);
  assert.ok(Math.abs(numeric.rise.jdUT1 - typed.rise.jdUT1) < 1e-15);
  assert.ok(Math.abs(numeric.set.jdUT1 - typed.set.jdUT1) < 1e-15);
});

test('fast rise/set remains finite across the lite long interval', () => {
  for (const year of [-6000, 0, 10000]) {
    const result = solarRiseSetForDate(
      zonedDate(year, 6, 21, 480),
      { longitudeDeg: 116.4, latitudeDeg: 39.9, heightMeters: 50 },
    );
    assert.equal(result.altitudeState, SOLAR_ALTITUDE_STATE.CROSSES);
    assert.ok(Number.isFinite(result.rise.jdUT1));
    assert.ok(Number.isFinite(result.set.jdUT1));
  }
});

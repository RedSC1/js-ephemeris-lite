import test from 'node:test';
import assert from 'node:assert/strict';
import {
  J2000,
  AU_KM,
  EARTH_MOON_MASS_RATIO,
  MOON_MODEL_INFO,
  PLANET,
  PLANET_CORRECTION_INFO,
  PLANET_MODEL_INFO,
  correctionWeight,
  earthDirectionState,
  earthHeliocentricPosition,
  earthHeliocentricState,
  earthPosition,
  moonGeocentricPosition,
  moonGeocentricState,
  moonHeliocentricPosition,
  moonHeliocentricState,
  moonDirectionState,
  moonElpLongitudeState,
  moonPosition,
  planetGeocentricState,
  planetCorrectionState,
  planetHeliocentricPosition,
  planetHeliocentricState,
  sunGeocentricPosition,
  sunGeocentricState,
  embHeliocentricPosition,
  embHeliocentricState,
  embPosition,
  iau2000bNutation,
  vondrak2011PrecessionMatrix,
} from '../src/ephemeris.js';

function near(actual, expected, tolerance, message = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} != ${expected} (tol ${tolerance})`);
}

test('modern and long-span correction layers use a smooth complementary blend', () => {
  assert.equal(correctionWeight(J2000), 0);
  assert.equal(correctionWeight(J2000 + 800 * 365.25), 0);
  assert.equal(correctionWeight(J2000 - 800 * 365.25), 0);
  near(correctionWeight(J2000 + 900 * 365.25), 0.5, 1e-15);
  assert.equal(correctionWeight(J2000 + 1000 * 365.25), 1);
  assert.deepEqual(PLANET_CORRECTION_INFO.modernFitIntervalYears, [1000, 3000]);
  assert.deepEqual(PLANET_CORRECTION_INFO.longFitIntervalYears, [-6000, 10000]);
  assert.deepEqual(PLANET_CORRECTION_INFO.blendDistanceFromJ2000Years, [800, 1000]);
});

test('planet correction states share the Earth/Moon switch and blend boundaries', () => {
  for (const planet of Object.values(PLANET)) {
    assert.deepEqual(planetCorrectionState(planet, J2000, false), [
      { value: 0, rate: 0 }, { value: 0, rate: 0 }, { value: 0, rate: 0 },
    ]);
    for (const years of [-1000, -900, -800, 0, 800, 900, 1000]) {
      const state = planetCorrectionState(planet, J2000 + years * 365.25);
      assert.ok(state.every(({ value, rate }) => Number.isFinite(value) && Number.isFinite(rate)));
    }
  }
  assert.equal(PLANET_CORRECTION_INFO.oracle, 'JPL DE441');
  assert.ok(PLANET_CORRECTION_INFO.validation.mercury.modern.longitudeArcsec.rms < 0.04);
  assert.ok(PLANET_CORRECTION_INFO.validation.jupiter.long.longitudeArcsec.rms < 0.25);
  assert.ok(PLANET_CORRECTION_INFO.validation.saturn.long.longitudeArcsec.rms < 0.3);
  assert.ok(PLANET_CORRECTION_INFO.validation.neptune.long.longitudeArcsec.rms < 2);
});

test('J2000 modern-corrected and raw truncated Earth and Moon values', () => {
  const earth = earthPosition(J2000);
  const moon = moonPosition(J2000);
  const expectedEarth = [-0.17713506845664023, 0.9672416627904105, -0.000003945988425422161];
  const expectedMoon = [-291608.52118138445, -274979.68183097447, 36271.36061049973];
  earth.forEach((value, index) => near(value, expectedEarth[index], 2e-15, `earth[${index}]`));
  moon.forEach((value, index) => near(value, expectedMoon[index], 2e-9, `moon[${index}]`));
  assert.deepEqual(earthPosition(J2000, { corrections: false }),
    [-0.17713539623857041, 0.9672416027622578, -0.000003945988425422161]);
  assert.deepEqual(moonPosition(J2000, { corrections: false }),
    [-291608.5374584195, -274979.66456961766, 36271.36061049973]);
});

test('planet budgets follow the Shou Xing per-coordinate envelope on VSOP87B', () => {
  assert.deepEqual(PLANET_MODEL_INFO, {
    earth: { longitudeTerms: 376, latitudeTerms: 27, radiusTerms: 479, totalTerms: 882 },
    mercury: { longitudeTerms: 268, latitudeTerms: 124, radiusTerms: 209, totalTerms: 601 },
    venus: { longitudeTerms: 146, latitudeTerms: 70, radiusTerms: 142, totalTerms: 358 },
    mars: { longitudeTerms: 478, latitudeTerms: 90, radiusTerms: 521, totalTerms: 1089 },
    jupiter: { longitudeTerms: 510, latitudeTerms: 147, radiusTerms: 644, totalTerms: 1301 },
    saturn: { longitudeTerms: 771, latitudeTerms: 231, radiusTerms: 1170, totalTerms: 2172 },
    uranus: { longitudeTerms: 356, latitudeTerms: 79, radiusTerms: 599, totalTerms: 1034 },
    neptune: { longitudeTerms: 94, latitudeTerms: 41, radiusTerms: 107, totalTerms: 242 },
  });
});

test('truncated planets stay close to the official full VSOP87B J2000 checks', () => {
  const oracles = {
    mercury: [4.4293481043, -0.0527573411, 0.4664714751, 1e-6],
    venus: [3.1870221910, 0.0569782849, 0.7202129248, 1e-6],
    earth: [1.7519238637, -0.0000039656, 0.9833276823, 1e-6],
    mars: [6.2735389872, -0.0247779824, 1.3912076937, 2e-6],
    jupiter: [0.6334614217, -0.0205001039, 4.9653812803, 1e-5],
    saturn: [0.7980038867, -0.0401984149, 9.1838482881, 1e-5],
    uranus: [5.5225485297, -0.0119527878, 19.9240478952, 1e-4],
    neptune: [5.3045629284, 0.0042236790, 30.1205329332, 1e-4],
  };
  for (const [planet, [longitude, latitude, radius, tolerance]] of Object.entries(oracles)) {
    const cosLatitude = Math.cos(latitude);
    const expected = [
      radius * cosLatitude * Math.cos(longitude),
      radius * cosLatitude * Math.sin(longitude),
      radius * Math.sin(latitude),
    ];
    const actual = planetHeliocentricPosition(planet, J2000, { corrections: false });
    near(Math.hypot(...actual.map((value, axis) => value - expected[axis])), 0, tolerance, planet);
  }
});

test('planet velocities are analytic derivatives and geocentric states subtract Earth', () => {
  const h = 0.001;
  for (const planet of Object.values(PLANET)) {
    const state = planetHeliocentricState(planet, J2000);
    const before = planetHeliocentricPosition(planet, J2000 - h);
    const after = planetHeliocentricPosition(planet, J2000 + h);
    for (let axis = 0; axis < 3; axis += 1) {
      near(state.velocity[axis], (after[axis] - before[axis]) / (2 * h), 1e-8, `${planet}[${axis}]`);
    }

    const geocentric = planetGeocentricState(planet, J2000);
    const earth = planetHeliocentricState(PLANET.EARTH, J2000);
    for (let axis = 0; axis < 3; axis += 1) {
      near(geocentric.position[axis], state.position[axis] - earth.position[axis], 0);
      near(geocentric.velocity[axis], state.velocity[axis] - earth.velocity[axis], 0);
    }
  }
  assert.throws(() => planetHeliocentricState('pluto', J2000), /unknown planet/u);
});

test('planet analytic velocities remain continuous at correction-layer bridges', () => {
  const h = 0.002;
  for (const planet of Object.values(PLANET).filter(value => value !== PLANET.EARTH)) {
    for (const year of [990, 1000, 1200, 2800, 3000, 3010]) {
      const jd = J2000 + (year - 2000) * 365.25;
      const state = planetHeliocentricState(planet, jd);
      const before = planetHeliocentricPosition(planet, jd - h);
      const after = planetHeliocentricPosition(planet, jd + h);
      for (let axis = 0; axis < 3; axis += 1) {
        near(state.velocity[axis], (after[axis] - before[axis]) / (2 * h), 2e-7,
          `${planet}/${year}[${axis}]`);
      }
    }
  }
});

test('giant-planet residual segments preserve analytic velocity across their joins', () => {
  const h = 0.002;
  for (const planet of [PLANET.JUPITER, PLANET.SATURN]) {
    for (const year of [-5975, -4000, 0, 4000, 9975]) {
      const jd = J2000 + (year - 2000) * 365.25;
      const state = planetHeliocentricState(planet, jd);
      const before = planetHeliocentricPosition(planet, jd - h);
      const after = planetHeliocentricPosition(planet, jd + h);
      for (let axis = 0; axis < 3; axis += 1) {
        near(state.velocity[axis], (after[axis] - before[axis]) / (2 * h), 2e-7,
          `${planet}/${year}[${axis}]`);
      }
    }
  }
});

test('event direction skips radius while matching the complete Moon state', () => {
  assert.deepEqual(MOON_MODEL_INFO, {
    longitudeTerms: 627,
    latitudeTerms: 277,
    radiusTerms: 327,
    eventDirectionSkipsRadius: true,
    directionLatitudeTerms: [0, 5, 10, 20, 'full'],
  });
  for (const jd of [J2000, 2415020.5, 3182029.5, 3912514.5]) {
    const position = moonPosition(jd);
    const radius = Math.hypot(...position);
    const direction = moonDirectionState(jd).position;
    direction.forEach((value, index) => near(value, position[index] / radius, 4e-15));
    near(Math.hypot(...direction), 1, 4e-15);
  }
});

test('Earth event direction skips radius while preserving angular state', () => {
  for (const jd of [J2000, 2415020.5, 3182029.5, 3912514.5]) {
    const state = earthHeliocentricState(jd);
    const radius = Math.hypot(...state.position);
    const radialRate = state.position.reduce(
      (sum, value, index) => sum + value * state.velocity[index],
      0,
    ) / radius;
    const direction = earthDirectionState(jd);
    direction.position.forEach((value, index) => near(value, state.position[index] / radius, 4e-15));
    direction.velocity.forEach((value, index) => near(
      value,
      state.velocity[index] / radius - state.position[index] * radialRate / (radius * radius),
      4e-15,
    ));
  }
});

test('raw ELP longitude remains separately accessible with analytic rate', () => {
  for (const jd of [J2000, 2415020.5, 3182029.5]) {
    const h = 1e-3;
    const state = moonElpLongitudeState(jd);
    const numerical = Math.atan2(
      Math.sin(moonElpLongitudeState(jd + h).value - moonElpLongitudeState(jd - h).value),
      Math.cos(moonElpLongitudeState(jd + h).value - moonElpLongitudeState(jd - h).value),
    ) / (2 * h);
    near(state.rate, numerical, 2e-7);
  }
});

test('EMB is Earth plus the lunar mass-weighted displacement', () => {
  for (const jd of [J2000, 2415020.5, 3182029.5]) {
    const earth = earthPosition(jd);
    const moon = moonPosition(jd);
    const emb = embPosition(jd);
    const scale = 1 / ((1 + EARTH_MOON_MASS_RATIO) * AU_KM);
    emb.forEach((value, index) => near(value, earth[index] + moon[index] * scale, 2e-15));
  }
});

test('explicit center-named APIs preserve vector, velocity and unit relationships', () => {
  for (const jd of [J2000, 2415020.5, 3182029.5]) {
    const earth = earthHeliocentricState(jd);
    const sun = sunGeocentricState(jd);
    const moonGeo = moonGeocentricState(jd);
    const moonHelio = moonHeliocentricState(jd);

    assert.deepEqual(earthHeliocentricPosition(jd), earth.position);
    assert.deepEqual(earth.position, earthPosition(jd));
    assert.deepEqual(moonGeocentricPosition(jd), moonGeo.position);
    assert.deepEqual(moonGeo.position, moonPosition(jd));
    assert.deepEqual(moonHeliocentricPosition(jd), moonHelio.position);
    assert.deepEqual(sunGeocentricPosition(jd), sun.position);
    assert.deepEqual(embHeliocentricPosition(jd), embHeliocentricState(jd).position);
    assert.deepEqual(embHeliocentricPosition(jd), embPosition(jd));

    for (let axis = 0; axis < 3; axis += 1) {
      near(sun.position[axis], -earth.position[axis], 0);
      near(sun.velocity[axis], -earth.velocity[axis], 0);
      near(moonHelio.position[axis], earth.position[axis] + moonGeo.position[axis] / AU_KM, 0);
      near(moonHelio.velocity[axis], earth.velocity[axis] + moonGeo.velocity[axis] / AU_KM, 0);
    }
  }
});

test('IAU 2000B matches C++/SOFA regression oracles', () => {
  const oracles = [
    [2451545.0, -0.000067542612539922361, -0.000027970923310985653, 0.40909260060058289],
    [2460000.0, -0.000044811878657808338, 0.000037607177053908570, 0.40904003706375935],
    [2415020.5, 0.000084518702696893369, -0.000011103153586824906, 0.40931965795344111],
  ];
  for (const [jd, dpsi, deps, obliquity] of oracles) {
    const actual = iau2000bNutation(jd);
    near(actual.dpsi, dpsi, 1e-16);
    near(actual.deps, deps, 1e-16);
    near(actual.meanObliquity, obliquity, 1e-16);
  }
});

test('Vondrak 2011 matches C++/SOFA long-term precession oracles', () => {
  const oracles = [
    [2451545.0, [[1, -7.0782797432736689e-8, 8.0561489398790301e-8], [7.0782797433127277e-8, 1, 3.3055566297944602e-8], [-8.0561489398447120e-8, -3.3055566297944596e-8, 1]]],
    [2460000.0, [[0.99998407267080236, -0.0051765046329333838, -0.0022490452445638656], [0.0051765047729521365, 0.99998660179283250, -0.0000057588872958970894], [0.0022490449222988557, -0.0000058833978765631683, 0.99999747087796709]]],
    [1219339.078, [[0.68473393269150270, 0.66647787827593630, 0.29486722298289560], [-0.66669476097832980, 0.73625641556112600, -0.11595079227472853], [-0.29437652267952263, -0.11719099075396050, 0.94847706065103420]]],
  ];
  for (const [jd, expected] of oracles) {
    const actual = vondrak2011PrecessionMatrix(jd);
    actual.forEach((row, i) => row.forEach((value, j) => near(value, expected[i][j], 2e-14)));
  }
});

test('models remain finite over the intended wide interval', () => {
  for (const year of [-6000, -4712, 0, 2000, 9999, 10000]) {
    const jd = J2000 + (year - 2000) * 365.25;
    const vectors = [moonPosition(jd), embPosition(jd), ...Object.values(PLANET).map(planet => (
      planetHeliocentricPosition(planet, jd)
    ))];
    for (const vector of vectors) {
      assert.equal(vector.length, 3);
      assert.ok(vector.every(Number.isFinite), `${year}: ${vector}`);
    }
  }
});

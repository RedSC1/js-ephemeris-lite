/**
 * Shared equation-of-center expansion for the lightweight asteroid models.
 *
 * It approximates true anomaly - mean anomaly for 0 <= e <= 0.42 with
 * 16 sine harmonics. Each harmonic amplitude is a degree-10 Chebyshev
 * polynomial in eccentricity, avoiding an iterative Kepler solver.
 */

export const MAX_ASTEROID_EXPANSION_ECCENTRICITY = 0.42;

const HARMONIC_COUNT = 16;
const ECCENTRICITY_DEGREE = 10;
const COEFFICIENT_WIDTH = ECCENTRICITY_DEGREE + 1;

// 16 x 11 little-endian float32 coefficients, harmonic-major order.
const PACKED_COEFFICIENTS =
  'MivUPsK/0j73KFi7dwkGunP7hzeaiw42lMsfNPEeojKVjgYxWBuDL6PJ6y3glaE9l2fVPRU3yTxGp1u6sKvHuGh5SzarWZg0evMUMphkqTAnzSYvdHOhLWh+vDxQ/As9S4lWPONX6jp2SCC5hRtSt/nxOzWxi0sz+dmRrx2ChS7NWYQtHZcDPKuOUDzyJsk7QbnOOh8d7Tglfs63Hte0taCRHTQBJPIxiT+sr8icaKy5+Eo7SqOnOwWbOTsO5YA6hso3OZEy5TX7HXO23VXYs4i76zJBQWAwa0/QrhLGpjr4wQ07czqsOkXdDzruARY5gpSMN2R8sLXU1gK1bwrUMFrlnjG6ekwueSwPOtaZeDqUgCE6hSqZOQuHyDjsd503cBCTNXiRu7TusHuz2K04MSAuQTDj2305PwHgOVAfmTlObx85q/dzOIv6fTfZ3A82tyMQs4xnibOAE8qxNmlHMFWo5jhDK045MK4SOWUdpDge4Qw4Q90wN2pvETaZvEs0fy0Cs3ylJ7LktM6vxq5VOAABwTjE0Y04zwUoOEarnTei4+I2fpzqNRDLkjRgn88xAMT8sf/1rrARF8k33jU3OItBCjiQoqs3XfUsN/A9ijaBAag1rpaNNMO/8TJOkyqxevS3sKS1Pzd88a8338WHNzA9LzceO7s2BcYiNgSUXzXxNWU0JjwYMwba5jAKTWKwgMS4NuahKjdyNAY3gAOzNrzdSDbIHLs1vZkNNdiUJzQNKw8zyXmJMWBKR69hvDM2x+GmNjRthTYiEzc2ySnWNYRkUzWqMK00vTPlM+nS6DISt6AxISaoL2s+sDUcaSQ24lcFNiiAuzVeXGM1fcbrNNtuTjTNhpUzkwetMuTqlDHjdRowrAYuNdYDozUo4oU19lhANSin8DRCN4I0eEvxM3dtPDOyzHEyIFhzMRRoLDA=';

function decodeFloat32(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  const view = new DataView(bytes.buffer);
  const values = new Float64Array(binary.length / 4);
  for (let index = 0; index < values.length; index++) {
    values[index] = view.getFloat32(index * 4, true);
  }
  return values;
}

const COEFFICIENTS = decodeFloat32(PACKED_COEFFICIENTS);

function chebyshev(offset, x) {
  let b1 = 0, b2 = 0;
  for (let index = ECCENTRICITY_DEGREE; index >= 1; index--) {
    const b0 = 2 * x * b1 - b2 + COEFFICIENTS[offset + index];
    b2 = b1;
    b1 = b0;
  }
  return x * b1 - b2 + COEFFICIENTS[offset];
}

export function asteroidTrueAnomaly(meanAnomaly, eccentricity) {
  if (eccentricity < 0 || eccentricity > MAX_ASTEROID_EXPANSION_ECCENTRICITY + Number.EPSILON) {
    throw new RangeError('eccentricity is outside the lightweight asteroid expansion domain');
  }
  const x = 2 * Math.min(eccentricity, MAX_ASTEROID_EXPANSION_ECCENTRICITY)
    / MAX_ASTEROID_EXPANSION_ECCENTRICITY - 1;
  const sinMean = Math.sin(meanAnomaly), cosMean = Math.cos(meanAnomaly);
  let sinHarmonic = sinMean, cosHarmonic = cosMean, correction = 0;
  for (let harmonic = 0; harmonic < HARMONIC_COUNT; harmonic++) {
    correction += chebyshev(harmonic * COEFFICIENT_WIDTH, x) * sinHarmonic;
    const nextSin = sinHarmonic * cosMean + cosHarmonic * sinMean;
    cosHarmonic = cosHarmonic * cosMean - sinHarmonic * sinMean;
    sinHarmonic = nextSin;
  }
  return meanAnomaly + correction;
}

export function asteroidOrbitalRadius(semiMajorAxisAu, eccentricity, trueAnomaly) {
  return semiMajorAxisAu * (1 - eccentricity * eccentricity)
    / (1 + eccentricity * Math.cos(trueAnomaly));
}

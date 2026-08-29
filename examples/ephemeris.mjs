import {
  J2000, earthPosition, moonPosition, embPosition,
  iau2000bNutation, vondrak2011PrecessionMatrix,
} from '../src/ephemeris.js';

function vectorSummary(vector, unit) {
  return { x: vector[0], y: vector[1], z: vector[2], unit };
}

const argument = process.argv[2];
const jdTT = argument === undefined ? J2000 : Number(argument);
if (!Number.isFinite(jdTT)) {
  console.error('Usage: npm run demo -- [jdTT]');
  process.exitCode = 2;
} else {
  console.log(JSON.stringify({
    jdTT,
    earth: vectorSummary(earthPosition(jdTT), 'AU'),
    moon: vectorSummary(moonPosition(jdTT), 'km'),
    emb: vectorSummary(embPosition(jdTT), 'AU'),
    iau2000b: iau2000bNutation(jdTT),
    vondrak2011: vondrak2011PrecessionMatrix(jdTT),
  }, null, 2));
}

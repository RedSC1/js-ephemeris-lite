import {
  fixedStarIcrfState, fixedStarPosition, fixedStarState,
} from '../src/fixed-stars.js';
import {
  LITE_STAR_CATALOG_INFO, loadLiteStarCatalog,
} from '../packages/star-catalog/src/node.js';

const key = process.argv[2] ?? '角宿一';
const jdTT = process.argv[3] === undefined ? 2460000.5 : Number(process.argv[3]);

if (!Number.isFinite(jdTT)) {
  console.error('用法：npm run demo:fixed-stars -- [恒星名称或编号] [jdTT]');
  process.exitCode = 2;
} else {
  const catalog = await loadLiteStarCatalog();
  const star = catalog.find(key);
  if (!star) {
    console.error(`星表中没有找到：${key}`);
    process.exitCode = 2;
  } else {
    const icrf = fixedStarIcrfState(catalog, star, jdTT);
    const apparent = fixedStarPosition(catalog, star, jdTT);
    const rates = fixedStarState(catalog, star, jdTT);
    console.log(JSON.stringify({
      catalog: {
        ...LITE_STAR_CATALOG_INFO,
        minEpoch: catalog.catalogMinEpoch,
        maxEpoch: catalog.catalogMaxEpoch,
      },
      query: key,
      star,
      jdTT,
      icrf: {
        positionAu: icrf.positionAu,
        velocityAuPerDay: icrf.velocityAuPerDay,
      },
      apparent: {
        frame: apparent.frame,
        rightAscensionDeg: apparent.rightAscensionDeg,
        declinationDeg: apparent.declinationDeg,
        eclipticLongitudeDeg: apparent.longitudeDeg,
        eclipticLatitudeDeg: apparent.latitudeDeg,
        distanceAu: apparent.distanceAu,
        rightAscensionSpeedDegPerDay: rates.rightAscensionSpeedDegPerDay,
        declinationSpeedDegPerDay: rates.declinationSpeedDegPerDay,
      },
    }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  }
}

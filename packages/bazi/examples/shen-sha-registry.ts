import { BaziChart, GENDER, SHEN_SHA_TARGET, ShenShaRegistry } from '../src/index.js';
import { ZonedTime } from 'js-ephemeris-lite';

const chart = BaziChart.fromZonedTime(new ZonedTime({
  year: 2000, month: 1, day: 1, hour: 12, offsetMinutes: 480,
}), { gender: GENDER.MALE });
const registry = new ShenShaRegistry();
registry.register({
  id: 'example:day-marker',
  name: '日柱示例',
  test: context => context.targetKind === SHEN_SHA_TARGET.DAY,
});
const bound = registry.bind(chart, { gender: chart.options.gender });
registry.remove('example:day-marker'); // Does not modify the bound collection.
console.log(bound.natal());
console.log(bound.forTarget(chart.extraPillars.mingGong, SHEN_SHA_TARGET.MING_GONG));

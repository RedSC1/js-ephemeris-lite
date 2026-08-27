import { analyzePillars, collectChartRelations, collectTargetShenSha, shenShaWords } from '../../packages/bazi/dist/index.js';

export function baziSignature(row) {
  const pillars = Object.fromEntries(['year', 'month', 'day', 'hour'].map((key, i) => [key, row.pillars[i]]));
  const chart = analyzePillars(pillars, { earthPalaceMode: row.mode });
  const shenSha = row.pillars.flatMap((pillar, kind) => [undefined, 0, 1].map(gender =>
    shenShaWords(collectTargetShenSha(chart, pillar, kind, { gender })).map(String)));
  return [...Object.values(chart.extraPillars),
    ...chart.columns.map(p => [p.visibleTenGod, p.lifeStage, p.nayinId, p.hiddenStems, p.hiddenTenGods]),
    collectChartRelations(chart).map(r => [r.kind, r.pillarMask, r.combinedElement ?? 255]), shenSha];
}

export function* baziFiniteRows() {
  const pillar = i => ((i % 10) << 4) | i % 12;
  for (let year = 0; year < 60; year++) for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) for (let hour = 0; hour < 12; hour++) {
      // Month/hour stems follow Wu-Hu-Dun/Wu-Shu-Dun; branches are Zi=0..Hai=11.
      const monthStem = ((year % 10 % 5) * 2 + 2 + (month + 10) % 12) % 10;
      const hourStem = ((day % 10 % 5) * 2 + hour) % 10;
      const pillars = [pillar(year), (monthStem << 4) | month, pillar(day), (hourStem << 4) | hour];
      for (const mode of [0, 1]) yield { mode, pillars };
    }
}

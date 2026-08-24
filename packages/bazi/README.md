# @opendestiny/bazi-lite

八字规则层的 TypeScript workspace。当前保持 `private: true`，依赖同一仓库根目录的 `js-ephemeris-lite`。

内核沿用紧凑干支编码：一柱一个数字，高 4 bit 是天干 `0..9`，低 4 bit 是地支 `0..11`。这与 C++ `uint8_t` 表示兼容，但 JS 数值本身仍是 `number`。

```ts
import {
  calculateBaziChart,
  collectChartRelations,
  unpackPillar,
} from '@opendestiny/bazi-lite';
import { fourPillarsForZonedTime } from 'js-ephemeris-lite';

const pillars = fourPillarsForZonedTime(birthTime);
const chart = calculateBaziChart(pillars);

console.log(unpackPillar(chart.pillars.day));
console.log(chart.columns[2].hiddenStems);
console.log(collectChartRelations(chart));
```

已有纯规则内核：

- 柱的紧凑编码与可读解码；
- 空亡、十神、藏干、十二长生；
- 命宫、身宫、胎元、胎息；
- 天干与地支的合冲刑害破、三合、三会与关系聚合；
- 流年、流月、流日、流时、小运和大运干支；
- 男女顺逆和两套人元司令表。

节气、真太阳时、早晚子时和四柱天文边界仍由 `js-ephemeris-lite` 负责；本包不复制天文公式。神煞与起运时刻将在公开 API 稳定前继续补齐。

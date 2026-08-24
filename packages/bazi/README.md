# @opendestiny/bazi-lite

八字规则层的 TypeScript workspace。当前保持 `private: true`，依赖同一仓库根目录的 `js-ephemeris-lite`。

内核沿用紧凑干支编码：一柱一个数字，高 4 bit 是天干 `0..9`，低 4 bit 是地支 `0..11`。这与 C++ `uint8_t` 表示兼容，但 JS 数值本身仍是 `number`。

```ts
import {
  GENDER,
  calculateBaziChart,
  collectChartRelations,
  collectNatalShenSha,
  shenShaNames,
  unpackPillar,
} from '@opendestiny/bazi-lite';
import { fourPillarsForZonedTime } from 'js-ephemeris-lite';

const pillars = fourPillarsForZonedTime(birthTime);
const chart = calculateBaziChart(pillars);

console.log(unpackPillar(chart.pillars.day));
console.log(chart.columns[2].hiddenStems);
console.log(collectChartRelations(chart));

const shenSha = collectNatalShenSha(chart, { gender: GENDER.MALE });
console.log(shenShaNames(shenSha.day));
```

已有纯规则内核：

- 柱的紧凑编码与可读解码；
- 空亡、十神、藏干、十二长生；
- 命宫、身宫、胎元、胎息；
- 天干与地支的合冲刑害破、三合、三会与关系聚合；
- 流年、流月、流日、流时、小运和大运干支；
- 男女顺逆和两套人元司令表。
- 66 个稳定 ID 的神煞规则，包含目标柱限制和性别相关规则。

神煞返回一个 `bigint`：bit `n` 对应稳定神煞 ID `n`。`hasShenSha()` 查单位，`shenShaIds()` / `shenShaNames()` 用于展示，`shenShaWords()` 可转为与 C++ 相同的 `[low64, high64]`。由于 JSON 不直接支持 `bigint`，序列化时应转成 ID 数组或十六进制字符串。

节气、真太阳时、早晚子时和四柱天文边界仍由 `js-ephemeris-lite` 负责；本包不复制天文公式。

快速测试运行常用 oracle；完整神煞指纹会枚举 518,400 个合法命盘：

```bash
npm run test --workspace @opendestiny/bazi-lite
npm run test:shen-sha --workspace @opendestiny/bazi-lite
```

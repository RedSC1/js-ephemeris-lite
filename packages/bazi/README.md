# bazi-lite

面向 JavaScript 和 TypeScript 的八字计算库，支持四柱解读、神煞、起运大运和出生时间反查。
天文、历法与太阳时计算由 `js-ephemeris-lite` 提供，可在浏览器或 Node.js 中使用。

## 安装

需要 Node.js 18 或更高版本，或支持 ES modules 的浏览器构建环境。

```sh
npm install bazi-lite@beta js-ephemeris-lite@beta
```

文档对应当前源码；已发布版本的 API 请以随包文档为准。

## 快速开始

```js
import { ZonedTime, describeFourPillars } from 'js-ephemeris-lite';
import { BaziChart, BaziOptions, GENDER, shenShaNames } from 'bazi-lite';

const birth = new ZonedTime({
  year: 2003, month: 3, day: 13,
  hour: 14, minute: 15, second: 0,
  offsetMinutes: 480,
});

const chart = BaziChart.fromZonedTime(
  birth,
  new BaziOptions({ gender: GENDER.MALE }),
);

console.log(describeFourPillars(chart.pillars));
console.log(shenShaNames(chart.getShenSha().day));
console.log(chart.getDaYunTable());
```

`offsetMinutes` 是出生钟表的固定 UTC 偏移，单位为分钟。
性别可省略；计算起运、大运及性别相关神煞时需要提供。

## 示例导航

| 需求 | 指南 |
| --- | --- |
| 钟表时间、真太阳时或直接用四柱建盘 | [创建八字](./docs/guide.md#创建八字) |
| 读取十神、藏干、关系、神煞及 JSON | [读取命盘](./docs/guide.md#读取命盘) |
| 起运、大运及三种边界模型 | [起运与大运](./docs/guide.md#起运与大运) |
| 按三柱或四柱反查出生时间 | [四柱反查](./docs/guide.md#四柱反查) |
| 晚子时、历史历法与默认设置 | [晚子时历史边界与默认值](./docs/guide.md#晚子时历史边界与默认值) |

## 功能

- 四柱、十神、藏干、十二长生、纳音，以及命宫、身宫、胎元、胎息。
- 天干地支关系与神煞查询。
- 起运、大运、小运、流年和人元司令。
- 钟表时间、地方平太阳时、真太阳时及三种晚子时规则。
- 指定日期范围内的三柱/四柱反查。
- JSON 命盘快照，包含出生时间与计算设置。

## 常用设置

默认采用中国历史历法、UTC+8 历法日界和出生钟表时间；23:00 起按次日日柱计算。
起运默认使用传统三天一岁模型，大运每十个民历年一步，默认生成八步。

通过 `BaziOptions` 配置历法、时区、子时规则和运限。
真太阳时需设置 `clockMode: BAZI_CLOCK_MODE.TRUE_SOLAR` 并提供经度；
`options.with(...)` 可创建一份调整后的配置。

完整参数、默认值和独立示例见[使用指南](./docs/guide.md)。

## 导出命盘

沿用快速开始中的 `chart`：

```js
const snapshot = chart.toJSON();
const json = JSON.stringify(chart, null, 2);
console.log(snapshot.schemaVersion, json);
```

导出包含四柱、神煞、关系、出生钟表和排盘时间。
未提供性别时，快照中的 `fortune` 为 `null`。
字段说明见[JSON 与反查指南](./docs/guide.md)。

## 使用范围

日期采用天文年号及 1582 年儒略历/格里历切换规则。
天文精度取决于核心库；传统规则的输出用于术数研究和应用展示。
本包提供计算与数据，不包含网页界面。

## 文档与许可

[使用指南](./docs/guide.md)涵盖读取命盘、太阳时、神煞、运限、反查与默认设置。

代码采用 [MPL-2.0](./LICENSE)。
本包来源说明见[中文第三方声明](./THIRD_PARTY_NOTICES.zh-CN.md)；天文与历史
数据来源另见核心库的[中文第三方声明](https://github.com/RedSC1/js-ephemeris-lite/blob/main/THIRD_PARTY_NOTICES.zh-CN.md)。

# ziwei-lite

[English](./README.en.md)

面向 JavaScript 和 TypeScript 的紫微斗数计算库。
从出生时间生成命盘，查询宫位、星曜、四化及流运，并支持自定义安星规则。
天文与农历计算由 `js-ephemeris-lite` 提供。

## 安装

需要 Node.js 18 或更高版本，或支持 ES modules 的浏览器构建环境。

```sh
npm install ziwei-lite js-ephemeris-lite
```

文档对应当前源码；已发布版本的 API 请以随包文档为准。

## 快速开始

```js
import { ZonedTime } from 'js-ephemeris-lite';
import { ZiweiChart, ZiweiOptions, ZIWEI_GENDER, PALACE } from 'ziwei-lite';

const birth = new ZonedTime({
  year: 2003, month: 3, day: 13,
  hour: 14, minute: 15, second: 0,
  offsetMinutes: 480,
});

const chart = ZiweiChart.fromZonedTime(
  birth,
  new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }),
);

console.log(chart.facts.lunarDate);
console.log(chart.getPalace(PALACE.LIFE));
console.log(chart.getStarsInPalace(PALACE.LIFE));
console.log(chart.birthYearTransformations);
```

出生钟表需明确固定 UTC 偏移，`ZiweiOptions` 需提供性别。
请使用 `ZIWEI_GENDER` 常量；它与八字包的性别数值编码不同。

## 创建命盘

除了公历钟表时间，也可以从已知农历日期创建：

```js
const lunarChart = ZiweiChart.fromLunarDay({
  year: 2003,
  month: 2,
  day: 11,
  isLeap: false,
}, {
  hour: 14,
  minute: 15,
}, new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }));
```

日期对象只表示一天，出生时辰必须单独传入。`fromSolarDay()` 提供对称的公历日入口。
两个入口都使用同一份 `ZiweiOptions` 解释固定时区、历史历法与定气定朔精度。

如果只想按给定的年月日时参数安星，不需要真实日期和行运时间，可直接调用：

```js
import { arrangeZiweiStars } from 'ziwei-lite';

const placement = arrangeZiweiStars({
  yearGanIndex: 9,  // 癸，甲为 0
  yearZhiIndex: 7, // 未，子为 0
  month: 2,
  day: 30,
  hourZhiIndex: 6,
}, new ZiweiOptions({ gender: ZIWEI_GENDER.MALE }));

console.log(placement.bureau, placement.starPositions);
```

直接安星不会生成出生瞬间、农历事实或行运时间轴；允许输入现实中不存在的“二月三十”。

## 读取宫位、星曜与四化

```js
import {
  PALACE_NAMES,
  STAR_TRANSFORM_MARK,
  brightnessName,
  findStarId,
} from 'ziwei-lite';

for (const palace of chart.palaces) {
  console.log({
    palace: PALACE_NAMES[palace.palaceId],
    branch: palace.branch,
    stem: palace.stem,
    stars: chart.getStarsInPalace(palace.palaceId),
  });
}

const ziweiId = findStarId('ziwei');
if (ziweiId !== undefined) {
  const star = chart.getStarPosition(ziweiId);
  if (star) {
    console.log(star.branch, brightnessName(star.brightness));
    console.log(chart.hasTransform(ziweiId, STAR_TRANSFORM_MARK.BIRTH_YEAR_QUAN));
  }
}

console.log(chart.birthYearTransformations);
console.log(chart.anchors.bureau, chart.lifeMaster, chart.bodyMaster);
```

星曜 ID 在内置表中保持稳定；自定义星曜使用规则集内的 ID。用于宫位集合的 `bigint`
不应直接交给 `JSON.stringify()`，命盘快照会自动转换为普通星曜数组。

## 示例导航

| 需求 | 指南 |
| --- | --- |
| 从钟表时间或农历日期创建命盘 | [创建命盘](./docs/guide.md#创建命盘) |
| 读取宫位、星曜、亮度与四化 | [读取十二宫](./docs/guide.md#读取十二宫) · [读取星曜](./docs/guide.md#读取星曜) |
| 查询大限、流年、流月、流日和流时 | [流运与时间线](./docs/guide.md#流运与时间线) |
| 按星曜条件反查出生时辰 | [反查时辰](./docs/guide.md#反查时辰) |
| 选择流派或加载自定义规则 | [规则选项与自定义星曜](./docs/custom-rules.md) |

## 功能

- 十二宫、五行局、115 颗本命星、亮度、命主与身主。
- 生年四化、自化和向心四化。
- 大限、小限、流年、流月、流日、流时及 44 颗流曜。
- 含闰月和历史月份的时间线，以及适合应用导航的流运管理器。
- 独立的安星、亮度、四化等规则选项，以及带标签的 JSON 自定义规则。
- 指定范围的星曜条件反查与 JSON 命盘导出。
- 直接输入干支与月日时安星、`chart.modify()` 选择性覆盖，以及保留起限时间的命宫平移。
- 独立的 `ZiweiCastingChart`：手动拼盘、报数映射与随机起盘，不虚构出生日期。

## 主要入口

| 任务 | API |
| --- | --- |
| 公历／农历出生盘 | `ZiweiChart.fromZonedTime()`／`fromSolarDay()`／`fromLunarDay()` |
| 已解析历法事实建盘 | `ZiweiChart.fromResolvedBirth()` |
| 不依赖真实日期的安星 | `arrangeZiweiStars()` |
| 修改或复原盘面 | `chart.modify()`／`chart.shiftLifePalace()`／`chart.reset()` |
| 完整流运 | `chart.resolveFlow()`／`chart.dynamicForTime()` |
| UI 时间线导航 | `chart.timeline()`／`chart.createLimitManager()` |
| 报数、随机及手动拼盘 | `ZiweiCastingChart` |
| 星曜条件反查 | `reverseLookupZiweiTier1()` |
| JSON 快照 | `chart.toJSON()`／`JSON.stringify(chart)` |

## 常用设置

默认采用中国历史历法、UTC+8 历法日界、出生钟表时间和天盘；
23:00 起按次日计算，闰月十五日后按下月处理。
五虎遁、生年四化和身主默认采用农历年界。

使用 `ZiweiOptions` 调整太阳时、闰月和规则选项，
并通过 `eventAccuracy` 选择 `fast`、`mid` 或 `accurate` 定气定朔精度；
使用 `options.with(...)` 派生新的配置。
详见[命盘与设置指南](./docs/guide.md)。

天地人盘通过同一套入口创建，只改变命宫与身宫的定位口径：

```js
import { ZIWEI_CHART_MODE } from 'ziwei-lite';

const earthChart = ZiweiChart.fromZonedTime(
  birth,
  new ZiweiOptions({
    gender: ZIWEI_GENDER.MALE,
    chartMode: ZIWEI_CHART_MODE.DI_PAN,
  }),
);
```

## 流运与导出

沿用快速开始中的 `chart`：

```js
const target = new ZonedTime({
  year: 2026, month: 8, day: 1, hour: 12,
  offsetMinutes: 480,
});

const flow = chart.resolveFlow(target);
console.log(flow.year, flow.month, flow.day, flow.hour);
console.log(JSON.stringify(chart, null, 2));
```

应用需要逐级选择大限、流年、月、日、时，可使用带级联状态的管理器：

```js
const manager = chart.createLimitManager();
manager.setYear(2026);
manager.setMonth(8);
manager.setDay(1);
manager.setHour(0);

console.log(manager.context);
console.log(manager.dynamicChart);

manager.setPhysicalTime(target);
manager.nextDay();
manager.nextHour();
```

选择上层会清除不再有效的下层状态；物理步进会继续遵循命盘的时区、太阳时和子时设置。

`chart.facts.chartTime` 是实际用于排盘的民用、平太阳或真太阳钟面，
`chart.facts.jdUT1` 是物理瞬间，`birthClockTime` 保留原始输入钟表。旧字段
`virtualTime` 暂作兼容别名。

命盘方法、时间线和流运管理器会复用建盘时保存的设置。底层自由函数允许显式混用
另一套设置，方便比较不同流派，但在交节、换日、闰月和历史改历边界可能与原命盘
不一致；通常应重新建盘，不建议只替换后续计算的选项。

JSON 为本命盘快照，包含出生时间、计算设置和自定义规则。

```ts
const modified = chart.modify({ yearGanIndex: 9, yearZhiIndex: 7, updateBureau: false });
const shifted = modified.shiftLifePalace(1);
const original = shifted.reset();
```

修改不改变原始生日。保留五行局时起限时间不变；重算后若五行局变化，起限岁数和大限年份也随新局更新。命宫平移独立执行，不改变当前起限时间。
详见[直接安星与修改已有命盘](./docs/guide.md#直接安星与修改已有命盘)。
流运查询、时间线及反查示例见[使用指南](./docs/guide.md)。

无出生时间的盘使用独立类型：

```ts
import { ZiweiCastingChart } from 'ziwei-lite';

const casting = ZiweiCastingChart.fromInput({
  yearGanIndex: 9, yearZhiIndex: 7, month: 2, day: 30, hourZhiIndex: 6,
}, { gender: ZIWEI_GENDER.MALE });
const reported = ZiweiCastingChart.fromNumber('123456', casting.options);
const random = ZiweiCastingChart.random(casting.options);
```

详见[手动拼盘、报数与随机盘](./docs/guide.md#手动拼盘报数与随机盘)，包括随机空间、映射版本与运行环境要求。

## 星曜条件反查

反查必须提供有限时间范围，返回结果会再次通过正常排盘入口核对：

```js
import { reverseLookupZiweiTier1 } from 'ziwei-lite';

const candidates = reverseLookupZiweiTier1({
  start: new ZonedTime({
    year: 2003, month: 3, day: 1, offsetMinutes: 480,
  }),
  end: new ZonedTime({
    year: 2003, month: 4, day: 1, offsetMinutes: 480,
  }),
  options: chart.options,
  query: {
    ziweiBranch: chart.anchors.ziwei,
  },
});

console.log(candidates.map((item) => item.chartTime));
```

反查结果表示符合条件的逻辑时辰槽，不代表分钟级出生时间。


## 文档与许可

- [命盘、设置、流运、反查与 JSON](./docs/guide.md)
- [规则选项与自定义星曜](./docs/custom-rules.md)

传统规则用于术数研究和应用展示；本包提供计算与数据，不包含网页界面。
代码采用 [MPL-2.0](./LICENSE)。本包来源说明见
[中文第三方声明](./THIRD_PARTY_NOTICES.zh-CN.md)；天文与历史数据来源另见核心库的
[中文第三方声明](https://github.com/RedSC1/js-ephemeris-lite/blob/main/THIRD_PARTY_NOTICES.zh-CN.md)。

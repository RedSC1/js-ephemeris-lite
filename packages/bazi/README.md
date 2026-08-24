# @opendestiny/bazi-lite

基于 `js-ephemeris-lite` 的 TypeScript 八字规则层。当前是同一仓库中的私有 workspace，尚未发布到 npm。

它负责四柱解释、十神藏干、关系、神煞和运限；节气、真太阳时、早晚子时和历史历法边界由 `js-ephemeris-lite` 提供。

## 1. 创建八字

普通固定时区出生时间使用 `ZonedTime`。不要把没有时区含义的 `{ year, month, day }` 直接当出生瞬间。

```ts
import {
  CALENDAR_MODE,
  RAT_HOUR_MODE,
  ZonedTime,
} from 'js-ephemeris-lite';
import {
  EARTH_PALACE_MODE,
  baziForZonedTime,
} from '@opendestiny/bazi-lite';

const birth = new ZonedTime({
  year: 2000,
  month: 1,
  day: 1,
  hour: 23,
  minute: 30,
  second: 0,
  offsetMinutes: 480,
});

const chart = baziForZonedTime(birth, {
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  ratHourMode: RAT_HOUR_MODE.NEXT_DAY,
  earthPalaceMode: EARTH_PALACE_MODE.FIRE_EARTH,
});
```

`baziForZonedTime()` 完成两步：先根据出生瞬间计算年、月、日、时四柱，再生成八字命盘。

所有设置都可以省略，最短写法是 `const chart = baziForZonedTime(birth)`；此时采用本文“默认设置总表”中的配置。

如果已经有四柱，可直接创建命盘：

```ts
import { calculateBaziChart, packPillar } from '@opendestiny/bazi-lite';

const chart = calculateBaziChart({
  year: packPillar(2, 6),  // 丙午
  month: packPillar(6, 2), // 庚寅
  day: packPillar(4, 2),   // 戊寅
  hour: packPillar(3, 5),  // 丁巳
});
```

### 真太阳时排盘

真太阳时是用于日柱、时柱边界的“虚拟钟表”，真实出生瞬间不变。`trueSolarTime()` 会自动处理修正后落入昨天或明天的情况。

```ts
import {
  CALENDAR_MODE,
  RAT_HOUR_MODE,
  ZonedTime,
  trueSolarTime,
} from 'js-ephemeris-lite';
import { calculateBazi } from '@opendestiny/bazi-lite';

const birth = new ZonedTime({
  year: 2000, month: 1, day: 1,
  hour: 23, minute: 30, second: 0,
  offsetMinutes: 480,
});
const solarClock = trueSolarTime(birth, 116.4); // 东经为正

const chart = calculateBazi(
  birth.toJulianTime(), // 真实瞬间：用于节气边界
  solarClock,           // 虚拟钟表：用于日柱、时柱
  {
    mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
    ratHourMode: RAT_HOUR_MODE.NEXT_DAY,
  },
);
```

地方平太阳时把 `trueSolarTime()` 换成 `meanSolarTime()` 即可。库不会根据经度偷偷启用太阳时，必须由调用方显式选择。

## 2. 读取命盘

一柱沿用 C++ 紧凑编码：高 4 bit 是天干 `0..9`，低 4 bit 是地支 `0..11`。例如戊午是 `0x46`。JS 中类型仍是 `number`。

```ts
import {
  LIFE_STAGE_NAMES,
  TEN_GOD_NAMES,
  unpackPillar,
} from '@opendestiny/bazi-lite';
import { HEAVENLY_STEMS, describeFourPillars } from 'js-ephemeris-lite';

console.log(describeFourPillars(chart.pillars));
console.log(unpackPillar(chart.pillars.day));
console.log(HEAVENLY_STEMS[chart.dayMaster]);

for (const column of chart.columns) {
  console.log({
    key: column.key, // year / month / day / hour
    name: column.name,
    visibleTenGod: TEN_GOD_NAMES[column.visibleTenGod],
    hiddenStems: column.hiddenStems.map((stem) => HEAVENLY_STEMS[stem]),
    hiddenTenGods: column.hiddenTenGods.map((id) => TEN_GOD_NAMES[id]),
    lifeStage: LIFE_STAGE_NAMES[column.lifeStage],
    nayinId: column.nayinId,
  });
}

console.log({
  mingGong: unpackPillar(chart.extraPillars.mingGong).name,
  shenGong: unpackPillar(chart.extraPillars.shenGong).name,
  taiYuan: unpackPillar(chart.extraPillars.taiYuan).name,
  taiXi: unpackPillar(chart.extraPillars.taiXi).name,
});
```

## 3. 读取神煞

神煞用一个 `bigint` bitset 表示：bit `n` 对应稳定神煞 ID `n`。这样批量排盘时不会为每个神煞分配对象。

计算原局四柱：

```ts
import {
  GENDER,
  SHEN_SHA,
  collectNatalShenSha,
  hasShenSha,
  shenShaIds,
  shenShaNames,
} from '@opendestiny/bazi-lite';

const natalShenSha = collectNatalShenSha(chart, {
  gender: GENDER.MALE,
});

console.log(shenShaNames(natalShenSha.year));
console.log(shenShaNames(natalShenSha.month));
console.log(shenShaNames(natalShenSha.day));
console.log(shenShaNames(natalShenSha.hour));

if (hasShenSha(natalShenSha.day, SHEN_SHA.KUI_GANG)) {
  console.log('日柱带魁罡');
}

console.log(shenShaIds(natalShenSha.day));
```

不传 `gender` 时只计算性别无关规则；这不是默认男性或默认女性。传入性别后才会追加勾煞、绞煞、元辰、金神、童子、三奇、天罗地网、拱禄、拱贵等相关规则。

计算大运或流年等任意目标柱：

```ts
import {
  GENDER,
  SHEN_SHA_TARGET,
  calculateFlowYear,
  collectTargetShenSha,
  shenShaNames,
} from '@opendestiny/bazi-lite';

const flowYearPillar = calculateFlowYear(2026);
const flowYearShenSha = collectTargetShenSha(
  chart,
  flowYearPillar,
  SHEN_SHA_TARGET.FLOW_YEAR,
  { gender: GENDER.MALE },
);

console.log(shenShaNames(flowYearShenSha));
```

`target` 和 `SHEN_SHA_TARGET` 必须对应。日柱专用神煞不会出现在流年目标上。

如需与 C++ 互传，`shenShaWords(bitset)` 返回 `[low64, high64]`。`bigint` 不能直接 `JSON.stringify()`；序列化时使用 ID 数组、名称数组或 `bitset.toString(16)`。

## 4. 起运与大运

起运分为两步：

1. `calculateQiYun()` 根据性别、年干阴阳和前后节计算交运时刻；
2. `generateDaYun()` 从月柱顺排或逆排大运，并生成每步时间边界。

```ts
import { CALENDAR_MODE } from 'js-ephemeris-lite';
import {
  DAYUN_BOUNDARY_MODEL,
  GENDER,
  QIYUN_TIME_MODEL,
  calculateQiYun,
  generateDaYun,
  unpackPillar,
} from '@opendestiny/bazi-lite';

const qiYun = calculateQiYun(
  birth.toJulianTime(),
  birth, // 必须与创建四柱时采用同一种钟表口径
  chart,
  GENDER.MALE,
  {
    mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
    timeModel: QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR,
  },
);

console.log({
  direction: qiYun.direction, // 1 顺排，-1 逆排
  referenceJie: qiYun.referenceJie,
  jieIntervalDays: qiYun.jieIntervalDays,
  startAgeYears: qiYun.startAgeYears,
  traditionalOffset: qiYun.traditionalOffset,
  startJdUT1: qiYun.startJdUT1,
  startCivilTime: qiYun.startCivilTime,
});

const daYun = generateDaYun(birth, chart, qiYun, {
  count: 8,
  boundaryModel: DAYUN_BOUNDARY_MODEL.CIVIL_YEARS,
});

for (const item of daYun) {
  console.log({
    index: item.index,
    pillar: unpackPillar(item.pillar).name,
    startVirtualAge: item.startVirtualAge,
    endVirtualAge: item.endVirtualAge,
    startJdUT1: item.startJdUT1,
    endJdUT1: item.endJdUT1,
    startCivilTime: item.startCivilTime,
    endCivilTime: item.endCivilTime,
  });
}
```

四柱和起运的 `mode`、`utcOffsetMinutes`、`meridianDeg` 应保持一致，确保两处使用同一套节令口径。

如果四柱使用真太阳时，起运也应传同一个 `solarClock`：

```ts
const qiYun = calculateQiYun(
  birth.toJulianTime(),
  solarClock,
  chart,
  GENDER.MALE,
);

const daYun = generateDaYun(solarClock, chart, qiYun);
```

### 三种起运时刻模型

`QIYUN_TIME_MODEL` 决定“节令间隔如何换成交运时刻”：

| 模型 | 行为 |
|---|---|
| `TRADITIONAL_CALENDAR` | 默认。三天一岁；按 360 日年、30 日月分解为年月日时分秒，再作为民历分量加入出生钟表 |
| `JULIAN_YEAR` | 三天一岁，按连续 `365.25` 日年增加时长 |
| `TROPICAL_YEAR` | 三天一岁，按连续 `365.2422` 日回归年增加时长 |

### 三种大运边界模型

`DAYUN_BOUNDARY_MODEL` 决定“交运以后每十年如何划分”：

| 模型 | 行为 |
|---|---|
| `CIVIL_YEARS` | 默认。每步增加十个民历年 |
| `JULIAN_YEARS` | 每步增加 `10 × 365.25` 日 |
| `TROPICAL_YEARS` | 每步增加 `10 × 365.2422` 日 |

这两个模型相互独立，因此理论上有 `3 × 3` 种组合。通常使用默认组合：`TRADITIONAL_CALENDAR + CIVIL_YEARS`。

当前顺逆规则固定为：阳年男、阴年女顺排；阴年男、阳年女逆排。性别是起运必填参数，没有默认值。

只想取得大运干支、不计算节令交运时刻时，可使用 `generateDaYunPillars()`。

## 5. 晚子时、历史边界与默认值

### 三种晚子时约定

| 设置 | 23:00～00:00 的行为 |
|---|---|
| `RAT_HOUR_MODE.NEXT_DAY` | 默认。日柱进入次日，时干也按次日 |
| `RAT_HOUR_MODE.CURRENT_DAY` | 日柱留在当日，时干按当日 |
| `RAT_HOUR_MODE.CURRENT_DAY_TOMORROW_STEM` | 日柱留在当日，时干按次日 |

### 默认设置总表

| 设置 | 默认值 | 说明 |
|---|---|---|
| 历法模式 | `CALENDAR_MODE.HISTORICAL` | 历史表覆盖范围内使用历史分配日；现代阶段使用精确天文事件 |
| 历史柱边界 | `PILLAR_HISTORICAL_MODE.FOLLOW_CALENDAR` | 是否使用历史节气分配日跟随历法模式 |
| 历法 UTC offset | `480` | 中国标准/历史日期默认 UTC+8 |
| 晚子时 | `RAT_HOUR_MODE.NEXT_DAY` | 23:00 起进入次日柱 |
| 土寄宫 | `EARTH_PALACE_MODE.FIRE_EARTH` | 戊己随火土长生表 |
| 起运时刻 | `QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR` | 传统三天一岁民历分量模型 |
| 大运边界 | `DAYUN_BOUNDARY_MODEL.CIVIL_YEARS` | 每十个民历年一步 |
| 大运数量 | `8` | `generateDaYun()` 默认返回八步 |
| 神煞性别 | 无 | 不传只计算性别无关规则 |
| 人元司令表 | `RENYUAN_SILING_TABLE.SAN_MING_TONG_HUI` | 另一套为 `COMMON` |
| 太阳时 | 不自动启用 | 显式调用 `meanSolarTime()` 或 `trueSolarTime()` |

如果不需要历史分配日、希望年柱和月柱始终在精确立春/节令瞬间切换，可传：

```ts
import {
  CALENDAR_MODE,
  PILLAR_HISTORICAL_MODE,
} from 'js-ephemeris-lite';

const chart = baziForZonedTime(birth, {
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  pillarHistoricalMode: PILLAR_HISTORICAL_MODE.OFF,
});
```

`CALENDAR_MODE.LOCAL_ASTRONOMICAL` 用于按当地 offset 或经度处理地方天文历法；它与“只把日时柱钟表改成真太阳时”是两个不同选择，不应混为一个隐式开关。

## 6. 关系、流运和人元司令

```ts
import {
  PILLAR_MASK,
  RELATION_KIND,
  collectChartRelations,
  generateXiaoYun,
  getRenyuanSilingSegments,
} from '@opendestiny/bazi-lite';

const relations = collectChartRelations(chart, {
  pillarMask: PILLAR_MASK.PRIMARY,
  relationMask: (1 << RELATION_KIND.STEM_COMBINATION)
    | (1 << RELATION_KIND.BRANCH_CLASH)
    | (1 << RELATION_KIND.BRANCH_TRIPLE_COMBINATION),
});

const xiaoYun = generateXiaoYun(chart, qiYun.direction, 8);
const siling = getRenyuanSilingSegments(chart.pillars.month & 0x0f);
```

`collectChartRelations()` 不传设置时分析原局年月日时，并启用全部关系类型。附加柱只有在 `pillarMask` 显式加入时才参与。

## 7. 测试

```bash
npm run test --workspace @opendestiny/bazi-lite
npm run test:shen-sha --workspace @opendestiny/bazi-lite
```

完整神煞测试枚举 518,400 个合法命盘，并分别校验无性别、男性和女性指纹。

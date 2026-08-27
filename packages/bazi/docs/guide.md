# 八字使用指南

安装与最短示例见 [README](../README.md)。下文代码以“创建八字”中的 `birth`、`options` 和 `chart` 为基础；同名变量的再次声明表示替代写法。

## 创建八字

出生时间使用带固定时区偏移的 `ZonedTime`，由日期、钟表时间和 `offsetMinutes` 共同确定瞬时。

```ts
import {
  CALENDAR_DAY_BOUNDARY_MODE,
  CALENDAR_MODE,
  RAT_HOUR_MODE,
  ZonedTime,
} from 'js-ephemeris-lite';
import {
  BAZI_CLOCK_MODE,
  BaziChart,
  BaziOptions,
  DAYUN_BOUNDARY_MODEL,
  EARTH_PALACE_MODE,
  GENDER,
  QIYUN_TIME_MODEL,
} from 'bazi-lite';

const birth = new ZonedTime({
  year: 2000,
  month: 1,
  day: 1,
  hour: 23,
  minute: 30,
  second: 0,
  offsetMinutes: 480,
});

const options = new BaziOptions({
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET,
  ratHourMode: RAT_HOUR_MODE.NEXT_DAY,
  earthPalaceMode: EARTH_PALACE_MODE.FIRE_EARTH,
  gender: GENDER.MALE,
  clockMode: BAZI_CLOCK_MODE.CIVIL,
  qiYunTimeModel: QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR,
  daYunBoundaryModel: DAYUN_BOUNDARY_MODEL.CIVIL_YEARS,
  daYunCount: 8,
});

const chart = BaziChart.fromZonedTime(birth, options);
```

`BaziOptions` 集中保存历法、钟表、子时、性别、起运、大运和人元司令设置。`BaziChart` 会持有同一个不可变实例，后续查询会复用这些设置：

```ts
chart.options === options; // true

const shenSha = chart.getShenSha();
const qiYun = chart.getQiYun();
const daYun = chart.getDaYunTable();
const renyuan = chart.getRenyuanSiling();
```

所有设置都可以省略，最短写法是：

```ts
const chart = BaziChart.fromZonedTime(birth);
```

此时内部仍会创建并持有一个采用默认值的 `BaziOptions`。

需要基于旧配置调整少数选项时使用 `with()`，原对象不会改变：

```ts
const tenSteps = options.with({ daYunCount: 10 });
```

兼容用的 `baziForZonedTime(birth, options)` 和底层纯函数仍然保留。

### 真太阳时排盘

真太阳时是用于日柱、时柱边界的“虚拟钟表”，真实出生瞬间不变。配置类会自动处理修正后落入昨天或明天的情况。

```ts
import {
  BAZI_CLOCK_MODE,
  BaziChart,
  BaziOptions,
} from 'bazi-lite';

const chart = BaziChart.fromZonedTime(birth, new BaziOptions({
  gender: GENDER.MALE,
  clockMode: BAZI_CLOCK_MODE.TRUE_SOLAR,
  longitudeDeg: 116.4, // 东经为正
}));
```

地方平太阳时使用 `BAZI_CLOCK_MODE.MEAN_SOLAR`，默认钟表模式为 `CIVIL`；传入经度后仍需显式选择太阳时模式。

高级用法仍可自行构造虚拟钟表，再调用底层入口：

```ts
import { trueSolarTime } from 'js-ephemeris-lite';
import { calculateBazi } from 'bazi-lite';

const solarClock = trueSolarTime(birth, 116.4);
const chart = calculateBazi(birth.toJulianTime(), solarClock, options);
```

`BaziChart` 不提供 `fromPillars()`：只有四柱本身不能唯一确定出生 JD、节令间隔和起运时刻。需要寻找真实出生候选时应使用下面的有限区间反查；纯规则层只分析一组已知四柱时可使用 `analyzePillars()`。

### 四柱反查

反查必须提供有限的起止日期，因为同一组四柱会在不同年代重复出现。三个入口分别用于搜日期、展开某个日期候选的时辰，以及一次完成四柱反查：

```ts
import {
  BaziReverseLookup,
  packPillar,
} from 'bazi-lite';

const matches = BaziReverseLookup.searchFullBazi({
  year: packPillar(2, 6),  // 丙午
  month: packPillar(6, 2), // 庚寅
  day: packPillar(5, 9),   // 己酉
  hour: packPillar(0, 0),  // 甲子
  startDate: { year: 1900, month: 1, day: 1 },
  endDate: { year: 2100, month: 12, day: 31 },
  options,
});
```

也可以直接调用树摇友好的独立函数 `searchBaziDates()`、`searchBaziTimesForDate()` 和 `reverseLookupBazi()`。反查会复用正向 `BaziChart` 逐项复核，并遵循同一套固定时区、真/平太阳时、历史节气分配日及三种子时设置。节令当天会保留节前、节后候选；时辰结果包含钟表时间段及“晚子时”标记。

## 读取命盘

一柱使用紧凑编码：高 4 bit 是天干 `0..9`，低 4 bit 是地支 `0..11`。例如戊午是 `0x46`。JS 中类型仍是 `number`。

```ts
import {
  LIFE_STAGE_NAMES,
  TEN_GOD_NAMES,
  unpackPillar,
} from 'bazi-lite';
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

## 读取神煞

神煞用一个 `bigint` bitset 表示：bit `n` 对应稳定神煞 ID `n`。可通过下列工具函数读取 ID 和名称。

计算原局四柱：

```ts
import {
  SHEN_SHA,
  hasShenSha,
  shenShaIds,
  shenShaNames,
} from 'bazi-lite';

const natalShenSha = chart.getShenSha();

console.log(shenShaNames(natalShenSha.year));
console.log(shenShaNames(natalShenSha.month));
console.log(shenShaNames(natalShenSha.day));
console.log(shenShaNames(natalShenSha.hour));

if (hasShenSha(natalShenSha.day, SHEN_SHA.KUI_GANG)) {
  console.log('日柱带魁罡');
}

console.log(shenShaIds(natalShenSha.day));
```

`getShenSha()` 自动读取 `chart.options.gender`。配置中不传 `gender` 时只计算性别无关规则。传入性别后才会追加勾煞、绞煞、元辰、金神、童子、三奇、天罗地网、拱禄、拱贵等相关规则。

计算大运或流年等任意目标柱：

```ts
import {
  SHEN_SHA_TARGET,
  calculateFlowYear,
  shenShaNames,
} from 'bazi-lite';

const flowYearPillar = calculateFlowYear(2026);
const flowYearShenSha = chart.getTargetShenSha(
  flowYearPillar,
  SHEN_SHA_TARGET.FLOW_YEAR,
);

console.log(shenShaNames(flowYearShenSha));
```

`target` 和 `SHEN_SHA_TARGET` 必须对应。日柱专用神煞不会出现在流年目标上。

如需与 C++ 互传，`shenShaWords(bitset)` 返回 `[low64, high64]`。`bigint` 不能直接 `JSON.stringify()`；序列化时使用 ID 数组、名称数组或 `bitset.toString(16)`。

### JSON 命盘导出

```ts
const snapshot = chart.toJSON(); // BaziChartJSON，schemaVersion: bazi-chart-v1
const json = JSON.stringify(chart, null, 2); // 自动调用 toJSON()
```

导出四柱、十神、藏干、十二长生、神煞 ID/名称、附加柱、干支关系、司令分段及起运/大运。
未提供性别时 `birth.gender` 与 `fortune` 为 `null`。

- `birth.clockTime`：`fromZonedTime()` 收到的原始出生年月日时分秒及 `offsetMinutes`。
- `birth.virtualTime`：排盘采用的钟表/平太阳/真太阳时间；不带 UTC 偏移。
- `birth.jdUT1`：出生瞬间。时区设置 `options.utcOffsetMinutes` 用于历法归日，
  不一定等于原始钟表的偏移，因此两者分别保存。
- `birth.calendar` 为 1582 年切换的儒略历/格里历，`yearNumbering` 为天文学纪年（0 = 公元前 1 年）。
- 低层 `fromInstant()` 未接收原始钟表，`clockTime` 为 `null`；`birthCivilTime` 表示计算用的虚拟钟表。
  可用导出的 `jdUT1`、`virtualTime`、`options` 重算。

神煞 bitset 已转为普通数组，无 BigInt 序列化问题。起运/大运的民用日期沿用现有
virtual-time 基准，导出内以 `fortune.clockBasis` 标明。本 schema 为本命盘快照，
不含应用当前选中的流运、姓名或地点名称；这些信息可由应用另加 `profile` 保存。

## 起运与大运

`BaziOptions` 中已经保存性别、起运模型、大运边界模型和步数。命盘会复用创建时的出生瞬间和虚拟钟表，不需要调用方再次拼装参数：

```ts
import { unpackPillar } from 'bazi-lite';

const qiYun = chart.getQiYun();

console.log({
  direction: qiYun.direction, // 1 顺排，-1 逆排
  referenceJie: qiYun.referenceJie,
  jieIntervalDays: qiYun.jieIntervalDays,
  startAgeYears: qiYun.startAgeYears,
  traditionalOffset: qiYun.traditionalOffset,
  startJdUT1: qiYun.startJdUT1,
  startCivilTime: qiYun.startCivilTime,
});

const daYun = chart.getDaYunTable();

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

`getQiYun()` 缺少 `options.gender` 时会抛错。底层 `calculateQiYun()` 和 `generateDaYun()` 仍然公开，供批处理或特殊算法直接调用。

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

## 晚子时、历史边界与默认值

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
| 历法日界 | `CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET` | 默认按钟表 UTC offset 划日；经度模式必须显式选择 |
| 历史柱边界 | `PILLAR_HISTORICAL_MODE.FOLLOW_CALENDAR` | 是否使用历史节气分配日跟随历法模式 |
| 历法 UTC offset | `480` | 中国标准/历史日期默认 UTC+8 |
| 晚子时 | `RAT_HOUR_MODE.NEXT_DAY` | 23:00 起进入次日柱 |
| 土寄宫 | `EARTH_PALACE_MODE.FIRE_EARTH` | 戊己随火土长生表 |
| 起运时刻 | `QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR` | 传统三天一岁民历分量模型 |
| 大运边界 | `DAYUN_BOUNDARY_MODEL.CIVIL_YEARS` | 每十个民历年一步 |
| 大运数量 | `8` | `getDaYunTable()` 默认返回八步 |
| 神煞性别 | 无 | 不传只计算性别无关规则 |
| 人元司令表 | `RENYUAN_SILING_TABLE.SAN_MING_TONG_HUI` | 另一套为 `COMMON` |
| 钟表模式 | `BAZI_CLOCK_MODE.CIVIL` | 默认使用出生地民用钟表，不自动启用太阳时 |
| 经度 | 无 | 平太阳时或真太阳时模式必须提供 `longitudeDeg` |

如果不需要历史分配日、希望年柱和月柱始终在精确立春/节令瞬间切换，可传：

```ts
import {
  CALENDAR_MODE,
  PILLAR_HISTORICAL_MODE,
} from 'js-ephemeris-lite';

const options = new BaziOptions({
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  pillarHistoricalMode: PILLAR_HISTORICAL_MODE.OFF,
});

const chart = BaziChart.fromZonedTime(birth, options);
```

`CALENDAR_MODE.LOCAL_ASTRONOMICAL` 用于重建地方天文历法；还必须用 `dayBoundaryMode` 明确选择按钟表 UTC offset 或指定经度划日。选择 `MEAN_SOLAR_MERIDIAN` 时必须传 `meridianDeg`，而固定 UTC offset 模式禁止传它。这个历法日界与“只把日时柱钟表改成真太阳时”是两个不同选择，不应混为一个开关。

## 关系、流运和人元司令

```ts
import {
  PILLAR_MASK,
  RELATION_KIND,
  collectChartRelations,
  generateXiaoYun,
} from 'bazi-lite';

const relations = collectChartRelations(chart, {
  pillarMask: PILLAR_MASK.PRIMARY,
  relationMask: (1 << RELATION_KIND.STEM_COMBINATION)
    | (1 << RELATION_KIND.BRANCH_CLASH)
    | (1 << RELATION_KIND.BRANCH_TRIPLE_COMBINATION),
});

const xiaoYun = generateXiaoYun(chart, qiYun.direction, 8);
const siling = chart.getRenyuanSiling();
```

`collectChartRelations()` 不传设置时分析原局年月日时，并启用全部关系类型。附加柱只有在 `pillarMask` 显式加入时才参与。

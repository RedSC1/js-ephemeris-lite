# 紫微使用指南

安装见 [README](../README.md)。下文示例复用“创建命盘”中的 `birth`、`options` 和 `chart`；同名变量的再次声明表示替代设置。

## 创建命盘

```ts
import {
  CALENDAR_DAY_BOUNDARY_MODE,
  CALENDAR_MODE,
  ZonedTime,
} from 'js-ephemeris-lite';
import {
  ZIWEI_GENDER,
  ZiweiChart,
  ZiweiOptions,
} from 'ziwei-lite';

const birth = new ZonedTime({
  year: 2003,
  month: 3,
  day: 13,
  hour: 14,
  minute: 15,
  second: 0,
  offsetMinutes: 480,
});

const options = new ZiweiOptions({
  gender: ZIWEI_GENDER.MALE,
  mode: CALENDAR_MODE.HISTORICAL,
  dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET,
});

const chart = ZiweiChart.fromZonedTime(birth, options);
```

紫微的性别编码：`MALE = 0`、`FEMALE = 1`。它与八字包历史编码的顺序不同，跨包传递时应使用对应包的性别常量。

`ZiweiChart` 必须从真实出生瞬间创建，因此始终持有：

```ts
chart.facts.jdUT1;
chart.facts.virtualTime;
chart.facts.lunarDate;
chart.facts.solarTermPillars;
chart.facts.lunarPillars;
chart.options;
```

## 读取十二宫

内部宫位状态按照物理地支 `0..11` 排列；宫职通过 `palaceId` 标注。

```ts
import { PALACE, PALACE_NAMES } from 'ziwei-lite';

const lifePalace = chart.getPalace(PALACE.LIFE);
console.log(lifePalace.branch, lifePalace.stem);

for (const palace of chart.palaces) {
  console.log({
    palace: PALACE_NAMES[palace.palaceId],
    branch: palace.branch,
    stem: palace.stem,
    starIds: palace.starIds,
    starBitset: palace.starBitset,
  });
}
```

常用 anchor 和命盘元数据：

```ts
chart.anchors.bureau;          // 五行局稳定 ID
chart.anchors.ziwei;           // 紫微星所在物理地支
chart.anchors.tianfu;          // 天府星所在物理地支
chart.anchors.palacePositions; // 按 PALACE id 索引
chart.bodyPalace;
chart.lifeMaster;              // StarId
chart.bodyMaster;              // StarId
```

## 读取星曜

星曜采用稳定数字 ID；`key` 是不随语言变化的展示键。

```ts
import {
  STAR_CATALOG,
  brightnessName,
  findStarId,
  getStar,
} from 'ziwei-lite';

const ziweiId = findStarId('ziwei')!;
const ziwei = chart.getStarPosition(ziweiId)!;

console.log({
  metadata: getStar(ziweiId),
  branch: ziwei.branch,
  palaceId: ziwei.palaceId,
  brightness: brightnessName(ziwei.brightness),
});

console.log(chart.getStarsInPalace(PALACE.LIFE));
console.log(STAR_CATALOG.length); // 本命星和预留流曜共 159 个稳定 ID
```

`starBitset` 是 `bigint`，bit `n` 表示 StarId `n`。需要 JSON 时使用 `starIds`，不要直接 `JSON.stringify(bigint)`。

### JSON 命盘导出

```ts
const snapshot = chart.toJSON(); // ZiweiChartJSON，schemaVersion: ziwei-chart-v1
const json = JSON.stringify(chart, null, 2);
```

导出完整本命盘：十二宫、星曜 ID/key、亮度及标签、生年四化/自化/向心四化、命身主、
anchors 和计算设置。星曜使用数组，不序列化 BigInt；自定义星曜、规则模块 label、
编译后 patch 和覆盖顺序一并保留。内置星曜的稳定标识为 `key`，应用可按自己的语言增加显示名称。

- `birth.clockTime`：原始出生年月日时分秒和固定 `offsetMinutes`，与历法归日偏移分开保存。
- `birth.virtualTime`：排盘所用钟表/平太阳/真太阳时间；`birth.jdUT1` 是实际输入瞬间。
- `birth.logicalLunarDate`：经过早晚子时等规则处理的排盘农历。
- `fromLunar()` 额外保留 `birth.lunarInput`，同时记录转换后的原始钟表。
- 只有 instant/facts 的低层入口没有原始出生钟表，`clockTime` 为 `null`。
- 日期使用儒略历/格里历 1582 年切换及天文学纪年（0 = 公元前 1 年）。

这是本命盘快照，不含当前流运选择或应用的姓名、地点名称。
应用可另加 `profile`。恢复自定义规则时，将 `options.rules.ruleset.modules` 中每项用
`new ZiweiRuleModule(module)` 构造，再传给 `new ZiweiRuleset(modules)`；不要将解析出的普通对象
直接当成规则类实例。

## 读取四化

每颗星的 `transformMask` 是十二位 mask：

- bit `0..3`：生年禄、权、科、忌；
- bit `4..7`：本宫宫干引发的自化禄、权、科、忌；
- bit `8..11`：对宫宫干引发的向心禄、权、科、忌。

```ts
import { STAR_TRANSFORM_MARK } from 'ziwei-lite';

chart.birthYearTransformations; // { lu, quan, ke, ji }，值均为 StarId

if (chart.hasTransform(ziweiId, STAR_TRANSFORM_MARK.BIRTH_YEAR_QUAN)) {
  console.log('紫微化权');
}
```

## 统一设置

所有持续影响命盘的口径集中在不可变的 `ZiweiOptions` 中：

```ts
import {
  CALENDAR_MODE,
  RAT_HOUR_MODE,
} from 'js-ephemeris-lite';
import {
  LEAP_MONTH_STRATEGY,
  PILLAR_BOUNDARY,
  ZIWEI_CHART_MODE,
  ZIWEI_CLOCK_MODE,
  ZIWEI_RULE_OPTION,
} from 'ziwei-lite';

const options = new ZiweiOptions({
  gender: ZIWEI_GENDER.FEMALE,
  mode: CALENDAR_MODE.HISTORICAL,
  utcOffsetMinutes: 480,
  ratHourMode: RAT_HOUR_MODE.NEXT_DAY,
  clockMode: ZIWEI_CLOCK_MODE.TRUE_SOLAR,
  longitudeDeg: 116.4,
  leapMonthStrategy: LEAP_MONTH_STRATEGY.SPLIT_AFTER_FIFTEENTH,
  chartMode: ZIWEI_CHART_MODE.TIAN_PAN,
  wuHuDunYearBoundary: PILLAR_BOUNDARY.LUNAR,
  sihuaYearBoundary: PILLAR_BOUNDARY.LUNAR,
  bodyMasterYearBoundary: PILLAR_BOUNDARY.LUNAR,
  rules: {
    longevity: ZIWEI_RULE_OPTION.OPTION_2,
    masters: ZIWEI_RULE_OPTION.OPTION_2,
    placement: {
      tianshang: ZIWEI_RULE_OPTION.OPTION_2,
      tianshi: ZIWEI_RULE_OPTION.OPTION_2,
    },
    sihua: {
      gui: ZIWEI_RULE_OPTION.OPTION_2,
    },
  },
});
```

默认设置为：历史中国历法、按钟表 UTC+8 划日、晚子时进入次日、民用钟表、闰月十五后作下月、天盘，以及五虎遁/生年四化/身主均采用农历年界。地方天文历法需显式选择 `CALENDAR_MODE.LOCAL_ASTRONOMICAL`，再通过 `dayBoundaryMode` 选择固定 UTC offset 或指定 `meridianDeg`；经度日界和太阳时都不会自动启用。

使用 `options.with({ ... })` 可从现有配置派生新实例，不会修改旧命盘的口径。

## 规则选项

安星、亮度、四化和命身主可独立配置。完整选项表与 JSON 示例见[自定义规则](./custom-rules.md)。

## 流运与时间线

直接从一个物理时刻解析完整流运：

```ts
const target = new ZonedTime({
  year: 2033, month: 12, day: 22,
  hour: 12, minute: 0, second: 0,
  offsetMinutes: 480,
});

const flow = chart.resolveFlow(target);
console.log(flow.decade, flow.smallLimit, flow.year, flow.month, flow.day, flow.hour);

const dynamic = chart.dynamicForTime(target);
console.log(dynamic.flowStack.length); // 5: 大限→流时
console.log(dynamic.smallLimitLayer);  // 小限是并行年度参考，不是第六层
console.log(dynamic.getFlowStar(findStarId('flow_lucun')));
```

农历流月同时保留四个不能混用的量：书面月份 `month`、含闰月的真实时序位置 `sequence`、用于月干/四化/流曜的 `effectiveMonth`、冬至月起建的 `monthBuildingBranch`。默认流月命宫按 `sequence` 从流年斗君推进；如需让闰月分段的命宫也跟随上月/下月，可单独设置 `flowMonthPalaceStrategy: FLOW_MONTH_PALACE_STRATEGY.EFFECTIVE_MONTH`。`MonthNode.branch` 是实际流月命宫，月份卡片的显示地支则在 `MonthNode.displayBranch`。

给 Web UI 生成整套可选时间线：

```ts
const timeline = chart.timeline();
timeline.getChildhood();
timeline.getDecades();
timeline.getYears(1);
timeline.getMonths(2033);       // 含真实闰月及历史月份
timeline.getDays(2033, 11, true);
timeline.getHours(chart.facts.solarTermPillars.day); // 12 或 13 个子时槽
```

需要有状态的 UI 导航时使用 manager。上层变化会清空所有下层状态：

```ts
const manager = chart.createLimitManager();
manager.setYear(2033);
manager.setMonth(11);
manager.addMonth(1); // 进入真实的闰十一月，不是简单做 month + 1
manager.setDay(1);
manager.setHour(0);

manager.clearMonth(); // 同时清掉月、日、时
manager.setPhysicalTime(target);
manager.nextDay();
manager.nextHour();   // 按早/晚子时的逻辑槽中心步进

console.log(manager.context);
console.log(manager.dynamicChart);
console.log(manager.manifest);
```

`flowLimitBoundary` 可选 `PILLAR_BOUNDARY.LUNAR` 或 `PILLAR_BOUNDARY.SOLAR_TERM`。农历模式按真实阴历年月；节气模式按精确交节时刻。历史历法计算仍服从核心包的历史中国历法模式和 UTC+8 口径。

## 反查时辰

Tier-1 反查接受任意组合的钥匙星约束，在有限时间范围逐个枚举逻辑时辰，并把候选重新送进正常正向排盘验证：

```ts
import { reverseLookupZiweiTier1 } from 'ziwei-lite';

const start = new ZonedTime({ year: 2003, month: 3, day: 1, offsetMinutes: 480 });
const end = new ZonedTime({ year: 2003, month: 4, day: 1, offsetMinutes: 480 });
const candidates = reverseLookupZiweiTier1({
  start,
  end,
  options,
  query: {
    lucunBranch: 5,
    hongluanBranch: 3,
    ziweiBranch: 8,
  },
});

for (const candidate of candidates) {
  console.log(candidate.virtualTime, candidate.lunarDate, candidate.chart);
}
```

结果代表一个逻辑时辰槽，不能据此确定分钟级出生时间。

# ziwei-lite

基于 `js-ephemeris-lite` 的 TypeScript 紫微斗数规则层。

```bash
npm install js-ephemeris-lite ziwei-lite
```

当前版本能从带时区的出生时间创建本命盘，计算历史/天文农历、31 个稳定 anchor、十二宫、五行局、115 颗本命星、庙旺亮度、命主身主，以及本命、自化和向心四化；也包含大限、小限、流年、流月、流日、流时、44 颗流曜、时间线、物理时间步进和时辰反查。默认规则表在构建前离线编译进包，浏览器运行时不解析 TOML。

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

紫微的性别稳定编码沿用 C++：`MALE = 0`、`FEMALE = 1`。它与八字包历史编码的顺序不同，不要直接混用数字。

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
- `birth.logicalLunarDate`：经过早晚子时等规则处理的排盘农历，不冒充原始生日。
- `fromLunar()` 额外保留 `birth.lunarInput`，同时记录转换后的原始钟表。
- 只有 instant/facts 的低层入口不虚构出生钟表，`clockTime` 为 `null`。
- 日期使用儒略历/格里历 1582 年切换及天文学纪年（0 = 公元前 1 年）。

这是本命盘快照，不是 Dart AI JSON 的兼容格式，不含当前流运选择或 UI 的姓名、地点名称。
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

默认值与 C++ 默认 profile 对齐：历史中国历法、按钟表 UTC+8 划日、晚子时进入次日、民用钟表、闰月十五后作下月、天盘，以及五虎遁/生年四化/身主均采用农历年界。地方天文历法需显式选择 `CALENDAR_MODE.LOCAL_ASTRONOMICAL`，再通过 `dayBoundaryMode` 选择固定 UTC offset 或指定 `meridianDeg`；经度日界和太阳时都不会自动启用。

使用 `options.with({ ... })` 可从现有配置派生新实例，不会修改旧命盘的口径。

## 切换规则流派

安星、十二长生、亮度、四化和命身主是相互独立的规则维度，统一放在
`ZiweiOptions.rules` 中，但不会被一个含糊的 `school` 名称绑死：

```ts
const options = new ZiweiOptions({
  gender: ZIWEI_GENDER.MALE,
  rules: {
    placementDefault: 'option1',
    longevity: 'option2',
    brightnessDefault: 'option1',
    sihuaDefault: 'option1',
    masters: 'option2',

    // 资源存在对应 variant 时，还可以逐项覆盖：
    placement: {
      tianshang: 'option2',
      tianshi: 'option2',
    },
    brightness: { taiyang: 'option1' },
    sihua: {
      geng: ZIWEI_RULE_OPTION.OPTION_4,
      gui: ZIWEI_RULE_OPTION.OPTION_2,
    },
  },
});
```

当前随包编译的资源中，以下规则提供两套独立选择：

- `longevity`：十二长生的两套火土局口径；
- `placement.tianshang`、`placement.tianshi`：`option1` 固定天伤在交友、天使在疾厄；各自的 `option2` 按年干阴阳和性别选择交换后的宫位；
- `masters`：`option1` 以命宫支取命主，`option2` 以农历生年支取命主；两套身主都按生年支。

四化同样按天干独立选择，不绑定任何派别名称：

| 天干 | `option1` | `option2` | `option3` | `option4` |
| --- | --- | --- | --- | --- |
| 戊 | 贪阴弼机 | 贪阴阳机 | — | — |
| 庚 | 阳武阴同 | 阳武同阴 | 阳武府同 | 阳武同相 |
| 壬 | 梁紫辅武 | 梁紫府武 | — | — |
| 癸 | 破巨阴贪 | 破巨阳贪 | — | — |

这些 `option2` 只是彼此独立的算法 variant，不代表或预设任何完整门派，亮度也不会跟随切换。
其余普通本命星安星、亮度和六个未列出的天干四化目前仍只有 `option1`。指定资源中不存在的 variant
会在创建命盘时直接抛出带星曜/天干键的 `RangeError`，不会悄悄退回默认表。

命盘创建时会一次性解析上述选择；实际安星和查询亮度仍然只是数组索引，不会在每颗星上重复做流派判断。

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

农历流月同时保留四个不能混用的量：书面月份 `month`、含闰月的真实时序位置 `sequence`、用于月干/四化/流曜的 `effectiveMonth`、冬至月起建的 `monthBuildingBranch`。默认流月命宫按 `sequence` 从流年斗君推进，与 Dart/C++ 一致；如需让闰月分段的命宫也跟随上月/下月，可单独设置 `flowMonthPalaceStrategy: FLOW_MONTH_PALACE_STRATEGY.EFFECTIVE_MONTH`。`MonthNode.branch` 是实际流月命宫，月份卡片的显示地支则在 `MonthNode.displayBranch`。

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

结果代表一个逻辑时辰槽，不伪造分钟级出生时间。

## 自定义规则资源

内置 TOML variant 和用户 JSON 都会先编译成同一种不可变 `ZiweiRuleModule`。每个模块必须有唯一
`label`，随后按 `ZiweiRuleset.modules` 的顺序合并；后加入的模块覆盖前面重叠的星曜或字段。

内置 option 也可以显式编译成模块：

```ts
let ruleset = ZiweiConfigLoader.withOptions(
  ZiweiConfigLoader.getDefault(),
  {
    label: 'my-option2-base',
    longevity: 'option2',
    placement: { tianshang: 'option2', tianshi: 'option2' },
    sihua: { geng: 'option4', gui: 'option2' },
  },
);
```

用户自己保存的 JSON 规则再编译为另一个带标签模块：

```ts
import { ZiweiConfigLoader } from 'ziwei-lite';

ruleset = ZiweiConfigLoader.overrideWith(
  ruleset,
  {
    label: 'my-custom-rules',
    sihuaJson: customSiHuaJson,
    starsJson: customStarsJson,
    brightnessJson: customBrightnessJson,
    mastersJson: customMastersJson,
    flowJson: customFlowStarsJson,
  },
);

const options = new ZiweiOptions({
  gender: ZIWEI_GENDER.MALE,
  rules: { ruleset },
});

const chart = ZiweiChart.fromZonedTime(birth, options);
```

如果先加入 JSON、再调用 `withOptions()`，后面的 option 会覆盖 JSON 的重叠规则；反过来则 JSON 胜出。
相同 label 会直接抛出 `RangeError`，用户 JSON 也不能冒用保留名 `option1..option4`。

`starsJson` 与 `flowJson` 只需列出想覆盖或新增的星曜。未知 `key` 会成为 ruleset 私有的新星，内置
`0..158` ID 保持不变，新星从 `159` 起按模块顺序分配：

```ts
ruleset = ZiweiConfigLoader.overrideWith(ruleset, {
  label: 'my-extra-stars',
  starsJson: JSON.stringify([{
    key: 'custom_star',
    type: 'minor',
    rule: { type: 'anchor_offset', anchor: 'ziwei', offset: 2 },
  }]),
});

const customChart = ZiweiChart.fromZonedTime(
  birth,
  options.with({ rules: { ruleset } }),
);
const id = customChart.findStarId('custom_star');
customChart.getStarInfo(id);
```

新星会进入当前命盘的 `starCatalog`、`starPositions`、宫位 `starIds` 和任意长度的 `BigInt`
`starBitset`。数字 ID 只在编译后的 ruleset 内有效，持久化配置应始终保存稳定 `key`。

该兼容入口能读取旧 Dart app 保存的 `constant`、`anchor_offset`、`lookup`、`lookup_offset` 和
`pipeline` 安星 JSON。规则只在载入时编译一次，排盘时继续使用扁平答案表。需要直接提供机器码时，
可构造带 label 的 `ZiweiRuleModule`，再用 `ruleset.with(module)` 追加。

## 实现范围

已与当前 C++ lite 内核对齐：本命出生解析、anchors、十二宫、独立规则 variant、115 本命星、亮度、命身主、十二位四化 mask、大限/童限、小限、五层流运栈、44 流曜、农历/节气流月、历史历法月份、早晚子时、Timeline、LimitManager 和 Tier-1 反查。另保留 Dart app 用过的自定义 JSON profile 兼容入口。

中文星曜/宫名展示可使用稳定 `key`、`PALACE_NAMES` 和 `brightnessName()`；更完整的 i18n 文案与 UI 主题属于应用层，不耦合进计算包。

规则层已对照 C++ 有限命盘 oracle 连续检查 10,000 张，并对物理日历命盘做逐字段差分。可运行示例见 `examples/basic.ts`。

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

紫微的性别编码：`MALE = 0`、`FEMALE = 1`。它与八字包的编码顺序不同，跨包传递时应使用对应包的性别常量。

`ZiweiChart` 保留原始历法事实；手动修改安星参数不会覆盖这些字段：

```ts
chart.facts.jdUT1;
chart.facts.virtualTime;
chart.facts.lunarDate;
chart.facts.solarTermPillars;
chart.facts.lunarPillars;
chart.options;
```

## 直接安星与修改已有命盘

不需要真实农历日期时，可直接调用安星核心：

```ts
import { arrangeZiweiStars } from 'ziwei-lite';

const placement = arrangeZiweiStars({
  yearGanIndex: 9,  // 癸；甲为 0
  yearZhiIndex: 7, // 未；子为 0
  month: 2,       // 安星月份 1..12
  day: 30,        // 安星生日 1..30
  hourZhiIndex: 6, // 午；子为 0
}, options);

console.log(placement.bureau, placement.starPositions);
console.log(placement.yearTransformations, placement.omittedPlacements);
```

该函数不调用历法转换，不要求“二月三十”等输入对应真实日期，也不产生出生瞬间或行运时间轴。
月份已经是安星所用的有效月份，不再处理闰月、早晚子时或真太阳时。
可选第三参数为 `BUREAU` 常量，用于固定五行局；省略则按输入推算。
直接安星会按输入计算命身宫及宫干，供安星规则使用。

已有命盘可选择性覆盖参数，仍复用相同的锚点计算与安星规则表：

```ts
const modified = chart.modify({
  yearGanIndex: 9,
  yearZhiIndex: 7,
  updateBureau: false,
});
const next = modified.modify({ month: 3, day: 30 });
```

`modify()` 返回新盘，不修改原对象。未指定或为 `undefined` 的字段沿用当前安星参数；
连续调用会累积覆盖，`updateBureau` 也沿用上一次设置，初始默认为 `false`。

| 内容 | 修改行为 |
| --- | --- |
| 出生钟表时间、历法事实、原始四柱 | 不变，供中宫出生资料显示 |
| 命身宫、十二宫宫名、宫干、命主身主 | 不变 |
| 星曜位置 | 用覆盖后的参数重新计算；依赖命身宫的星仍使用原盘命身宫 |
| 年干四化 | 明确覆盖年干时使用新年干，否则保留原有年界设置 |
| 自化、向心四化 | 按新星位和原宫干重新计算 |
| 五行局 | 开关控制，见下文 |
| 大限起岁、起止年份、童限范围 | 随当前五行局计算；局不变则时间不变 |
| 行运顺逆、流年流月等独立日期与宫位映射 | 仍使用原始出生资料，不随安星参数覆盖改变 |

- `updateBureau: false`：使用最初原盘的五行局。
- `updateBureau: true`：按修改后的年月时和原有天地人盘设置重新定局，再据此安星并重新计算起限岁数和对应年份；推导出的命宫仅用于定局，不替换原盘宫名。
- `anchors.bureau` 是安星和起限共用的当前五行局。例如水二局改为火六局，首限由 2～11 岁变为 6～15 岁，对应年份按原出生年重新计算；不另存一套起限局。
- 修改年干支会影响同时依赖年、月、时等多个输入的星，不限于“年系星”。未覆盖的生日与时支输入不会自动改变。
- 显式的年干、年支覆盖同时适用于农历与节气规则；未覆盖的字段仍保留各自年界的历法结果。
- 显式月份覆盖用于月序、月支，并据对应年干重算月干；仅改年干也会更新相关月干。
- 显式生日覆盖用于日序（包括采用节气日序的规则），但不虚构新日期的日干支。日干支仍来自原盘；修改时支时，时干由原日干推导。

`placementInput` 提供当前五个基础参数；`modification.overrides` 才是实际覆盖的字段。
不要用 `placementInput` 替换原始历法事实，它不包含完整的节气四柱信息。

### 干支不配对与缺失输入

年干、年支只验证各自的整数范围，不要求组成合法六十甲子。
这种组合无法确定年旬空时，相关星位为 `-1`，并在 `omittedPlacements` 中列出星 ID 和缺失的规则输入；
`getStarPosition()` 对未排星返回 `null`，其他星正常计算。
直接安星没有实际日期，无法推导日干支及其时干；自定义规则如果依赖这些输入，同样明确列为未排。
有原盘的 `modify()` 则继续使用原日干支，不会伪造。

### 平移命宫

```ts
const shifted = modified.shiftLifePalace(1); // 按地支顺序移动一宫，支持负数
const original = shifted.reset();
```

只移动十二宫宫名与以本命命宫为起点的大限、童限落宫。
星曜物理位置、身宫、宫干、五行局和起限时间不变；流年、小限等原本按独立规则确定的物理落宫不整体平移。
宫名改变后，这些物理宫位对应的本命宫职随之变化。
平移不会触发按新命宫重新安星，后续 `modify()` 也保留平移量，仍以原始命身宫作为安星依据。
`reset()` 返回最初的原盘，清除全部参数覆盖和命宫平移，并恢复原五行局及起限时间；不修改调用它的新盘对象。
未修改的盘调用 `reset()` 返回自身。`resetModification()` 是同义方法。

JSON 快照额外包含 `modification`、`placementInput` 和 `omittedPlacements`。
中宫应继续从 `birth`/`facts` 读取出生资料，从 `anchors.bureau` 读取当前五行局；可另行显示手动调整标识。
这些是附加字段，快照仍使用 `ziwei-chart-v1`；目前不提供通用 JSON 导入器。

## 手动拼盘、报数与随机盘

`ZiweiCastingChart` 是独立于出生盘的类型，两者共享 `ZiweiPlate` 的盘面查询。
它不继承 `ZiweiChart`，没有 `facts`、出生时间、`timeline()`、`resolveFlow()` 或 `dynamicForTime()`，
因此不需要把普通出生盘的字段或方法改成可空类型。

```ts
import { ZiweiCastingChart } from 'ziwei-lite';

const casting = ZiweiCastingChart.fromInput({
  yearGanIndex: 9,
  yearZhiIndex: 7,
  month: 2,
  day: 30,
  hourZhiIndex: 6,
}, { gender: ZIWEI_GENDER.MALE });

const reported = ZiweiCastingChart.fromNumber('123456', casting.options);
const sampled = ZiweiCastingChart.random(casting.options);
```

- `fromInput(input, options, bureau?)`：手动填入独立安星参数，不验证真实日期。可选 `bureau` 使用 `BUREAU` 常量固定局数。
- `fromNumber(number, options)`：接受非负安全整数、`bigint` 或十进制数字字符串。固定映射可复现；前导零不影响结果。
- `random(options, randomUint32?)`：默认用 Web Crypto 产生无符号 32 位数，并用拒绝采样消除取模偏差。
- `fromIndex(index, options)`：按 `0..259199` 的组合编号精确还原参数。随机或报数结果的 `casting.index` 可用于复现。

年从六十甲子中抽取，再拆成年干、年支；月为 1～12，日为 1～30，时支为 0～11。
固定性别与安星规则后，共有 `60 × 12 × 30 × 12 = 259200` 种输入组合。
随机的是输入组合，不保证不同最终盘面等概率；性别和规则不参与随机。
手动 `fromInput()` 仍允许年干支不配对，无法确定的旬空等通过 `omittedPlacements` 报告。

### 一个报数如何得到年月日时

`index-v1` 的编号次序为：时支变化最快，然后是日、月、六十甲子年序。
例如编号 0 对应甲子年、正月初一、子时；编号 259199 对应癸亥年、十二月三十、亥时。
直接把小整数当编号会集中在较早的年序，所以 `fromNumber()` 不直接将报数取模作为编号。

`number-v1` 先将报数规范为十进制字符串，以 `ziwei-casting-number-v1:` 为前缀执行 FNV-1a 32 位混合，
再以 Mulberry32 生成候选整数，经同样的拒绝采样取得组合编号，最后解码成四个参数。
这是本库定义的确定性映射，不代表某一流派的传统报数规则，也不声称复刻其他软件。
相同输入和规则可复现，但映射允许碰撞；用户报数本身不均匀，也不会凭空产生新的独立随机性。
算法版本保存在 `casting.algorithm` 中。

在没有全局 Web Crypto 的环境（例如部分 Node.js 18 启动配置），默认 `random()` 明确报错，不静默改用 `Math.random()`。
可传入自己的均匀无符号 32 位随机源；Node.js 示例：

```ts
import { webcrypto } from 'node:crypto';

const sampledInNode = ZiweiCastingChart.random(casting.options,
  () => webcrypto.getRandomValues(new Uint32Array(1))[0]!);
```

### 查询、修改和重置

```ts
casting.getPalace(PALACE.LIFE);
casting.getStarPosition(casting.findStarId('ziwei')!);
casting.getStarsAtBranch(0);
casting.yearTransformations;

const changed = casting.modify({ month: 3, updateBureau: true });
const moved = changed.shiftLifePalace(1);
const restored = moved.reset(); // 返回最初 casting 对象，不重新随机
```

修改、五行局开关、命宫平移的盘面语义与出生盘相同：未覆盖的参数沿用当前值，
原命身宫和宫干保留；`updateBureau` 初始为 `false`。报数盘没有真实出生时间，因此不提供实际行运年份查询。
`yearTransformations` 表示安星年干的四化，不称为出生年四化；位掩码沿用共享的 `STAR_TRANSFORM_MARK` 编码。

导出使用独立的 `ziwei-casting-chart-v1` 格式，包含起盘来源、原始参数、原五行局、当前参数、修改记录及规则。
盘面四化的首层标记为 `year`（普通出生盘仍为 `birthYear`）。不输出虚构的出生时间或一串占位 `null`。
普通盘的 JSON 格式和时间相关接口保持不变。

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
console.log(STAR_CATALOG.length); // 本命星和流曜共 159 个稳定 ID
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

所有持续影响命盘的口径集中在不可变的 `ZiweiOptions` 中。`eventAccuracy`
控制定气、定朔精度，可选 `fast`、`mid`、`accurate`，默认 `mid`。

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
  eventAccuracy: 'accurate',
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
const flowLucunId = findStarId('flow_lucun');
if (flowLucunId !== undefined) console.log(dynamic.getFlowStar(flowLucunId));
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

`flowLimitBoundary` 默认 `PILLAR_BOUNDARY.LUNAR`，按农历年月划分流运；
`PILLAR_BOUNDARY.SOLAR_TERM` 按立春和十二节划分年月，历史节界遵循 `pillarHistoricalMode`。
节气流月没有闰月，`month = sequence = effectiveMonth`，月干和流月命宫按月序推进；
农历的闰月分段策略不影响这条路径。

## 反查时辰

`reverseLookupZiweiTier1()` 接受钥匙星位置约束和有限时间范围，返回符合条件的出生时辰候选。
结果通过正向排盘核对：

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

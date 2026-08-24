# @opendestiny/ziwei-lite

基于 `js-ephemeris-lite` 的 TypeScript 紫微斗数规则层。当前是仓库内部 workspace，尚未发布到 npm。

当前版本已经能从带时区的出生时间创建本命盘，计算历史/天文农历、31 个稳定 anchor、十二宫、五行局、115 颗本命星、庙旺亮度、命主身主，以及本命、自化和向心四化。默认规则表在构建前离线编译进包，浏览器运行时不解析 TOML。

## 创建命盘

```ts
import { ZonedTime } from 'js-ephemeris-lite';
import {
  ZIWEI_GENDER,
  ZiweiChart,
  ZiweiOptions,
} from '@opendestiny/ziwei-lite';

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
import { PALACE, PALACE_NAMES } from '@opendestiny/ziwei-lite';

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
} from '@opendestiny/ziwei-lite';

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

## 读取四化

每颗星的 `transformMask` 是十二位 mask：

- bit `0..3`：生年禄、权、科、忌；
- bit `4..7`：本宫宫干引发的自化禄、权、科、忌；
- bit `8..11`：对宫宫干引发的向心禄、权、科、忌。

```ts
import { STAR_TRANSFORM_MARK } from '@opendestiny/ziwei-lite';

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
} from '@opendestiny/ziwei-lite';

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

默认值与 C++ 默认 profile 对齐：历史中国历法、UTC+8、晚子时进入次日、民用钟表、闰月十五后作下月、天盘，以及五虎遁/生年四化/身主均采用农历年界。太阳时不会自动启用。

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

## 当前范围

已经完成：本命出生解析、anchors、十二宫、独立规则 variant 选择、本命星规则、亮度、命主身主和十二位四化 mask。

尚未移植：其余安星、亮度和四化的 `option2` 资源，大限/小限、流年流月流日流时栈、反推时辰和中文展示词典。

规则层已对照 C++ 有限命盘 oracle 连续检查 10,000 张，并对物理日历命盘做逐字段差分。可运行示例见 `examples/basic.ts`。

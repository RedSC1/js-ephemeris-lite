# 黄历使用指南

[返回首页](../README.md)。本包尚未发布，以下示例在仓库 workspace 中运行。

## 单日、月与年

```js
import { HuangliCalendar, getHuangliDay, ACTIVITY_MASKS } from 'huangli-lite';

const calendar = new HuangliCalendar({ utcOffsetMinutes: 480 });
const day = calendar.getDay(2026, 3, 16, {
  hour: 12, activityMask: ACTIVITY_MASKS.civilian37,
});
const month = calendar.getMonth(2026, 3);
const year = calendar.getYear(2026);
const single = getHuangliDay({ year: 2026, month: 3, day: 16, hour: 23 }, {
  utcOffsetMinutes: 480, ratHourMode: 'next-day',
});
console.log(day.suitableActivities, month.length, year.length, single.ruleDate);
```

`getMonth/getYear` 返回逐日数组，第二类参数与 `getDay` 的最后一个参数相同，
对每一天应用同一钟表时刻和显示掩码。复用同一个 `HuangliCalendar` 可利用节气月相缓存。
构造后配置不可变；更改设置需新建实例。

日期范围为天文年 `-5999..9999`，年 0 为公元前 1 年。
1582-10-04 后直接接 1582-10-15；缺日输入会报错，该月批量查询返回 21 天。
不支持的设置名或非法参数会报错。

## 配置与默认值

| `HuangliOptions` | 默认值 | 含义 |
| --- | --- | --- |
| `utcOffsetMinutes` | `480` | 固定钟表时区，整数分钟，范围 `-840..840` |
| `mode` | `china-astronomical` | 现代中国天文历法；另选 `historical` 或 `local-astronomical` |
| `ratHourMode` | `next-day` | 23:00 换入次日；另外两种约定见下文 |
| `exactJieQiTime` | `false` | 年月柱按交节日切换；`true` 按天文瞬时切换 |
| `flyingStarMethod` | `consecutive` | 日飞星以距至日最近的甲子日为锚点 |
| `flyingStarBoundary` | `solar` | 年/月飞星按节令；可选 `lunar` |
| `isYeargodDuty` | `true` | 传入宜忌引擎的岁神规则选项 |

单日选项为 `hour`（默认 12）、`minute`（0）、`second`（0，允许小数秒）、
`isTuWangYongShi`（false）和 `activityMask`（省略表示所有事项）。
土王用事通过 `isTuWangYongShi` 由调用者设置。

黄历入口只使用固定钟表时区，不接受经度或太阳时设置，不自动处理夏令时。
`local-astronomical` 按该固定时区重新排布农历；中国天文模式仍使用中国农历结构。
历史模式始终使用中国历表归日，忽略 `exactJieQiTime` 设置。

## 时间和边界

| 子时规则 | 23:00～00:00 的处理 |
| --- | --- |
| `next-day` | 日柱与时干按次日，规则日和规则农历也取次日 |
| `current-day` | 日柱与时干保留当天 |
| `current-day-tomorrow-stem` | 日柱保留当天，时干按次日五鼠遁 |

三种值也可从核心库的 `RAT_HOUR_MODE` 读取。
`solarDate/lunarDate` 始终是展示日期；`ruleDate/ruleLunarDate` 是规则使用的日期。
节日、当日节气与 `moonPhases` 按展示日返回，神煞计算的月相标记按规则日判断。
四绝、四离按展示日的次日是否有相应节气判断。

年柱以立春、月柱以节为界，遵循 `exactJieQiTime`；
晚子时选项单独控制日柱、时干和规则日期。
现代模式的 `nextSolarTermIndex` 按下个物理交节时刻取值，历史模式按下个标注日取值。
`solarTerm` 同时给出天文时刻、当地钟表与归日，历史归日不一定等于天象日。
早期历法十三月保留为 13，不折算为正月；只匹配明确支持该输入的规则。

## 读取结果与 JSON

| 字段 | 内容 |
| --- | --- |
| `solarDate`, `jdUT1`, `weekday` | 查询钟表、物理时刻；星期为 1=周一至 7=周日 |
| `lunarDate`, `pillars`, `pillarNames` | 展示农历、核心压缩干支及其名称 |
| `ruleDate`, `ruleLunarDate`, `ruleInput` | 实际规则日、规则农历与可重放输入 |
| `godIds`, `auspiciousGods`, `inauspiciousGods` | 神煞 ID、吉神与凶神名称 |
| `suitableIds`, `tabooIds`, `suitableActivities`, `tabooActivities` | 宜忌 ID 与名称，已应用显示掩码 |
| `officer`, `officerIndex`, `thingLevel`, `conflictLevel` | 建除、裁决等级与原始冲突等级 |
| `dutyGod`, `hours` | 日黄黑道及子至亥十二时辰黄黑道 |
| `mansion`, `pengZu`, `taiShen`, `godDirections`, `chongSha` | 廿八宿、彭祖百忌、胎神、方位与冲煞 |
| `solarTerm`, `moonPhases`, `festivals` | 当日节气、月相和节日标签 |
| `flyingStars`, `cycle`, `period`, `settings` | 飞星盘、三元九运及解析后的设置 |

结果都是普通数据，可直接 `JSON.stringify(day)`。节日标签不是官方放假安排。
`hours` 包含十二时辰的黄黑道信息；查询某一时刻的时柱与时飞星需传 `hour`。

## 九宫飞星

每张盘是 9 个星数的数组，顺序与 `PALACE_DIRECTIONS` 一致：

| 东南 `[0]` | 正南 `[1]` | 西南 `[2]` |
| --- | --- | --- |
| 正东 `[3]` | 中宫 `[4]` | 正西 `[5]` |
| 东北 `[6]` | 正北 `[7]` | 西北 `[8]` |

```js
import { createFlyingStarBoard, getThreeCyclesNinePeriods, PALACE_DIRECTIONS } from 'huangli-lite';

const board = createFlyingStarBoard(5, true);
console.log(PALACE_DIRECTIONS.map((direction, i) => [direction, board[i]]));
console.log(getThreeCyclesNinePeriods(2026));
```

`createFlyingStarBoard(centerNumber, forward = true)` 接受 1～9 的入中星数。
年/月盘顺飞；日/时盘按冬至后顺飞、夏至后逆飞，方向见 `flyingStars.forward`。
日盘的 `consecutive` 使用最近甲子日锚点，`discontinuous` 直接使用至日锚点；
两种算法分别由该选项选择。
至日归属还受子时规则和全天/瞬时选项影响。

`flyingStarBoundary: 'solar'` 时，年/月盘与年/月柱使用相同节令边界；
`lunar` 时使用规则农历年、月。该选项不改变日/时盘的至日判定。
`cycle/period` 按查询的公历年份计算，与年/月盘的节令年界分别处理。
当前不提供山盘、向盘或排龙诀。

## 纯规则入口与显示筛选

`huangli-lite/rules` 的模块依赖图不引入天文核心，可供已有历法输入的应用使用。
包本身仍声明天文核心依赖；按日期查询使用主入口。

```js
import { evaluateAlmanacRules, ACTIVITY_MASKS } from 'huangli-lite/rules';

const result = evaluateAlmanacRules({
  monthBranch: 2, dayIndex: 0, yearIndex: 42,
  lunarMonth: 1, lunarDay: 1, mansion: '角',
  nextSolarTermIndex: 3,
  activityMask: ACTIVITY_MASKS.civilian37,
});
console.log(result.officer, result.suitableActivities, result.tabooActivities);
```

索引约定：`monthBranch` 为 0=子至 11=亥，`dayIndex/yearIndex` 为 0=甲子至 59=癸亥，
与核心库交换干支时，需先将压缩值转换为六十甲子索引。`nextSolarTermIndex` 为 0=小寒、1=大寒至 23=冬至，
与核心库 0=春分的节气索引不同。`lunarMonth` 为 1～13，`lunarDay` 为 1～30。
`mansion` 接受廿八宿简称或全名。

可选 `seasonIndex` 为 0～3（春夏秋冬），省略按月支推导；
`monthSeasonTypeIndex` 为 0～2，默认按公式 `(monthBranch - 3) mod 3`。
`isSiJue/isSiLi/isTuWangYongShi/isPhaseOfMoon` 默认 false，`isYeargodDuty` 默认 true。

`activityMask` 接受事项 ID 数组。内置 `civilian37`、`imperial67`、
`tongshu60`、`cnlunarLegacy38` 四套，空数组隐藏全部事项。筛选只影响宜忌输出，
不参与神煞或冲突裁决；省略掩码可以得到完整输出。
目录可从 `ALMANAC_GODS` 和 `ALMANAC_ACTIVITIES` 读取。

要复核日期入口，可将结果的 `ruleInput` 原样交给 `evaluateAlmanacRules()`；
移除其中的 `activityMask` 可查看未筛选事项。
同优先级事项按 ID 稳定排序。

规则与数据来源见[第三方声明](../THIRD_PARTY_NOTICES.md)。

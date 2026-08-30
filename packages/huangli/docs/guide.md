# 黄历使用指南

[返回首页](../README.md)。以下示例适用于 npm beta 包和仓库 workspace。

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
| `locale` | `zh-Hans` | 展示文字；可选繁体中文 `zh-Hant` |
| `utcOffsetMinutes` | `480` | 固定钟表时区，整数分钟，范围 `-840..840` |
| `mode` | `china-astronomical` | 现代中国天文历法；另选 `historical` 或 `local-astronomical` |
| `eventAccuracy` | `mid` | 此实例的定朔定气档位；可选 `fast`、`mid`、`accurate` |
| `ratHourMode` | `next-day` | 23:00 换入次日；另外两种约定见下文 |
| `exactJieQiTime` | `false` | 年月柱按交节日切换；`true` 按天文瞬时切换 |
| `flyingStarMethod` | `consecutive` | 日飞星以距至日最近的甲子日为锚点 |
| `flyingStarBoundary` | `solar` | 年/月飞星按节令；可选 `lunar` |
| `isYeargodDuty` | `true` | 传入宜忌引擎的岁神规则选项 |
| `tuWangMethod` | `four-seasons-18-days` | 四立前十八日自动判定；`manual` 仅使用调用者标记 |
| `festivalMode` | `common` | 常用节日、民俗及重要纪念日；`major` 仅主要节日，`all` 返回完整寿星节日表 |

单日选项为 `hour`（默认 12）、`minute`（0）、`second`（0，允许小数秒）、
`isTuWangYongShi`（省略时按配置计算）和 `activityMask`（省略表示所有事项）。
传入 `isTuWangYongShi: true/false` 可覆盖本次查询的自动结果。

黄历入口只使用固定钟表时区，不接受经度或太阳时设置，不自动处理夏令时。
`local-astronomical` 按该固定时区重新排布农历；中国天文模式仍使用中国农历结构。
历史模式始终使用中国历表归日，忽略 `exactJieQiTime` 设置。

## 简体与繁体输出

`locale: 'zh-Hant'` 会转换日期结果中面向用户展示的节日、节气、神煞、宜忌、
建除、黄黑道、纳音、廿八宿、彭祖百忌、胎神和方位等文字。默认 `zh-Hans`
保持原有简体输出。英文 key、数字 ID、`ruleInput`、日期与计算设置枚举不会转换，
因此同一天的简繁结果可以依靠 ID 稳定对照。

```js
import { HuangliCalendar, HUANGLI_LOCALE } from 'huangli-lite';

const calendar = new HuangliCalendar({ locale: HUANGLI_LOCALE.TRADITIONAL });
const day = calendar.getDay(2026, 8, 29);
console.log(day.auspiciousGods, day.suitableActivities, day.godDirections);
```

纯规则入口使用第二个参数 `evaluateAlmanacRules(input, { locale: 'zh-Hant' })`。
神煞和事项目录可通过 `getAlmanacGodCatalog(locale)`、
`getAlmanacActivityCatalog(locale)` 取得；`ALMANAC_GODS` 和
`ALMANAC_ACTIVITIES` 常量继续作为简体规范目录。飞星方位可使用
`getPalaceDirections(locale)`，排龙输出可传入第三个 `{ locale }` 参数。

## 土王用事

土王用事指传统五行规则中土气当令的时段。本包采用四立前各十八日：
立春、立夏、立秋、立冬的归日为结束日，向前取十八个连续历日，包含起始日，
不包含四立当日。规则依据见《协纪辨方书》[五行](https://www.shidianguji.com/book/SK1619/chapter/1l9llosnxbyg2)。

```js
import { HuangliCalendar } from 'huangli-lite';

const calendar = new HuangliCalendar();
const periods = calendar.getTuWangPeriods(2026);
const day = calendar.getDay(2026, 1, 20);
console.log(periods, day.flags.isTuWangYongShi, day.tuWangYongShi);

const custom = calendar.getDay(2026, 1, 20, { isTuWangYongShi: false });
console.log(custom.tuWangYongShi.source); // override
```

`getTuWangPeriods(year)` 返回该年四立对应的四段日期，字段为 `seasonStart`、
`startDate` 和 `endDateExclusive`。日结果中的 `tuWangYongShi` 另含 `active` 与
`source`，后者为 `calendar`（自动）、`override`（本次覆盖）或 `manual`（手动模式）。
日结果中的日期范围始终描述规则日之后的下一次四立，`active` 表示当前是否命中。

自动判定使用 `ruleDate`，因此 `next-day` 模式在 23:00 使用次日；
现代模式按指定时区的天象归日，历史模式按中国历表归日。
这是按历日定义的十八日区间，不受 `exactJieQiTime` 影响。
设 `tuWangMethod: 'manual'` 可关闭自动判定；此时未传入单日覆盖值就按 false 处理。
该设置只影响日期入口，纯规则入口仍使用调用者提供的布尔标记。

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
`solarTerm.time` 和 `moonPhases[].time` 是不带时区的 `JulianTime`，可调用 `.toZonedTime(480)`。
`solarTerm` 另给当地钟表与归日，历史归日不一定等于天象日。序列化为 JSON 后，时间为三个数值字段。
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
| `dutyGod`, `hours` | 日黄黑道及子至亥十二时辰的干支、纳音、时段和黄黑道 |
| `mansion`, `pengZu`, `taiShen`, `godDirections`, `chongSha` | 廿八宿、彭祖百忌、胎神、方位与冲煞 |
| `solarTerm`, `moonPhases`, `festivals` | 当日节气、月相和整理后的节日名称 |
| `festivalDetails` | 节日正式名、月历短名、内容级别、月格显示级别、计算来源、公休标记与别名 |
| `tuWangYongShi` | 土王用事的区间、判定值与来源 |
| `flyingStars`, `cycle`, `period`, `settings` | 飞星盘、三元九运及解析后的设置 |

日结果可直接 `JSON.stringify(day)`；其中的 `JulianTime` 自动序列化为时间数值字段。
节日标签不是官方放假安排。
查询某一时刻的时柱与时飞星可传 `hour`；完整时辰表见下文。

## 节日名称与层级

节日数据源自寿星天文历原版节日表，包括固定公历、
固定农历、星期规则、除夕，以及数九、三伏、入梅和出梅。农历节日不在闰月重复；
带起止年份的纪念日会按查询年份过滤。二十四节气仍由 `solarTerm` 返回，清明同时标为节日。

`festivalMode` 有三档：

| 值 | 内容 |
| --- | --- |
| `major` | 法定、主要传统和流行节日，以及重要历史纪念日 |
| `common` | 默认；在 `major` 基础上加入民俗、民族节日和与国内用户关联较强的国际纪念日 |
| `all` | 完整来源表，包括较冷门的国际纪念日和数九、三伏的逐日标记 |

`festivals` 是正式名称数组，与 `festivalDetails.map(f => f.name)` 顺序一致。
月历等紧凑界面应只显示 `calendarDisplay` 为 `primary` 或 `secondary` 的记录，并读取
`shortName`；`detail` 记录保留在当日详情中。这一显示级别沿用寿星万年历的 A/B/C
密度，与 `level` 表示的节日内容类别相互独立。

```js
const day = calendar.getDay(2026, 8, 1);
console.log(day.festivals); // ['中国人民解放军建军纪念日']
console.log(day.festivalDetails[0]);
// {
//   name: '中国人民解放军建军纪念日',
//   shortName: '建军节',
//   level: 'historical', calendarDisplay: 'secondary', source: 'solar',
//   isPublicHoliday: false, aliases: ['建军节']
// }
```

| `level` | 内容 |
| --- | --- |
| `statutory` | 来源表标记的法定或公休节日 |
| `traditional` | 传统与民俗节日，以及数九、三伏首日 |
| `popular` | 社会、行业和流行节日 |
| `commemorative` | 科普、公共议题及国际纪念日 |
| `historical` | 历史事件与纪念日 |
| `ethnic` | 少数民族节日与地方民俗 |

`source` 为 `solar`、`lunar`、`weekBased`、`termBased` 或 `custom`。
`aliases` 保存来源表名称和常用异名；例如国家公祭日保留“南京大屠杀纪念日”，
世界图书和版权日保留“世界读书日”。`isPublicHoliday` 只复现来源表标记，
不提供某一年度的放假、调休或补班安排。
来源表中固定写在 10 月 2、3 日的“国庆节假日”属于旧式放假模板，导入时不作为
永久节日保留；年度假期应由独立的年份数据提供。

杨公忌属于择日禁忌，不在任一节日模式中；节日筛选不改变宜忌、干支或飞星结果。
来源与名称依据见[第三方声明](../THIRD_PARTY_NOTICES.md)。

## 十二时辰与当天时间表

`day.hours` 按子、丑至亥排列，共十二项，以当前 `ruleDate` 的日干支起五鼠遁。
每项包含 `branch/branchName`、`dayPillar`、`pillar/pillarName`、`nayinId/nayin/nayinElement`、
`startHour/endHour/timeRange`。`index/name/isHuangDao` 表示值神及黄黑道。
子时的钟表范围为 `23:00 - 01:00`；该十二项表用于展示同一日干支下的时辰规则。

需要按民用日期显示从 00:00 到 24:00 的实际时段时，使用 `getHours()`：

```js
import { HuangliCalendar } from 'huangli-lite';

const calendar = new HuangliCalendar({ ratHourMode: 'next-day' });
const hours = calendar.getHours(2026, 2, 16);
for (const hour of hours) {
  console.log(hour.segment, hour.timeRange, hour.pillarName, hour.nayin, hour.name);
}
```

返回十三段：早子 `00:00–01:00`、丑至亥、晚子 `23:00–24:00`。
`segment` 分别为 `early-zi`、`hour` 和 `late-zi`。
日柱与时干遵循所选子时规则，晚子不复用早子的干支。
各段包含 `startTime/endTime`、`startJdUT1/endJdUT1`，结束时刻不包含在区间内；
最后一段的 `endHour` 为 24，`endTime` 为下一民用日 00:00。

`flyingStars` 与 `forward` 是该段**起点时刻**的时飞星盘与飞行方向。
精确交节可能发生在段内；若需要段内其他时刻的完整结果，使用 `getDay()` 并传入时分秒。
1582 年改历处的下一日按历法连续推进，从 10 月 4 日接到 10 月 15 日。

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
运盘、山盘、向盘、二十四山和排龙诀见[山向盘与排龙](./feng-shui.md)。

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
}, { locale: 'zh-Hant' });
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

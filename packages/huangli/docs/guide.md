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
| `tuWangMethod` | `four-seasons-18-days` | 四立前十八日自动判定；`manual` 仅使用调用者标记 |
| `festivalMode` | `common` | 常见节日与纪念日；`all` 包含扩展的宗教、人物、地方及国际纪念日 |

单日选项为 `hour`（默认 12）、`minute`（0）、`second`（0，允许小数秒）、
`isTuWangYongShi`（省略时按配置计算）和 `activityMask`（省略表示所有事项）。
传入 `isTuWangYongShi: true/false` 可覆盖本次查询的自动结果。

黄历入口只使用固定钟表时区，不接受经度或太阳时设置，不自动处理夏令时。
`local-astronomical` 按该固定时区重新排布农历；中国天文模式仍使用中国农历结构。
历史模式始终使用中国历表归日，忽略 `exactJieQiTime` 设置。

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
| `dutyGod`, `hours` | 日黄黑道及子至亥十二时辰的干支、纳音、时段和黄黑道 |
| `mansion`, `pengZu`, `taiShen`, `godDirections`, `chongSha` | 廿八宿、彭祖百忌、胎神、方位与冲煞 |
| `solarTerm`, `moonPhases`, `festivals` | 当日节气、月相和整理后的节日名称 |
| `festivalDetails` | 节日名称、分类、别名与来源表中的原始名称 |
| `tuWangYongShi` | 土王用事的区间、判定值与来源 |
| `flyingStars`, `cycle`, `period`, `settings` | 飞星盘、三元九运及解析后的设置 |

结果都是普通数据，可直接 `JSON.stringify(day)`。节日标签不是官方放假安排。
查询某一时刻的时柱与时飞星可传 `hour`；完整时辰表见下文。

## 节日名称与分类

`festivals` 是去重后的名称数组，与 `festivalDetails.map(f => f.name)` 顺序一致。
两者都受 `festivalMode` 控制，默认 `common`，返回以下 40 个名称中当日匹配的条目：

| 内容 | 名称 |
| --- | --- |
| 节假日 | 元旦、春节、清明节、劳动节、端午节、中秋节、国庆节 |
| 其他传统节日 | 除夕、元宵节、龙抬头、三月三、七夕节、中元节、重阳节、寒衣节、下元节、腊八节、小年 |
| 常用公共节日 | 妇女节、青年节、儿童节、中国人民解放军建军纪念日、植树节、教师节 |
| 社会习俗节日 | 情人节、愚人节、母亲节、父亲节、感恩节、平安夜、圣诞节 |
| 常用纪念日 | 中国共产党诞生日、香港回归纪念日、七七抗战纪念日、中国人民抗日战争胜利纪念日、九一八纪念日、南京大屠杀死难者国家公祭日 |
| 常用国际日 | 国际消费者权益日、世界图书和版权日、世界环境日 |

这是一份用于日常日历的显示选集，不是完整的法定节假日或国际纪念日目录。
节日标签只标识节日日期，不展开其法定假期。冬至等节气仍通过 `solarTerm` 返回。

```js
const day = calendar.getDay(2026, 8, 19);
console.log(day.festivals); // ['七夕节']

const extended = new HuangliCalendar({ festivalMode: 'all' });
const fullDay = extended.getDay(2026, 8, 19);
console.log(fullDay.festivals); // ['七夕节', '魁星诞']

const traditional = fullDay.festivalDetails
  .filter(f => f.category === 'traditional')
  .map(f => f.name);
console.log(traditional); // ['七夕节']
console.log(day.festivalDetails[0]);
// {
//   name: '七夕节', category: 'traditional',
//   aliases: ['七夕'], sourceNames: ['七夕-魁星诞']
// }
```

| `category` | 内容 |
| --- | --- |
| `traditional` | 传统节日，如春节、龙抬头、七夕节 |
| `civic` | 国内公共节日、行业节日与宣传日，如元旦、教师节、全国爱眼日 |
| `international` | 国际纪念日与宣传日，如世界图书和版权日 |
| `popular` | 社会习俗节日，如母亲节、情人节、圣诞节 |
| `religious` | 神佛诞辰与宗教纪念日 |
| `historical` | 历史事件、组织及人物纪念日 |
| `local` | 地方纪念日，如上海解放日 |

`all` 保留扩展节日的分类与名称，可按 `category` 进一步筛选。
杨公忌属于择日禁忌，不在任一模式的节日列表中；其规则仍由宜忌引擎计算，
命中结果可在 `godIds`、`inauspiciousGods` 中读取。节日筛选不改变宜忌、干支或飞星结果。

`aliases` 保存同一节日的其他名称，`sourceNames` 保存导入表中的原始标签。
例如“七夕-魁星诞”拆成两项后，两项都有这个来源标签，但不会将它作为各自的别名。
名称使用“元旦”“劳动节”“妇女节”“青年节”“儿童节”等规范写法；
“中国人民解放军建军纪念日”保留“建军节”作为别名。
二月二使用“龙抬头”，“春龙节”为别名。
按名称匹配旧结果的调用方需更新名称，或同时检查 `aliases`。

农历节日不在闰月重复；除夕按腊月实际末日匹配，清明节按所选历法模式的清明归日匹配。
母亲节、父亲节、感恩节按各自的星期规则计算。
小年沿用农历腊月二十三的标注，尚未提供南北习俗切换。
世界图书和版权日为 4 月 23 日，“世界读书日”为其别名，不在 5 月 23 日重复列出。

分类仅用于内容筛选，不表示法定放假资格，也不表示每条旧数据均已独立核实。
表中仍包含沿用的民俗名称及纪念日；没有设立年份和历年名称版本，
查询历史日期时不保证当时已有该节日或名称。接口不提供年度放假、补班安排。
来源与名称依据见[第三方声明](../THIRD_PARTY_NOTICES.md)。

## 十二时辰与当天时间表

`day.hours` 按子、丑至亥排列，共十二项，以当前 `ruleDate` 的日干支起五鼠遁。
每项包含 `branch/branchName`、`dayPillar`、`pillar/pillarName`、`nayinId/nayin/nayinElement`、
`startHour/endHour/timeRange`。原有 `index/name/isHuangDao` 仍表示值神及黄黑道。
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

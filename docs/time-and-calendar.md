# 时间、太阳时、干支与农历

[返回首页](../README.md) · [精度与适用范围](./accuracy.md)

## 时间约定

星历与事件求根输入使用 TT 的 Julian Day；历法查询和地平观测使用 UT1。事件时间由 `JulianTime` 表示，包含 `jdTT`、估算的 `jdUT1` 和 `deltaTSeconds`。

lite 时间层约定 `UTC ≈ UT1`，不携带闰秒、TAI 或 EOP 表；TT 仍通过 `TT = UT1 + ΔT` 单独计算。`JulianTime` 保存 `jdUT1`、`jdTT` 和 `deltaTSeconds`，`ZonedTime` 表示强制带 `offsetMinutes` 的民用时间。`JulianTime.fromDate()` 只读取原生 `Date.getTime()`，不会拆分或重新解释原生 Date 的年月日。历法查询可直接接收 `JulianTime`。事件的 `time` 是不带时区的 `JulianTime`；需要民用钟表时调用 `event.time.toZonedTime(offsetMinutes)`。

民用日期从 1582-10-15 起用格里历，之前用儒略历；1582-10-05 至 14 为缺日。
天文年号 0 表示公元前 1 年。固定时区不会自动处理夏令时。

```js
import { JulianTime, ZonedTime } from 'js-ephemeris-lite';

const now = JulianTime.fromDate(new Date());
const clock = new ZonedTime({
  year: 2026, month: 8, day: 27, hour: 12, offsetMinutes: 480,
});
console.log(now.jdTT, clock.toJulianTime().jdUT1);
console.log(now.toZonedTime(480));
```

### 事件时间与时区

`JulianTime` 表示物理瞬间，不保存时区；`ZonedTime` 表示该瞬间在某个固定偏移下的钟表读数。
改变显示时区不会改变事件发生的时刻，也不自动改变历法规定的归日。

| 接口 | 时间返回 |
| --- | --- |
| `solarLongitudeTimeFast/Accurate`、`lunarPhaseTimeFast/Accurate` | TT JD 数值 |
| `solveSolarLongitude`、`solveLunarPhase`、`solveNewMoon` | `JulianTime` |
| 节气、新月、气朔年表和天象搜索事件 | `event.time: JulianTime` |
| 农历月份的天文新月 | `month.newMoon: JulianTime` |
| 太阳专用日出日落 | `rise/set: JulianTime \| null` |
| 通用天体升落和中天 | `rises/sets/upperTransits/lowerTransits: JulianTime[]` |

```js
import { getSpecificSolarTerm, JulianTime } from 'js-ephemeris-lite';

const summer = getSpecificSolarTerm(2026, 6);
console.log(summer.time.jdTT);
console.log(summer.time.toZonedTime(480));
console.log(summer.time.toZonedTime(0));

// JSON 保留 TT、UT1、ΔT；恢复后可继续调用时间转换方法。
const restored = new JulianTime(JSON.parse(JSON.stringify(summer.time)));
console.log(restored.toZonedTime(480));
```

`solve…` 直接返回时间对象，可读取 `.jdTT/.jdUT1` 或调用时间转换方法。
底层通用数学搜索 `searchCrossings/searchAngleCrossings` 不绑定天文时标，返回 `{ time: number }` 数组。

## 农历转换

默认 `mode: 'historical'`、`utcOffsetMinutes: 480`。
需要现代天文归日时请显式选 `china-astronomical`。

```js
import { solarToLunar, lunarToSolar, instantToLunar, JulianTime } from 'js-ephemeris-lite';

const options = { mode: 'china-astronomical', utcOffsetMinutes: 480 };
const lunar = solarToLunar({ year: 2025, month: 1, day: 29 }, options);
const solar = lunarToSolar({ year: 2033, month: 11, day: 1, isLeap: true }, options);
console.log(lunar, solar, instantToLunar(JulianTime.fromDate(new Date()), options));
```

`js-ephemeris-lite/chinese-calendar` 提供以下接口，主入口也导出这些函数：

- `calculateChineseCalendarYear(jdUT1)`：生成从前一冬至开始的 25 个节气、15 个朔和 14 个月；
- `findSolarTerm(jdUT1, { direction, filter })`：搜索前后节气，`filter` 可取 `any`、`jie` 或 `qi`；同时提供 `getPreviousJie()` 等便捷函数；
- `getSpecificSolarTerm(year, index)`：按 `0=春分、18=冬至` 直接查询；
- `solarToLunar()`、`lunarToSolar()`、`instantToLunar()` 和 `getLunarMonthDays()`；
- `historical`、`china-astronomical`、`local-astronomical` 三种历法结构/历史规则模式；
- `fixed-utc-offset`（按钟表时区划日）与 `mean-solar-meridian`（按指定经度的平太阳日界划日）两种显式日界模式。

农历结构由 `CALENDAR_MODE` 选择。使用 `LOCAL_ASTRONOMICAL` 时，
通过 `CALENDAR_DAY_BOUNDARY_MODE` 指定固定时区日界或经度日界。
`RAT_HOUR_MODE` 单独控制晚子时的日柱与时干。
八字包的 `BaziOptions.clockMode` 可选择民用时、平太阳时或真太阳时。

例如越南现行钟表日界应写成 UTC+7；105°E 只是与 UTC+7 等价的标准经线。若要按出生地实际经度（例如河内约 105.8°E）的平太阳日界排历，则应显式选择经度模式：

```js
import { CALENDAR_MODE, CALENDAR_DAY_BOUNDARY_MODE } from 'js-ephemeris-lite';

const vietnamClock = {
  mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
  dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET,
  utcOffsetMinutes: 420,
};

const customMeridian = {
  mode: CALENDAR_MODE.LOCAL_ASTRONOMICAL,
  dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN,
  utcOffsetMinutes: 420, // 仍用于输入、输出钟表时间
  meridianDeg: 105.8,   // 只用于朔气归日和农历结构
};
```


## 全年节气与月相

`getQiShuoYear(civilYear, options)` 按固定时区的民用年汇总节气、七十二候和指定月相角的事件。
默认返回节气与朔；`lunarPhaseAnglesDeg: [0, 90, 180, 270]` 加入四个主要月相，
`includePentads: true` 加入七十二候。事件按发生时刻落入民用年来收集；事件数量并非固定值。

| 事件字段 | 含义 |
| --- | --- |
| `kind`、`name`、`index` | 事件类型、名称与目标角度编号；`index` 不是唯一事件 ID |
| `time` | `JulianTime`，提供 TT、UT1 和 ΔT |
| `localTime`、`localDate` | 指定固定时区的钟表读数和日期 |
| `assignedDate` | 所选历法模式规定的归日 |
| `assignmentDiffersFromLocalDate` | 归日是否与当地天象日期不同 |

主入口及 `js-ephemeris-lite/qi-shuo` 均导出此接口。

```js
import { getQiShuoYear, CALENDAR_MODE, CALENDAR_DAY_BOUNDARY_MODE } from 'js-ephemeris-lite';

const qishuo = getQiShuoYear(2026, {
  utcOffsetMinutes: 480,
  mode: CALENDAR_MODE.HISTORICAL,
  dayBoundaryMode: CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET,
  includeSolarTerms: true,
  includePentads: false,
  lunarPhaseAnglesDeg: [0, 90, 180, 270],
});
console.log(qishuo.events);
```


## 求单次天文事件

```js
import { solveSolarLongitude, solveNewMoon } from 'js-ephemeris-lite';

const equinox = solveSolarLongitude(0, 2451623.0);
const newMoon = solveNewMoon(2451550.0);
console.log(equinox.jdTT, newMoon.jdUT1);
```

目标太阳黄经使用弧度，邻近时刻 `nearJdTT` 使用 JD(TT)，用于选择目标事件所在周期。
`solveLunarPhase(targetElongation, nearJdTT)` 可求任意月相角，0、π/2、π、3π/2
分别表示朔、上弦、望、下弦。视位置搜索接口使用 degree，两组接口的角度单位不同。
求根容差与天文精度的区别见[精度说明](./accuracy.md)。

### 定朔定气档位：fast / mid / accurate

`solveSolarLongitude / solveLunarPhase / solveNewMoon` 按单次选项路由，省略时默认 `mid`。
中国历法及八字、黄历等上层功能通过各自的 `eventAccuracy` 查询或实例选项选择档位。

| 档位 | 算法 |
| --- | --- |
| `fast` | 固定阶段快速修正；最终太阳／月球主黄经使用完整级数，不承诺求根容差 |
| `mid` | 专用定气定朔模型，按数值容差迭代；默认档位 |
| `accurate` | 完整库内视位置模型，按数值容差迭代 |

```js
import { solveNewMoon, calculateChineseCalendarYear } from 'js-ephemeris-lite';

const quick = solveNewMoon(2461212, { accuracy: 'fast' });
const precise = solveNewMoon(2461212, { accuracy: 'accurate', toleranceSeconds: 0.01 });
const calendar = calculateChineseCalendarYear(2461212, { eventAccuracy: 'fast' });
```

精度选项属于本次调用或上层对象，不会改变其他求解器、日历实例或并发请求。
它不会改写通用星体坐标或视位置的默认档位；这些接口需要在自己的调用中选择
`accuracy`。真太阳时等其他算法也不会被事件档位全局改写。

三档的 `solve…` 都直接返回 `JulianTime`，它实现共享结构类型 `AstroTime`：
`{ jdTT, jdUT1, deltaTSeconds }`。
可直接调用 `solveNewMoon(jdTT).toZonedTime(480)`。
Fast 不接受显式 `toleranceSeconds` 或
`solver: 'safeguarded'`，否则抛错。Mid/Accurate 支持这两个选项，但数值容差不等于绝对星历误差。
自定义 `moonLatitudeTerms` 仅限 Mid；Fast 固定为 10，Accurate 固定为 `'full'`。

Mid/Accurate 的 `solver` 默认 `auto`，也可选择带区间保护的 `safeguarded`。
求解失败或选项组合不受支持时抛出异常。

### 按累计角度求时刻：固定 Fast 与 Accurate

需要通过累计角度指定事件时，可使用以下四个函数。
它们接收未取模的角度（弧度），返回 **TT 儒略日数值**：

| 接口 | 计算路线 |
| --- | --- |
| `solarLongitudeTimeFast` | 固定阶段定气：最终地球黄经使用完整级数，采用简化光行差 |
| `lunarPhaseTimeFast` | 固定阶段定相：最终月球黄经使用完整级数，采用简化月球光行时修正 |
| `solarLongitudeTimeAccurate` | 对完整库内太阳视黄经迭代求根 |
| `lunarPhaseTimeAccurate` | 月、日分别走完整库内视位置链，再求视黄经差的根 |

```js
import {
  solarLongitudeTimeFast, lunarPhaseTimeFast,
  solarLongitudeTimeAccurate, lunarPhaseTimeAccurate,
} from 'js-ephemeris-lite';

const longitude = 27 * 2 * Math.PI + Math.PI / 2; // 2026 夏至
console.log(solarLongitudeTimeFast(longitude));
console.log(solarLongitudeTimeAccurate(longitude, { toleranceSeconds: 0.01 }));
console.log(lunarPhaseTimeFast(0), lunarPhaseTimeAccurate(0)); // J2000 后第一个朔
```

累计角度的整圈数指定哪一年的节气或哪一次月相，不能先取模后再表达任意年份。
月日黄经差 `2πk` 表示朔，加上 `π/2`、`π`、`3π/2` 可指定其他月相。
如需 UT1 或固定时区钟表，可将结果传给 `JulianTime.fromTT(jdTT)`。
非有限角度或计算过程超出 `J2000 ± 2922000` 日会抛错。

Fast 不接受数值容差，也不保证所有日期取整到分钟后与 Accurate 相同。
需要更严格的事件模型时，显式调用 Accurate；Fast 不会自动切换档位。
Accurate 使用完整库内视位置，`toleranceSeconds` 默认 `0.01` 秒。
该容差仅控制数值求根，无法达到时会抛错；模型限制见[精度说明](./accuracy.md)。

带 `Fast`、`Accurate` 后缀的标量接口固定使用名称所示档位。

## 地方平太阳时与真太阳时

```js
import {
  CALENDAR_MODE,
  RAT_HOUR_MODE,
  ZonedTime,
  calculateFourPillars,
  equationOfTime,
  meanSolarTime,
  trueSolarTime,
} from 'js-ephemeris-lite';

const civilClock = new ZonedTime({
  year: 2000, month: 1, day: 1,
  hour: 23, minute: 10, second: 0,
  offsetMinutes: 480,
});
const instant = civilClock.toJulianTime();

const meanClock = meanSolarTime(civilClock, 116.4);
const trueClock = trueSolarTime(civilClock, 116.4);
console.log(equationOfTime(instant).equationSeconds);
console.log(meanClock, trueClock);
console.log(trueClock.sourceClock.offsetMinutes); // 原民用钟仍为 UTC+08

const pillars = calculateFourPillars(trueClock.instant, trueClock, {
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  ratHourMode: RAT_HOUR_MODE.NEXT_DAY,
});
```

经度采用东正西负 degree。`LMT = UT1 + longitude / 360°`，
`LAT = LMT + equationOfTime`；`trueSolarTime()` 返回地方视太阳时。
均时差由地心视太阳赤经和格林尼治视恒星时（GAST）计算。

`SolarClock` 表示日柱、时柱计算所用的**太阳钟面**；对应物理瞬时由 `instant` 保存。
该类型不提供 `offsetMinutes`、`toDate()` 或 `toJulianTime()`。传入 `ZonedTime` 时，原民用钟及其 offset 完整保存在 `sourceClock`；传数值 JD 或 `JulianTime` 时，因为没有来源时区，`sourceClock` 为 `null`。经度差和均时差修正使用完整 Julian Day，因此结果跨过午夜时，年月日会自然落到前一天或后一天。调用 `calculateFourPillars()` 时用 `solarClock.instant` 判定立春和节令，用 `SolarClock` 自身判定日柱和时柱。

底层另提供 `localMeanToApparentSolarTime()` 与 `localApparentToMeanSolarTime()`，输入输出都是虚拟太阳钟的数值 JD；后者通过迭代求解逆变换。

## 干支历与四柱

普通固定时区墙钟可直接调用 `fourPillarsForZonedTime()`：

```js
import {
  CALENDAR_MODE,
  PILLAR_HISTORICAL_MODE,
  RAT_HOUR_MODE,
  ZonedTime,
  describeFourPillars,
  fourPillarsForZonedTime,
} from 'js-ephemeris-lite';

const clock = new ZonedTime({
  year: 2000, month: 1, day: 1,
  hour: 23, minute: 30, second: 0,
  offsetMinutes: 480,
});

const packed = fourPillarsForZonedTime(clock, {
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  ratHourMode: RAT_HOUR_MODE.CURRENT_DAY_TOMORROW_STEM,
  pillarHistoricalMode: PILLAR_HISTORICAL_MODE.FOLLOW_CALENDAR,
});

console.log(packed);                        // 年月日时：压缩数值干支
console.log(describeFourPillars(packed));   // { year: '己卯', ... }
```

年柱以立春为界，月柱以十二节为界，日柱按民用日，时柱使用五鼠遁；另导出 `calculateDayPillar()`、`getMonthGanzhi()`、`getHourGanzhi()`、`ganzhiName()`、`getNayinId()` 和 `getNayinElement()` 等底层函数。

`RAT_HOUR_MODE` 只决定 23:00～00:00 的日柱/时干规则：`NEXT_DAY` 在 23:00 整体换入次日，`CURRENT_DAY` 的日柱和时干都沿用当天，`CURRENT_DAY_TOMORROW_STEM` 保留当天日柱但按次日五鼠遁取时干。它不会改变农历月份。`PILLAR_HISTORICAL_MODE` 决定年月柱节界是否采用历史分配日；历史分配日固定为 UTC+08 的中国历日，不能随本地时区平移。

需要真太阳时或平太阳时时，调用 `calculateFourPillars(instant, virtualTime, options)`：`instant` 用于判断立春与节令边界，`virtualTime` 中的当地太阳钟字段用于计算日柱与时柱。

历史月份名、纪年及归日表见[历史历法](./calendar-history.md)。

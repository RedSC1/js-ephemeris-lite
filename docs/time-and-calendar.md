# 时间、太阳时、干支与农历

[返回首页](../README.md)。本页示例对应当前源码。

## 时间约定

星历与事件求根输入都是 TT 的 Julian Day；事件结果同时给出 `jdTT`、估算的 `jdUT1` 和 `deltaTSeconds`。

lite 时间层约定 `UTC ≈ UT1`，不携带闰秒、TAI 或 EOP 表；TT 仍通过 `TT = UT1 + ΔT` 单独计算。`JulianTime` 保存 `jdUT1`、`jdTT` 和 `deltaTSeconds`，`ZonedTime` 表示强制带 `offsetMinutes` 的民用时间。`JulianTime.fromDate()` 只读取原生 `Date.getTime()`，不会拆分或重新解释原生 Date 的年月日。历法查询可直接接收 `JulianTime`，事件结果也附带 `event.time`，原有数值 JD 字段继续保留。

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

`src/chinese-calendar.js` 提供：

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

`src/qi-shuo.js` 的 `getQiShuoYear(civilYear, options)` 按固定时区的民用年汇总二十四节气、七十二候和任意月相角。默认返回节气与朔；可用 `lunarPhaseAnglesDeg: [0, 90, 180, 270]` 加入朔、上弦、望和下弦，或用 `includePentads: true` 加入七十二候。每个事件同时返回精确 `jdTT` / `jdUT1`、当地钟表时间、ΔT、求根诊断和历法归日；历史模式会保留历书归日与真实天象日的差异。

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

目标太阳黄经使用弧度，初值使用 JD(TT)。新视位置搜索接口使用 degree，
不要混用角度单位。求解器选择和采样精度见[精度说明](./accuracy.md)。

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

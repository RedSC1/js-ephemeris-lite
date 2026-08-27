# js-ephemeris-lite

用于浏览器和 Node.js 的天文与中国历法库。提供天体位置、节气与月相、
农历转换、干支和太阳时计算，采用纯 JavaScript 实现，附带 TypeScript 类型声明，
无运行时依赖。

## 安装

需要 Node.js 18 或更高版本；浏览器项目可通过支持 ES modules 的构建工具使用。

```sh
npm install js-ephemeris-lite
```

本文档对应当前源码。标注“开发中”的接口尚未发布到 npm；
使用已安装版本时，请以该版本随包文档为准。当前 API 为 0.x，1.0 前可能调整。

## 快速开始

将公历日期转换为农历，或生成一年的节气和月相表：

```js
import { solarToLunar, lunarToSolar, getQiShuoYear } from 'js-ephemeris-lite';

const options = { mode: 'china-astronomical', utcOffsetMinutes: 480 };

const lunar = solarToLunar({ year: 2025, month: 1, day: 29 }, options);
console.log(lunar.month, lunar.day); // 1 1

const solar = lunarToSolar({
  year: 2033, month: 11, day: 1, isLeap: true,
}, options);
console.log(solar);

const year = getQiShuoYear(2026, {
  ...options,
  lunarPhaseAnglesDeg: [0, 90, 180, 270],
});
console.log(year.events); // 节气、朔、上弦、望、下弦
```

需要单独求某次事件时，可用 `solveSolarLongitude(targetRadians, nearJdTT)`
或 `solveNewMoon(nearJdTT)`。完整示例见[历法与时间指南](./docs/time-and-calendar.md)。

## 功能

- 太阳、月球及水星至海王星的位置与速度，提供日心、地心及地月质心接口。
- 二十四节气、七十二候、朔与指定月相求解。
- 阴阳历互转、闰月，以及中国历史历法和历史纪年查询。
- 年月日时干支、三种晚子时规则、地方平太阳时与真太阳时。
- 太阳高度、日出日落及极昼极夜判断。

开发中的[视位置与天象搜索](./docs/sky-events.md)还提供三种参考面、
行星留与黄经穿越、月球照明、天体出没、近远点、交点、大距和赤经事件。
暂不支持冥王星、小行星及日月食。

## 时间、单位与精度

- 位置和定气定朔求解使用 **JD(TT)**；历法、民用时间和地平观测使用 **JD(UT1)**。
  `JulianTime` 与 `ZonedTime` 可用于转换。
- 几何位置采用 J2000 黄道坐标；行星距离为 AU，地心月球距离为 km。
  其他接口的单位见对应指南。
- 民用日期在 1582-10-15 起采用格里历，之前采用儒略历；天文年号 `0` 表示公元前 1 年。
- 主要星历模型面向天文年 `-6000..10000`，具体查询范围依 API 而异。
  精度随天体、年代和计算模式变化，求根容差不等于天文绝对精度。
- 时间层使用 `UTC ≈ UT1`，不包含闰秒或 EOP 数据；固定时区不自动处理夏令时。

精度指标、适用范围及限制见[精度说明](./docs/accuracy.md)。

## 相关包

各包可单独使用，八字、紫微和黄历包均依赖本天文核心。

| 包 | 用途 |
| --- | --- |
| `js-ephemeris-lite` | 天文位置、事件、时间与中国历法 |
| [bazi-lite](https://github.com/RedSC1/js-ephemeris-lite/tree/main/packages/bazi) | 四柱、十神藏干、神煞、起运大运与反查 |
| [ziwei-lite](https://github.com/RedSC1/js-ephemeris-lite/tree/main/packages/ziwei) | 紫微命盘、流运、自定义规则与星曜反查 |
| [huangli-lite](https://github.com/RedSC1/js-ephemeris-lite/tree/main/packages/huangli)（开发中） | 每日宜忌、神煞、节日和九宫飞星 |

## 文档与许可

- [天体位置](./docs/positions.md)
- [时间、太阳时、干支与农历](./docs/time-and-calendar.md)
- [历史历法与纪年](./docs/calendar-history.md)
- [日出日落、视位置与事件搜索](./docs/sky-events.md)
- [精度与模型限制](./docs/accuracy.md)
- [架构](./docs/architecture.md)、[模型修正](./docs/model-corrections.md)、[开发与测试](./docs/development.md)

代码采用 [MPL-2.0](./LICENSE)。科学模型与历史数据的来源、许可和适用范围见
[第三方声明](./THIRD_PARTY_NOTICES.md)。

# 视位置与天象搜索

[返回首页](../README.md) · [几何位置](./positions.md) · [精度与适用范围](./accuracy.md)

视位置、通用天体观测及轨道事件接口目前为开发中功能，尚未发布到 npm。
日出日落的专用接口见本文后半部分。

`fast / mid / accurate` 是定气、定朔及指定月相求解器的模型档位，不是通用
天象设置。大距、留、近远点、交点、合冲和日月食沿用各自接口签名与模型；
搜索步长、求根容差、参考面和视位置修正仍由对应选项独立控制。

冥王星也可用于通用视位置、黄经／赤经事件与出没接口。
**1600..2200 之外仍可求解，但后备星历精度较低；求根收敛不代表天象时刻准确。**
范围、质心约定及限制见[冥王星警告](./accuracy.md#冥王星)。

```js
import {
  apparentBodyPosition, apparentBodyState, searchStations,
  searchIngresses, searchRelativeLongitude, moonIllumination,
  bodyHorizontalPosition, bodyRiseSetForDay,
} from 'js-ephemeris-lite';

const jdTT = 2460409.25;
const fixed = apparentBodyPosition('mars', jdTT, { frame: 'j2000' });
const mean = apparentBodyPosition('mars', jdTT, { frame: 'mean-of-date' });
const date = apparentBodyState('mars', jdTT, { frame: 'true-of-date' });
console.log(date.longitudeDeg, date.rightAscensionDeg, date.longitudeSpeedDegPerDay);

const stations = searchStations('mercury', 2460401.5, 2460431.5);
const ingresses = searchIngresses('moon', 2460401.5, 2460431.5);
const conjunctions = searchRelativeLongitude('moon', 'sun', 0, 2460401.5, 2460431.5);
const moon = moonIllumination(jdTT);

const site = { longitudeDeg: 116.4, latitudeDeg: 39.9, heightMeters: 40 };
const horizontal = bodyHorizontalPosition('moon', 2460409.25, site); // 此处 JD 是 UT1
// 指定民用日时，先构造当地午夜的 ZonedTime，再读取 toJulianTime().jdUT1。
const riseSet = bodyRiseSetForDay('moon', 2460409.5, site);
```

支持 `sun`、`moon`、`mercury`、`venus`、`mars`、`jupiter`、`saturn`、`uranus`、`neptune`、`pluto`。视位置接口的输入是 **JD(TT)**，角度为 **degree**，距离与向量为 **AU**，速度为对应单位每天。几何接口的地心月球距离使用 km；视位置接口统一使用 AU。

| `frame` | 黄道输出 | 对应赤道输出 |
| --- | --- | --- |
| `j2000` | 固定 J2000 平黄道、平春分点 | 固定 J2000 平赤道、平春分点；不是 ICRS |
| `mean-of-date` | 当日平黄道、平春分点 | 当日平赤道、平春分点 |
| `true-of-date`（默认） | 当日黄道、真春分点 | 当日真赤道、真春分点 |

返回对象带 `frame`、`longitudeDeg`、`latitudeDeg`、`rightAscensionDeg`、`declinationDeg`、`distanceAu`、`lightTimeDays` 及黄道/赤道直角向量。`apparentBodyState()` 另外返回各坐标速度；日期参考面的速度包含参考面随时间变化，不能当作固定 J2000 速度直接旋转。

参考面与物理修正独立：`lightTime`、`aberration`、`solarDeflection` 默认开启，不改变底层星历系数中的校准。要复现几何位置，可设 `{ frame: 'j2000', lightTime: false, aberration: false, solarDeflection: false }`。参考面由 `frame` 单独选择。

模型包含项与限制见[精度说明](./accuracy.md)。

天文事件记录用 `time: JulianTime` 保存时刻；
用 `event.time.jdTT` 读取 TT，用 `event.time.toZonedTime(480)` 转为东八区钟表。
区间输入仍是数值，搜索使用半开区间 **`[startTT, endTT)`**：

- `searchLongitudeCrossings(body, targetDeg, startTT, endTT, options)`：穿越指定黄经。
- `searchRelativeLongitude(body, other, angleDeg, ...)`：`body - other` 的黄经差；0° 合、180° 冲。这不是赤经合，也不是球面最近接近。
- `searchStations(body, ...)`：黄经速度变号；`direction` 表示留之后的顺行/逆行。
- `searchIngresses(body, ...)`：穿越每 30° 边界，保留逆行回退；`fromSign`/`toSign` 是 0～11 的角区编号，不是 IAU 星座边界。
- 搜索参考面通过 `options.apparent.frame` 指定，默认 `true-of-date`。底层 `searchCrossings`/`searchAngleCrossings` 接收自定义函数，`stepDays` 默认 0.5；只保证采样能分辨的变号根，不保证找到同一采样间隔内的多根或相切根。大范围应分段搜索；单次最多 200000 个扫描间隔。

`bodyPhenomena()` 返回真实球面距日角、相位角、照明比例、视直径（角秒）和地平视差；太阳的相位/照明比例返回 `null`。`moonIllumination()` 增加 `phaseCycle`（0 朔、0.25 上弦、0.5 望、0.75 下弦）及 `waxing`。`phaseCycle` 是归一化黄经差，**不是月龄天数**。目前不提供星等计算。

`bodyHorizontalPosition()` 和 `bodyRiseSetForDay()` 使用 **JD(UT1)** 控制地球自转，内部转换 TT 计算天体；仅接受 `true-of-date`。方位角从北向东计，返回几何/折射后高度。出没区间精确为 `[dayStartUT1, dayStartUT1 + 1)`，不会按经度猜时区；`rises`、`sets`、`upperTransits`、`lowerTransits` 均为该区间内的 `JulianTime` 数组，读取 `.jdUT1` 得 UT1 数值。支持 `limb`、`horizonDegrees`、`refraction`，默认上边缘和折射；没有地形、地平俯角、极移或周日光行差。极昼/极夜以 `altitudeState` 返回。晨昏蒙影可用太阳、`limb: 'center'`、`refraction: false`，再设 `horizonDegrees: -6/-12/-18`。

子路径：`/apparent`、`/event-search`、`/phenomena`、`/body-visibility`。

## 日出日落与太阳高度

```js
import {
  JulianTime,
  ZonedTime,
  SOLAR_LIMB,
  solarAltitude,
  solarRiseSetForDate,
} from 'js-ephemeris-lite';

const riseSet = solarRiseSetForDate(
  new ZonedTime({
    year: 2025, month: 1, day: 1,
    hour: 0, minute: 0, second: 0,
    offsetMinutes: 480,
  }),
  {
    longitudeDeg: 116.4,
    latitudeDeg: 39.9,
    heightMeters: 50,
    pressureMbar: 1013.25,
    temperatureCelsius: 15,
  },
  {
    limb: SOLAR_LIMB.UPPER,
    refraction: true,
    horizonDegrees: 0,
  },
);

console.log(riseSet.rise?.toZonedTime(480), riseSet.set?.toZonedTime(480));
console.log(riseSet.altitudeState); // crosses / always-above / always-below / tangent / not-found

const jdRiseSet = solarRiseSetForDate(
  2460676.0, // 作为搜索窗口中心的 UT1 Julian Day
  { longitudeDeg: 116.4, latitudeDeg: 39.9 },
);
console.log(jdRiseSet.rise?.jdUT1, jdRiseSet.set?.jdUT1); // number | undefined

const altitude = solarAltitude(
  JulianTime.fromDate(new Date()),
  { longitudeDeg: 116.4, latitudeDeg: 39.9, heightMeters: 50 },
  { limb: SOLAR_LIMB.CENTER, refraction: true },
);
console.log(altitude.apparentAltitudeRad, altitude.azimuthRad);
```

`solarRiseSetForDate(dateOrCenter, observer, options)` 的 `rise/set` 始终是 `JulianTime | null`。传 `ZonedTime` 时取它所属的当地民用日期；传数值 JD 或 `JulianTime` 时，搜索以该瞬间为中心的 24 小时窗口。输入时区只决定搜索哪一天，不绑定输出时刻；显示时显式调用 `.toZonedTime(offsetMinutes)`。

经纬度单位为 degree，东经/北纬为正；高度单位为 metre。返回结果包含 `rise`、`set`、`altitudeState`、`limb`、`refraction`。极昼极夜时 `rise`/`set` 为 `null`，状态由 `altitudeState` 给出。`computeSolarRiseSetFast(center, observer, options)` 返回相同结构，其中 `rise/set` 也是 `JulianTime | null`。

默认大气为 `1013.25 mbar`、`15°C`，默认太阳上边缘和 hybrid 折射。`hybridAtmosphericRefraction()` 使用 `≤14°` Bennett、`≥16°` Smart、其间线性混合，真高度低于 `-1°` 时关闭折射。还可传 `fixedDiscSize: true` 固定太阳视半径，或用 `horizonDegrees` 表示地平遮挡高度。

`solarAltitude()` 返回 `centerAltitudeRad`、`apparentAltitudeRad`、`azimuthRad`和高度变化率 `slopeRadPerDay`（rad/day）。它和日出日落求解器使用同一套地心太阳、太阳光行差、章动、地球自转、观测者视差、太阳视半径和折射链路。

## 轨道与赤经事件

```js
import {
  searchLunarApsides, searchEarthApsides, searchLunarNodes,
  searchGreatestElongations, searchRelativeRightAscension,
  searchRightAscensionStations,
} from 'js-ephemeris-lite/orbital-events';

const startTT = 2461041.5, endTT = 2461406.5;
const lunarApsides = searchLunarApsides(startTT, endTT);
const earthApsides = searchEarthApsides(startTT, endTT);
const nodes = searchLunarNodes(startTT, endTT, {frame: 'mean-of-date'});
const elongations = searchGreatestElongations('mercury', startTT, endTT);
const conjunctions = searchRelativeRightAscension('venus', 'moon', 0, startTT, endTT);
const raStations = searchRightAscensionStations('mercury', startTT, endTT);
```

这些搜索的区间输入是 JD(TT)，使用半开区间 `[startTT, endTT)`。
返回事件的 `time` 是 `JulianTime`，通过 `.time.jdTT` 读取 TT 数值：

- 近远点是同时刻几何距离的极值，月球相对于地心、地球相对于太阳，
  采用同时刻的几何位置；
- 月球交点是对所选黄道面的实际穿越，不是平交点或瞬时轨道根数。
  默认 `mean-of-date`；`true-of-date` 只改分点方向，因此交点时刻相同、
  黄经不同；固定 `j2000` 黄道面可得到不同穿越时刻；
- 大距是水星/金星与太阳的三维视角距极大值，不是黄经差极大值；
- 赤经合用 `angleDeg: 0`（第三个参数）表示，不等于最小角距。
  赤经留与黄经留独立，均支持视位置的参考面选项。

精度与适用范围见[精度说明](./accuracy.md)。

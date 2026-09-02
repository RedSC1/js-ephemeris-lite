# 天体位置

[返回首页](../README.md) · [视位置与天象搜索](./sky-events.md)

位置函数接收 TT 的 Julian Day（`jdTT`），返回 `[x, y, z]`；对应的 `*State()` 返回 `{ position, velocity }`。速度单位中的时间均为 day。

| API | 原点 → 目标 | 位置单位 | 速度单位 |
| --- | --- | --- | --- |
| `planetHeliocentricPosition/State` | 太阳 → 指定行星 | AU | AU/day |
| `planetGeocentricPosition/State` | 地球 → 指定行星 | AU | AU/day |
| `earthHeliocentricPosition/State` | 太阳 → 地球 | AU | AU/day |
| `sunGeocentricPosition/State` | 地球 → 太阳 | AU | AU/day |
| `moonGeocentricPosition/State` | 地球 → 月球 | km | km/day |
| `moonHeliocentricPosition/State` | 太阳 → 月球 | AU | AU/day |
| `embHeliocentricPosition/State` | 太阳 → 地月质心 | AU | AU/day |

```js
import {
  JulianTime,
  PLANET,
  planetHeliocentricState,
  planetGeocentricPosition,
  earthHeliocentricState,
  sunGeocentricPosition,
  moonGeocentricPosition,
  moonHeliocentricPosition,
} from 'js-ephemeris-lite';

const time = JulianTime.fromDate(new Date());
const jupiter = planetHeliocentricState(PLANET.JUPITER, time.jdTT);
const quickJupiter = planetHeliocentricState(PLANET.JUPITER, time.jdTT, 'fast');
const marsFromEarth = planetGeocentricPosition(PLANET.MARS, time.jdTT);
const earth = earthHeliocentricState(time.jdTT);
const sunFromEarthAu = sunGeocentricPosition(time.jdTT);
const moonFromEarthKm = moonGeocentricPosition(time.jdTT);
const moonFromSunAu = moonHeliocentricPosition(time.jdTT);

console.log(jupiter.position, jupiter.velocity, marsFromEarth);
console.log(earth.position, earth.velocity);
```

所有几何位置／状态 API 都接受可选的第三个（具名快捷函数为第二个）`accuracy`
参数：`'fast' | 'mid' | 'accurate'`。
省略时默认为 `accurate`，因此现有调用不会在升级后降低精度。太阳档位控制地球模型；
地心行星和日心月球会把同一档位同时用于目标与地球。视位置 API 使用同名选项，
见[视位置与恒星时](./sky-events.md#视位置与恒星时)。
`moonDirectionState()` 需要自定义 `latitudeTerms` 时仍可传对象；仅选择精度时直接
传字符串即可。

水星至海王星和月球的 fast／mid 都使用生成阶段排好的完整频率／相位包络；
旁边的小型档位计数表只记录每个 `Lₙ/Bₙ/Rₙ` 应保留前多少项，不重复保存系数。
运行时不排序、不复制 full 表，也不会拆开同一频率跨时间幂的系数。冥王星近代
Chebyshev 表使用保守的嵌套阶数；范围外的后备模型三档均使用同一表。
各档相对完整模型的测量差异见[精度说明](./accuracy.md#位置计算档位)。

`PLANET` 覆盖八大行星及冥王星；也提供 `mercuryHeliocentricState()`、`plutoHeliocentricState()` 等具名日心快捷函数。
冥王星推荐范围为 1600..2200 年，范围外仍可计算，但使用低精度后备模型，不保证位置或事件时刻精度。
其几何参考点为冥王星系统质心；范围、过渡区及警告可读取 `PLUTO_MODEL_INFO`。

这些是 J2000 黄道/春分坐标架中的**几何位置**，不含光行时、光行差、章动、大气折射或观测者视差。`sunGeocentricPosition()` 因而就是日心地球向量的反向；日心太阳的位置按定义恒为零，不单设 API。地平观测与日出日落见[观测指南](./sky-events.md)。

别名：`earthPosition/State`、`moonPosition/State`、`embPosition/State` 分别等价于
日心地球、地心月球、日心地月质心。地心行星 API 使用同一时刻的行星与地球向量作差。

当前模型的校准包含在系数中，没有独立的校准开关。
轨道校准与视位置修正的区别见[模型修正](./model-corrections.md)，
适用范围与模型限制见[精度说明](./accuracy.md)。

行星和月球的系数分别位于 `src/planet-series.js`、`src/moon-series.js`；
文件结构、基底与参考系见[星历模型与运行时数据](./architecture.md#星历模型与运行时数据)。

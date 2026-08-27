# 天体位置

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
const marsFromEarth = planetGeocentricPosition(PLANET.MARS, time.jdTT);
const earth = earthHeliocentricState(time.jdTT);
const sunFromEarthAu = sunGeocentricPosition(time.jdTT);
const moonFromEarthKm = moonGeocentricPosition(time.jdTT);
const moonFromSunAu = moonHeliocentricPosition(time.jdTT);

console.log(jupiter.position, jupiter.velocity, marsFromEarth);
console.log(earth.position, earth.velocity);
```

`PLANET` 覆盖水星、金星、地球、火星、木星、土星、天王星和海王星；也提供 `mercuryHeliocentricState()` 等具名日心快捷函数。当前不支持冥王星。

这些是 J2000 黄道/春分坐标架中的**几何位置**，不含光行时、光行差、章动、大气折射或观测者视差。`sunGeocentricPosition()` 因而就是日心地球向量的反向；日心太阳的位置按定义恒为零，不单设 API。地平观测与日出日落见[观测指南](./sky-events.md)。

别名：`earthPosition/State`、`moonPosition/State`、`embPosition/State` 分别等价于日心地球、地心月球、日心地月质心。默认情况下，月球、地球以及水星至海王星都会应用各自的 DE441 残差修正；`{ corrections: false }` 可统一关闭修正并取得原始截断 ELP/VSOP87B 结果。地心行星 API 会使用同一时刻、同一修正设置的地球模型作向量差，这与光行时等视位置修正无关。

修正层的时间区间和数据结构见[模型修正](./model-corrections.md)，精度指标见[精度说明](./accuracy.md)。

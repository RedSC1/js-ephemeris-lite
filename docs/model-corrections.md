# 模型修正

[返回首页](../README.md) · [天体位置](./positions.md) · [精度说明](./accuracy.md)

## 轨道校准

当前几何星历的 DE441 校准包含在模型系数中。八大行星和月球各使用一套全局系数；
冥王星使用近代与后备模型，适用范围见[冥王星警告](./accuracy.md#冥王星)。
级数格式和参考系变换见[架构](./architecture.md#模型数据)。

校准是模型本身的一部分，没有独立修正量查询接口或运行时开关。

```js
import { PLANET, planetHeliocentricState } from 'js-ephemeris-lite';

const state = planetHeliocentricState(PLANET.VENUS, 2451545);
console.log(state.position, state.velocity);
```

## 坐标与视位置修正

参考系变换和光传播修正独立于轨道校准：

- 几何位置接口输出 J2000 平黄道坐标。
- 视位置的 `frame` 选择固定、当日平或当日真参考面。
- `lightTime`、`aberration`、`solarDeflection` 分别控制光行时、光行差和太阳光线偏折。

这些物理选项不改变底层模型系数。选项及示例见[视位置与天象搜索](./sky-events.md)。

`moonElpLongitudeState()` 返回校准后的原生 ELP 框架黄经与解析变化率，
不是日期参考系的视黄经。定朔中的 `moonLatitudeTerms` 控制黄纬取项数，
其含义见[定朔设置](./accuracy.md#定朔设置)。

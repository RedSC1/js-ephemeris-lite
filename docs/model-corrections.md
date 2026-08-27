# 模型修正

[返回首页](../README.md) · [天体位置](./positions.md) · [精度说明](./accuracy.md)

## 开关与含义

默认几何星历启用 DE441 残差拟合。位置和状态函数接受
`{ corrections: false }`，可取得原始截断模型结果；这是模型修正开关，
与视位置的光行时、光行差和光线偏折开关分别控制。

```js
import { PLANET, planetHeliocentricState, PLANET_CORRECTION_INFO } from 'js-ephemeris-lite';

const corrected = planetHeliocentricState(PLANET.JUPITER, 2451545.0);
const raw = planetHeliocentricState(PLANET.JUPITER, 2451545.0, { corrections: false });
console.log(corrected.position, raw.position, PLANET_CORRECTION_INFO);
```

## 时间分层与行星修正

月球、地球与行星采用相同的时间分层，以距 J2000 的年数选择修正层：

| 距 J2000 | 修正层 |
| --- | --- |
| 不超过 800 年 | 现代拟合 |
| 800～1000 年 | 使用 smoothstep 在现代与长期层之间过渡 |
| 超过 1000 年 | 长期修正 |

现代层的拟合区间为公元 1000～3000 年，长期层面向天文年 `-6000..10000`。

水星、金星、火星、天王星和海王星使用慢漂移与主周期相位项。
木星和土星使用 25 年分段的 Chebyshev 残差级数，各段以独立缩放的 Int16
系数存储，并在段界平滑拼接。木土修正的参考位置分别为 DE441 木星系统质心（5）
和土星系统质心（6）相对太阳（10）的位置。

经度、纬度和距离分别修正，速度由同一表达式解析求导。
`PLANET_CORRECTION_INFO` 提供分层边界和误差统计，单位见[精度说明](./accuracy.md)。

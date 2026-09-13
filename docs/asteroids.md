# 小行星与半人马小行星

可选包 `asteroid-ephemeris-lite` 提供九个小天体在固定 J2000 平黄道坐标轴中的日心和地心几何位置。接口返回三维 AU 向量，可用于一般几何计算，并非只保留黄经或专门面向占星用途。

```sh
npm install js-ephemeris-lite asteroid-ephemeris-lite
```

```js
import {
  ASTEROID,
  asteroidGeocentricPosition,
  asteroidHeliocentricPosition,
} from 'asteroid-ephemeris-lite';

const jdTT = 2451545;
const ceresFromSun = asteroidHeliocentricPosition(ASTEROID.CERES, jdTT);
const chironFromEarth = asteroidGeocentricPosition(ASTEROID.CHIRON, jdTT, 'accurate');
```

支持谷神星、智神星、婚神星、灶神星、爱神星、1181 Lilith，以及 Chiron、Pholus、Nessus。`LILITH_1181` 明确指编号 1181 的小行星，不是月球远地点相关的“黑月莉莉丝”。

## 时间、坐标与修正

- 输入为有限的 `JD(TT)`，范围为天文纪年 -3000～3000 年。
- 输出为固定 J2000 平黄道与平春分点坐标轴中的 AU 向量。
- 日心接口以太阳为中心；地心接口减去所选 `accuracy` 档位的地球日心位置。
- 结果是几何位置，不含光行时、光行差、引力偏折、岁差章动或地形视差。
- 离线源样本使用 TDB；TT 与 TDB 的毫秒级周期差远小于本轻量模型的误差预算。

每个分段在边界附近使用五次平滑校正，使相邻位置连续。该处理消除了直接切换独立拟合分段产生的位置跳变；当前接口不提供小行星速度，因此不承诺解析速度精度。

## 模型与精度

六个中低偏心率对象使用分段轨道要素 Poisson 模型；三个半人马对象使用自适应分段的 Cartesian Chebyshev 模型。后者直接以三维位置误差选段，不再只按地心方向误差筛选。

下表是独立跨年代样本相对离线基准向量的观测结果，不是对任意时刻的严格上界。公开的 `ASTEROID_MODEL_INFO.positionErrorBudgetKm` 使用更保守的回归阈值。

| 对象 | 三维位置 RMS | 三维位置最大值 | 方向最大值 |
| --- | ---: | ---: | ---: |
| Ceres | 14,835 km | 50,379 km | 26.94″ |
| Pallas | 24,994 km | 98,847 km | 72.48″ |
| Juno | 46,907 km | 232,321 km | 158.24″ |
| Vesta | 13,181 km | 34,484 km | 21.77″ |
| Eros | 19,662 km | 95,804 km | 113.08″ |
| 1181 Lilith | 7,649 km | 44,878 km | 26.75″ |
| Chiron | 557 km | 2,185 km | 0.31″ |
| Pholus | 590 km | 3,665 km | 0.48″ |
| Nessus | 496 km | 915 km | 0.09″ |

这些模型适合体积受限应用中的近似位置、可视化和候选事件筛选。测量归算、掩星预报、航天器导航或需要公里级保证的工作，应直接使用覆盖相应年代的 JPL SPK 或其他经过验证的数值星历。

## 数据来源与长年代限制

- Ceres、Pallas、Juno、Vesta 在本模块的完整范围内使用 JPL `sb441-n16` 样本。
- Eros 约 1550～2650 年使用 JPL `sb441-n373s`；范围外来自项目离线生成的连续数值积分数据。
- 1181 Lilith、Chiron、Pholus、Nessus 约 1799～2101 年使用 JPL Horizons SPK；范围外来自同一离线数据工程的连续数值积分扩展。

后两类对象在官方 SPK 区间外不应被描述为 JPL 直接星历。长年代结果还受初始轨道、扰动模型及近距离遭遇的混沌放大影响，年代越远不确定性通常越大。

小行星系数不包含在 `js-ephemeris-lite` 主包中，只有安装可选包的项目才会下载这些数据。

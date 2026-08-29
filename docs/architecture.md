# 架构

[返回首页](../README.md) · [开发与测试](./development.md)

## 包与层次

根包 `js-ephemeris-lite` 提供纯 JavaScript 天文与历法函数及类型声明。
`bazi-lite` 和 `ziwei-lite` 从 TypeScript 编译为 `dist`，`huangli-lite` 直接发布 JavaScript 源文件。
三个规则包都依赖根包，核心不反向依赖术数包。各包可单独安装；黄历目前仅供 workspace 使用。

| 层 | 模块 | 职责 |
| --- | --- | --- |
| 模型与坐标 | `ephemeris`, `coordinates` | 几何位置、速度、岁差章动与坐标变换 |
| 时间 | `time`, `solar-time` | TT/UT1、固定时区钟表、平太阳时与真太阳时 |
| 天文事件 | `calendar-events`, `qi-shuo` | 定气定朔、全年节气、七十二候与月相 |
| 历法 | `chinese-calendar`, `chinese-era`, `ganzhi` | 农历结构、历史纪年和四柱 |
| 地平观测 | `solar-visibility` | 太阳高度及专用日出日落算法 |
| 开发中天象接口 | `apparent`, `event-search`, `phenomena`, `orbital-events`, `body-visibility` | 视位置、搜索、照明及通用出没 |

上述模块均有对应包子路径；内部工具与系数文件不是稳定的公共入口。
物理瞬时和钟表规则分开传递，避免真太阳时或晚子时改变实际天文瞬时。

## 模型数据

| 文件 | 内容 |
| --- | --- |
| `src/planet-series.js` | 八大行星及冥王星的系数、时间尺度 |
| `src/planet-models.js` | 八大行星的基底选择 |
| `src/direct-planet-model.js` | 行星 L/B/R 级数求值与解析速度 |
| `src/moon-series.js` | 月球分阶系数、共享相位、平均黄经及 P/Q 参考系常数 |
| `src/moon-model.js` | 月球共享相位求值与解析速度 |
| `src/pluto-model.js` | 冥王星近代与后备模型求值 |
| `src/planet-frame.js` | 行星理论原生系到 J2000 平黄道系的固定矩阵 |
| `src/nutation-series.js` | IAU 2000B 章动系数 |
| `src/event-series.js` | 事件初值和近似速度系数 |

### 八大行星

水星、金星、地球、火星采用 VSOP2013 衍生的直接 L/B/R 级数；木星、土星、天王星、
海王星采用 TOP2013 衍生级数。每颗行星在适用时段内使用一套融合校准的系数。
地球表直接给出物理地球的位置和速度，求值时无需另算月球。

系数按 `L0/L1/…`、`B0/B1/…`、`R0/R1/…` 分组，每项为 `A, phase, frequency`。
分组下标表示多项式基底的阶数，未必是时间幂次：

| 星体 | 多项式基底 |
| --- | --- |
| 水星、金星、火星、木星、土星、海王星 | Legendre |
| 地球 | anchored Chebyshev |
| 天王星 | Chebyshev |

包络自变量为 `x = (jdTT - 2451545) / 2922000`，周期项时间变量为
`tau = (jdTT - 2451545) / 365250`。每项贡献为
`basis[n](x) * A * cos(phase + frequency * tau)`。
L/B 单位为弧度，R 为 AU；速度对同一表达式解析求导。

### 月球

月球采用全局校准的 ELP/MPP02 衍生级数。系数按时间幂次分组，每项为
`S, C, argumentIndex`，贡献为 `x^n * (S*sin(argument) + C*cos(argument))`，
其中 `x = (jdTT - 2451545) / 2922000`。
共享相位表的每行是 `p1..p8`，表示 `p1*x + … + p8*x^8`。
L/B 使用弧度，R 使用 km；黄经另加平均黄经多项式。

L/B/R 共享相位的三角函数和解析导数；P/Q 参考系变换将结果转换到 J2000 平黄道系。
完整位置与状态接口计算三个坐标，方向接口跳过距离级数。

### 冥王星

`PLUTO_NEAR_L/B/R` 保存近代 Chebyshev 系数，`PLUTO_FALLBACK_L/B/R` 保存粗略后备级数。
1590..1600、2200..2210 年以五次平滑权重连接，速度包含权重导数；
近代高阶多项式不向远端外推。推荐范围及限制见[冥王星](./accuracy.md#冥王星)。

### 参考系

`planet-frame.js` 将 VSOP2013/TOP2013 原生黄道系经 ICRF 转换到库内 J2000 平黄道系。
位置和速度使用同一固定矩阵。月球使用其 P/Q 参考系变换。
这些坐标变换独立于轨道校准。
日期参考面使用 Vondrák 2011 长期岁差与 IAU 2000B 章动。

## 气朔求解

定气求太阳视黄经达到目标角度的时刻，定相求月日视黄经差达到目标角度的时刻。
`calendar-events` 提供以邻近 JD 选取事件的 `solve…` 接口和以累计角度选取事件的标量接口。

`solveSolarLongitude`、`solveLunarPhase`、`solveNewMoon` 支持 `fast`、`mid`、`accurate` 三档，
默认 `mid`。Fast 使用截断级数和固定次数修正；Mid 使用专用事件模型；
Accurate 使用完整库内视位置模型。后两档按数值容差迭代。
档位只影响事件求解，不改变通用位置与状态接口。

`solve…` 返回 `JulianTime`。历法和天象记录通过 `time` 字段引用该时间对象；
固定时区转换由 `JulianTime.toZonedTime()` 完成。
档位配置、输入角度和事件选择方式见[时间与历法指南](./time-and-calendar.md)。

## 时间模型

ΔT 在 1953～2050 年使用年表及 Catmull–Rom 插值，早期使用 S15 分段模型，
远期平滑接续长期抛物线。-820～-720 年之间使用三次 Hermite 连接早期模型。
农历归日和历史月份制度在历法层处理，详见[历史历法](./calendar-history.md)。

## 运行时数据

`src/*-series.js` 中的数值系数及 `src/generated` 中的历史历表数据随包提供。
安装及运行不需要额外下载星历或配置其他语言的运行环境。
数据来源与权利边界见[第三方声明](../THIRD_PARTY_NOTICES.md)。

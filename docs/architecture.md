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

上述模块均有对应包子路径；内部工具与生成数据不是稳定的公共入口。
物理瞬时和钟表规则分开传递，避免真太阳时或晚子时改变实际天文瞬时。

## 模型数据

行星使用按坐标预算截断的 VSOP87B，共 7679 项，截断预算参考寿星天文历。
月球使用截断 ELP/MPP02，
包含 627 经度项、277 纬度项及 327 距离项。坐标变换采用 IAU 2000B 章动与
Vondrák 2011 长期岁差；[模型修正](./model-corrections.md)单独叠加于星历层。

气朔求解器从地球和月球模型中各选取 10 项，以目标年代范围内的最大
`|A*T^n|` 为排序依据，并拟合四次慢差。低模用于估计初始根，
最终结果使用完整模型校正，另提供带区间保护的 Newton 求解路径。
定朔快速路径共用日期框架，消去月、日视黄经共有的章动项；
光行差所需的地球距离使用 30 项半径级数。月球方向计算跳过距离项，
完整位置与状态接口则计算三维信息。

## 时间模型

ΔT 在 1953～2050 年使用年表及 Catmull–Rom 插值，早期使用 S15 分段模型，
远期平滑接续长期抛物线。-820～-720 年之间使用三次 Hermite 连接早期模型。
农历归日和历史月份制度在历法层处理，详见[历史历法](./calendar-history.md)。

## 运行时数据

`src/generated` 中的模型、修正和历史历表数据随包提供。安装及运行不需要
额外下载星历或配置其他语言的运行环境。
数据来源与权利边界见[第三方声明](../THIRD_PARTY_NOTICES.md)。

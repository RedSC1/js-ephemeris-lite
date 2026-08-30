# 第三方来源与许可声明

`js-ephemeris-lite` 的项目原创源代码采用 Mozilla Public License 2.0
（MPL-2.0）发布。该许可证不取代下列科学模型、系数表、参考星历和历史资料
各自可能适用的权利与许可条件。

本包分发经过筛选的数值系数、JavaScript 求值器、本项目拟合的修正系数、
历史历法数据和中国年号数据。具体来源如下。

## 寿星天文历

本项目下列材料来源于许剑伟编写的《寿星天文历／寿星万年历》：

- 行星级数最初的分坐标截断规模参考；
- `src/eclipses.js` 与 `src/solar-eclipses.js` 中保留原名的 `ecFast`、`ysPL`、
  `rsGS` 和 `rsPL`，包括日食快速分类、月食过程、全球日食贝塞尔坐标与
  食带、地方日食接触时刻和界线；
- `src/generated/historical-calendar-data.js` 中的古代历法规则与历日归属；
- `src/generated/chinese-era-data.js` 中 529 条年号记录的起始年、名义时长、
  已使用年数、政权、君主称号、君主姓名和年号名称。

本项目对上述材料进行了压缩、保守匹配和明确记录的纠错或规范化；这些处理
不表示本项目将寿星原始材料重新许可为 MPL-2.0。

- 项目镜像与署名：<https://github.com/sxwnl/sxwnl>
- 原版权说明：<https://sxwnl.github.io/src/sm1.htm#copyright>

原版权说明原文如下：

> 本程序是开源的，你可以使用其中的任意部分代码，但不得随意修改“天文算法(eph.js)”及“农历算法(lunar.js)中古历部分的数据及算法”。一旦修改可能影响万年历的准确性，如果你对天文学不太了解而仅凭对历法的热情，请不要对此做任何修改，以免弄巧成拙。
>
> 如果在你自己开发的软件中使用了本程序的核心算法及数据，你可以在你的软件中申明“数据或算法来源于寿星天文历”，也可以不申明，但不可以申明为它其它来源。如有异义，可与我共内探讨。
>
> 作者：许剑伟，2008年11月于家里。xunmeng04#163.com，13850262218

本声明只描述当前 npm 包实际分发的内容。上述日月食移植使用本包现有日月视
位置、恒星时与 ΔT 实现作为天文输入，保留寿星公开算法名称、分类、接触时刻
和界线字段约定。

## VSOP2013

`src/planet-series.js` 中水星、金星、地球和火星的日心黄经、黄纬、距离系数，
由完整 VSOP2013 椭圆轨道要素解离线转换、展开并筛选生成。针对 JPL DE441
拟合的残差系数由本项目生成，并非复制自 VSOP2013。

- IMCCE VSOP2013 数据与文档：
  <https://ftp.imcce.fr/pub/ephem/planets/vsop2013/solution/>
- 模型文档：
  <https://ftp.imcce.fr/pub/ephem/planets/vsop2013/solution/README.pdf>

MPL-2.0 仅适用于本项目实现，不表示对 VSOP2013 理论或原始系数重新许可。

## TOP2013

木星、土星、天王星和海王星的级数包含从 IMCCE 官方 `TOP2013LBR.dat`
筛选、换基并结合本项目拟合修正得到的系数。运行时目标是各行星系统质心相对
太阳的位置。

- TOP2013 数据：<https://ftp.imcce.fr/pub/ephem/planets/top2013/>
- TOP2013 文档：<https://ftp.imcce.fr/pub/ephem/planets/top2013/README.pdf>

## ELP/MPP02

`src/moon-series.js` 使用从 ELP/MPP02 DE405 模式系数表
`ELP_MAIN.S1..S3` 和 `ELP_PERT.S1..S3` 中截断、重排后得到的子集。

- J. Chapront、G. Francou，*The lunar theory ELP revisited. Introduction
  of new planetary perturbations*，Astronomy & Astrophysics 404 (2003)，
  735–742：<https://doi.org/10.1051/0004-6361:20030529>
- 巴黎天文台／SYRTE 原始表目录：
  `ftp://cyrano-se.obspm.fr/pub/2_lunar_solutions/2_elpmpp02`

生成本包时使用的原始系数文件未附常规 SPDX 或其他明确软件许可证。本声明
用于保留来源，不主张这些原始系数已按 MPL-2.0 重新许可。

## IAU 岁差与章动模型

坐标层实现 IAU 2000B 章动、IAU 2006 平黄赤交角，以及 Vondrák、
Capitaine 和 Wallace 发布的长期岁差表达式。

- Vondrák 等，*New precession expressions, valid for long time intervals*：
  <https://doi.org/10.1051/0004-6361/201117274>
- IAU SOFA：<https://www.iausofa.org/>
- SOFA 使用条款：<https://www.iausofa.org/terms-and-conditions>

SOFA 版权归 IAU Standards of Fundamental Astronomy Board 所有。
`js-ephemeris-lite` 不是 IAU SOFA Board 提供或认可的软件。

## JPL DE441 参考拟合

地球、月球以及各行星模型中的部分修正系数由本项目根据 JPL DE441 样本拟合。
发布包包含拟合后的系数，不包含 DE441 二进制星历核。

- Park 等，*The JPL Planetary and Lunar Ephemerides DE440 and DE441*：
  <https://doi.org/10.3847/1538-3881/abd414>
- JPL/NAIF 行星星历核目录：
  <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/>

冥王星模型同样是本项目对 DE441 冥王星系统质心位置的近似拟合；其视圆面半径
参考 JPL 行星物理参数表：<https://ssd.jpl.nasa.gov/planets/phys_par.html>。

## 中国年号与精确边界

### 寿星年号表

年号记录的前七个字段来自寿星 `lunar.js` 的 `JNB` 表，相关版权说明见上文。

### DDBC 时间规范资料库

177 条经过保守匹配的中国历日边界来自法鼓佛教學院图书资讯馆整理的
**DDBC 时间规范资料库**。生成数据保留来源，不主张将这些边界重新许可为
MPL-2.0。

- 下载页：<https://authority.dila.edu.tw/docs/open_content/download.php>
- 资料库归档文件声明 CC BY-SA 3.0 Unported；下载页同时标示
  CC BY-SA 2.5 Taiwan：
  <https://creativecommons.org/licenses/by-sa/3.0/>、
  <https://creativecommons.org/licenses/by-sa/2.5/tw/>

### manakai/data-locale

部分年号的精确起止日、补充政权及君主标签来自 `manakai/data-locale` 的
`calendar-era-defs.json` 与 `tags.json`。本项目只导入可保守匹配的规范边界，
并对显示名称作少量有记录的中文规范化。上游将相关 JSON 和文档在法律允许的
范围内以 CC0 贡献至公有领域。

- 仓库：<https://github.com/manakai/data-locale>
- 数据模型与许可：
  <https://github.com/manakai/data-locale/blob/master/doc/calendar-era-defs.txt>
- CC0 1.0：<https://creativecommons.org/publicdomain/zero/1.0/>

## 本项目生成的内容

级数截断选择与排序、低阶事件估算器、DE441 残差拟合系数、JavaScript
求值器和求解器、时间与历法 API、测试，以及历史资料的压缩运行时表示，均由
本项目生成和维护。

更完整的技术细节及英文说明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

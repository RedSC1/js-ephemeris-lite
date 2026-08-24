# js-ephemeris-lite

轻量、零运行时依赖的纯 JavaScript 半解析星历与中国历法库。当前 API 以 `0.x` 版本发布，在 `1.0` 前仍可能调整。

原创实现以 MPL-2.0 发布；星历模型、科学数据与历史历表的来源和权利边界见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。

安装：

```bash
npm install js-ephemeris-lite
```

目前包含：

- SXWNL 项数预算截断的 VSOP87B Earth（882 项）；
- 经度优先截断的 ELP/MPP02 Moon（627 经度项、277 纬度项、327 距离项）；
- `EMB = Earth + Moon / (1 + EMRAT)`；
- DE441 广域慢漂移/共享相位修正，并在 J2000 前后 200 年完全关闭、200～1000 年平滑开启；
- C++ 项目移植的 IAU 2000B 章动和 Vondrák 2011 长期岁差矩阵。
- 独立从上述数据选择的 10 项气朔低模、解析导数和带区间保护的 Newton 求根。
- C++ 时间层迁移的 ΔT：1953～2050 年表使用 Catmull–Rom 三次插值，早期使用 S15 分段三次模型，远期平滑接长期抛物线；另以 `-820～-720` 的三次 Hermite 桥接修复原模型在 `-720` 年的 253.272 秒硬跳变。
- C++ 历法层迁移的 25 节气、15 朔、14 农历月排布，支持前后节气/节/气搜索、阴阳历互转、2033 闰十一月和历史改历月名。
- 干支历底层：立春年界、逐节月界、日时柱、五虎遁、五鼠遁、纳音，并独立支持三种晚子时约定。
- 历史定朔/定气日期压缩表：分段线性基准加稀疏 `±1 day` 位修正，覆盖 33161 个朔和 52324 个节气事件。
- C++ fast2 结构迁移的日出日落：普通纬度使用解析种子加 2～3 次 Newton，高纬/浅切退化为 2 小时窗口扫描和精确残差二分；默认上边缘、hybrid 大气折射。

运行：

```bash
npm run demo
node src/ephemeris.js 2451545.0
npm test
```

核心导出在 `src/ephemeris.js`：

```js
import {
  earthPosition,
  moonPosition,
  embPosition,
  iau2000bNutation,
  vondrak2011PrecessionMatrix,
} from './src/ephemeris.js';

import {
  solveSolarLongitude,
  solveNewMoon,
} from './src/calendar-events.js';

import {
  deltaTSeconds,
  JulianTime,
  ZonedTime,
  ttToUt1,
} from './src/time.js';

import {
  CALENDAR_MODE,
  calculateChineseCalendarYear,
  findSolarTerm,
  solarToLunar,
  lunarToSolar,
} from './src/chinese-calendar.js';

import {
  RAT_HOUR_MODE,
  fourPillarsForZonedTime,
  describeFourPillars,
} from './src/ganzhi.js';

const moonKm = moonPosition(2451545.0);
const embAu = embPosition(2451545.0);
const springEquinox = solveSolarLongitude(0, 2451623.0);
const newMoon = solveNewMoon(2451550.0);
const deltaT = deltaTSeconds(2024.25);
const equinoxUt1 = ttToUt1(springEquinox.jdTT);
const lunarNewYear = solarToLunar({ year: 2025, month: 1, day: 29 });
const solarDate = lunarToSolar({ year: 2033, month: 11, day: 1, isLeap: true });

// JavaScript Date 已经是绝对瞬时：直接 Date.getTime() → Unix ms → JD。
const now = JulianTime.fromDate(new Date());

// 自己填写民用墙钟时间时必须明确固定 UTC offset。
const birth = new ZonedTime({
  year: 2000, month: 1, day: 1,
  hour: 12, minute: 0, second: 0,
  offsetMinutes: 480,
}).toJulianTime();

const birthClock = new ZonedTime({
  year: 2000, month: 1, day: 1,
  hour: 23, minute: 30, second: 0,
  offsetMinutes: 480,
});
const pillars = fourPillarsForZonedTime(birthClock, {
  mode: CALENDAR_MODE.CHINA_ASTRONOMICAL,
  ratHourMode: RAT_HOUR_MODE.TOMORROW_STEM,
});
console.log(describeFourPillars(pillars));
```

日出日落：

```js
import { solarRiseSetForDate } from './src/solar-visibility.js';

const riseSet = solarRiseSetForDate(
  { year: 2025, month: 1, day: 1 },
  {
    longitudeDeg: 116.4,
    latitudeDeg: 39.9,
    heightMeters: 50,
    offsetMinutes: 480,
    // 默认 limb: 'upper'、refraction: true
  },
);

console.log(riseSet.rise, riseSet.set);             // JulianTime
console.log(riseSet.riseZoned, riseSet.setZoned);   // ZonedTime
console.log(riseSet.altitudeState);                 // crosses / always-above / always-below
```

星历与事件求根输入都是 TT 的 Julian Day；事件结果同时给出 `jdTT`、估算的 `jdUT1` 和 `deltaTSeconds`。Earth/EMB 输出 AU，Moon 输出 km；三者都是 J2000 平黄道/平春分直角坐标。经验修正可用 `{ corrections: false }` 关闭。

lite 时间层约定 `UTC ≈ UT1`，不携带闰秒、TAI 或 EOP 表；TT 仍通过 `TT = UT1 + ΔT` 单独计算。`JulianTime` 保存 `jdUT1`、`jdTT` 和 `deltaTSeconds`，`ZonedTime` 表示强制带 `offsetMinutes` 的民用时间。`JulianTime.fromDate()` 只读取原生 `Date.getTime()`，不会拆分或重新解释原生 Date 的年月日。历法查询可直接接收 `JulianTime`，事件结果也附带 `event.time`，原有数值 JD 字段继续保留。

日出日落默认大气为 C++ 的 standard atmosphere（`1013.25 mbar`、`15°C`），也可传 `pressureMbar` 和 `temperatureCelsius`。`hybridAtmosphericRefraction()` 原样采用 C++ 的分段：`≤14°` Bennett、`≥16°` Smart、其间线性混合，真高度低于 `-1°` 时关闭折射。`horizonDegrees`、`upper/center/lower` 边缘和固定太阳视半径均可单独切换。

`src/generated/model-data.js` 和历史日期数据已提交在发布包中，安装及运行不需要上游 VSOP87B、ELP/MPP02、DE441 或 C++ 项目。

高精度定朔路径只计算月球经度和纬度的单位方向，跳过全部 327 个距离项；完整 `moonState()`/`moonPosition()` 才计算距离，因此补强三维参数不会拖慢通常的气朔调用。

原始 ELP `W1` 和周期项不会写入岁差或经验旋转。`moonElpLongitudeState()` 可单独取得原始经度状态；`solveNewMoon(jd, { moonLatitudeTerms: 0 | 5 | 10 | 20 | 'full' })` 可在运行时选择日期框架转换使用的黄纬预算。定朔默认使用 10 项：相对完整 277 项路径，在 `-6000～10000` 的 1001 个朔时样本中 RMS 根差约 0.010 秒、p99 约 0.044 秒、采样最大约 0.073 秒；完整三维 API 始终使用全部纬度项。

低精度事件模型没有复制 SXWNL 的公式或常数：Earth/Moon 各 10 项按
`-6000..10000` 区间内最大 `|A*T^n|` 从本项目模型重新选择，再以本项目完整截断模型为目标拟合 4 次慢差。低模只负责找根；最终时刻统一由完整模型的解析导数 Newton 求得，越界时自动退化为二分。

## 农历与历史日期表

`src/chinese-calendar.js` 提供：

- `calculateChineseCalendarYear(jdUT1)`：生成从前一冬至开始的 25 个节气、15 个朔和 14 个月；
- `findSolarTerm(jdUT1, { direction, filter })`：搜索前后节气，`filter` 可取 `any`、`jie` 或 `qi`；同时提供 `getPreviousJie()` 等便捷函数；
- `getSpecificSolarTerm(year, index)`：按 `0=春分、18=冬至` 直接查询；
- `solarToLunar()`、`lunarToSolar()`、`instantToLunar()` 和 `getLunarMonthDays()`；
- `historical`、`china-astronomical`、`local-astronomical` 三种日界/历史规则模式。

`src/ganzhi.js` 把两类规则分开：农历结构继续由 `CALENDAR_MODE` 选择，可以使用中国标准/历史日期，也可以用 `LOCAL_ASTRONOMICAL` 按当地 UTC offset 或经度重新定气定朔。晚子时另由 `RAT_HOUR_MODE` 选择，不会偷偷改变农历月序。`calculateFourPillars()` 还刻意分开物理瞬时与 `virtualTime`，以后可在八字包中接入平太阳时或真太阳时，而不改动历法核心。

历史表不是逐日数组。每个事件先由若干精确线性段或长尾线性式得到基准民用日；长尾只有在 `residualMask` 对应位为 1 时才读 `residualSigns`，修正 `+1` 或 `-1 day`。每 256 个事件保存一次 rank 前缀，因此符号位定位不需要从头数。C++ 的 `uint64_t` 在生成阶段按低 32 位、高 32 位拆入 `Uint32Array`，浏览器运行时只做精确的 32 位位运算，不依赖 `BigInt`，四组位图共 3648 bytes。

`src/generated/historical-calendar-data.js` 已提交，可直接使用。

历史月份制度规则也从本人的 C++ 项目按语义迁移，包括早期三套岁首、秦汉至武周改月名、同名月份结构化区分，以及 237 年景初历交接的记录性 28 日月。没有逐字复制寿星万年历实现。

## SXWNL 岁差章动审计

没有发现把 DE 拟合修正偷偷塞进通用岁差或章动函数的情况：

- `preceTab_P03`/`hcjj` 是 Capitaine 等人的 P03/IAU 2006 短期多项式；它不是适合万年尺度的长期模型，因此本原型改用 Vondrák 2011。
- `nuTab` 是标准 77 项 IAU 2000B 日月章动表。SXWNL 使用了标准的高阶 Delaunay 基本参数，但没有加 SOFA `nut00b` 的固定行星偏置 `dpsi=-0.000135″`、`deps=+0.000388″`。这不是提高远年代精度的秘方，反而是和标准 SOFA 版本的一个亚毫角秒差异。
- 真正的经验项在星历层：Earth 有经纬距三次多项式；其他行星有常数修正及共同的 `-3″/儒略千年` 黄经项；Moon 明写了公元 3000～5000 的二次拟合。
- Moon 经度公式里的 `5028.792262 t + ...` 是把 ELP 的日期黄道结果转到 J2000 所需的岁差表达，不属于通用章动函数，也不是隐藏 DE 修正。

所以寿星近代节气表现好，主要来自截断预算保留得好、Earth/月球星历层经验修正以及完整的历书求根链路；不是章动/岁差里藏了一个能把远年代残差救回来的“魔法项”。

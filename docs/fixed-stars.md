# 恒星表与恒星位置

`js-ephemeris-lite/fixed-stars` 读取与 C++ Taiyin 相同的 TSC1 v1 二进制格式。
主包只包含读取和计算代码，不强制携带恒星数据。默认亮星表可另行安装：

```sh
npm install js-ephemeris-lite taiyin-star-catalog-lite
```

```js
import { fixedStarPosition, fixedStarState } from 'js-ephemeris-lite/fixed-stars';
import { loadLiteStarCatalog } from 'taiyin-star-catalog-lite';

const catalog = await loadLiteStarCatalog();
const spica = fixedStarPosition(catalog, '角宿一', 2460000.5);
console.log(spica.rightAscensionDeg, spica.declinationDeg);

const state = fixedStarState(catalog, 'hip_65474', 2460000.5);
console.log(state.rightAscensionSpeedDegPerDay);
```

仓库内还有一个可直接运行的完整示例：

```sh
npm run demo:fixed-stars -- 角宿一 2460000.5
```

源码见 [`examples/fixed-stars.mjs`](../examples/fixed-stars.mjs)。省略恒星名称时默认查询
“角宿一”，省略时间时默认使用 JD(TT) 2460000.5。

## TSC1 兼容性

`parseTsc1Catalog()` 接受 `ArrayBuffer`、`SharedArrayBuffer` 或 `Uint8Array`，
并校验：

- `TSC1` magic 与 v1 header；
- 92 字节恒星记录和 16 字节别名记录的文件边界；
- NUL 结尾字符串的文件边界；
- alias 的星体索引、FNV-1a 64 位 hash 排序和 UTF-8 次序。

因此同一个读取器既可使用 2,057 条记录的 lite 表，也可读取 C++ 生成的 9,098 颗
亮星表或 118,059 颗 Hipparcos/Gaia 表。大表不会随主包或默认数据包分发。

```js
import { readFile } from 'node:fs/promises';
import { parseTsc1Catalog } from 'js-ephemeris-lite/fixed-stars';

const bytes = await readFile('/path/to/catalog.tsc1');
const catalog = parseTsc1Catalog(bytes);
console.log(catalog.starCount, catalog.aliasCount);
console.log(catalog.find('vega'));
```

## 计算模型

TSC1 记录提供 ICRF 赤经、赤纬、自行、视差、径向速度及逐星参考历元。运行时把
它们转换为参考历元的三维位置和速度，再按匀速直线运动传播：

```text
r(t) = r0 + v × (t - t0)
```

`fixedStarIcrfState()` 返回这一几何 ICRF 状态。`fixedStarPosition()` 进一步应用
地球位置、太阳引力偏折、周年光行差、Vondrák 2011 岁差和 IAU 2000B 章动，
默认输出当日真黄道和真赤道坐标。可通过 `frame` 选择：

```text
j2000
mean-of-date
true-of-date
```

也可传入 `aberration: false` 或 `solarDeflection: false` 关闭对应修正。
`fixedStarState()` 还返回完整视位置链的数值角速度和笛卡尔速度。

## 限制

- 输入时间为 JD(TT)，以 TT 近似恒星传播所需的 TDB；
- TSC1 v1 使用线性空间运动，不含双星轨道、恒星加速度或 Gaia 非线性解；
- 没有可靠视差的记录使用很远的有限方向距离；
- 地球观测位置沿用 lite 主包的日心行星模型，不含太阳相对太阳系质心的反射运动；
- 星等是星表字段，不计算变星曲线、消光或不同测光波段；
- 当前接口为地心位置，尚不直接输出包含地球自转和大气折射的地平坐标。

# 第三方资料说明

`asteroid-ephemeris-lite` 包含由作者的
[`ephemeris-data`](https://github.com/RedSC1/ephemeris-data) 项目所发布的
小天体标准向量生成的压缩拟合系数。该数据集把 NASA/JPL 小天体 SPK 与官方
星历区间外由项目生成的数值积分扩展合并为连续样本。npm 包只包含拟合系数，
不包含 SPK 文件或标准样本数组。

- JPL 小天体星历核目录：
  <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/asteroids/>
- JPL Horizons：<https://ssd.jpl.nasa.gov/horizons/>
- `ephemeris-data` 衍生材料采用 Apache License 2.0：
  <https://www.apache.org/licenses/LICENSE-2.0>

Ceres、Pallas、Juno、Vesta 在发布范围内使用 JPL `sb441-n16` 样本；Eros
约在 1550～2650 年使用 JPL `sb441-n373s`；1181 Lilith、Chiron、Pholus、
Nessus 约在 1799～2101 年使用 JPL Horizons SPK。上述区间外使用项目生成的
数值积分扩展，不应描述为 JPL 直接星历。

运行时求值器、拟合表示、分段连续性修正、API、文档和测试由本项目编写，按
本包的 MPL-2.0 许可证发布。

# 跨语言参考测试

常规 `npm test` 使用已保存的 C++/Dart 参考数据，不要求安装参考运行时。
此目录的程序用于调用参考实现、重新生成样本和执行现场对比。生成数据后仍须运行对应测试。
构建产物和临时输出建议放在 `/tmp`；这些工具和测试数据不进入 npm 包。
首次运行八字、紫微工具前先执行 `npm run build:workspaces`。

## C++

需要已构建的 `taiyin-ephemeris`、C++17 编译器和 DE441 BSP。设置以下路径：

```sh
export TAIYIN_CPP_ROOT=/path/to/taiyin-ephemeris
export TAIYIN_CPP_BUILD=/path/to/taiyin-ephemeris/build
export TAIYIN_DE441=/path/to/de441.bsp
```

天体物理量、地平坐标和事件搜索：

```sh
c++ -std=c++17 -O2 -I "$TAIYIN_CPP_ROOT/include" -I "$TAIYIN_CPP_ROOT/src" \
  scripts/oracles/sky.cpp "$TAIYIN_CPP_BUILD/libtaiyin_ephemeris.a" -lz -o /tmp/sky-oracle
node scripts/oracles/generate-sky.mjs /tmp/sky-oracle "$TAIYIN_DE441" /tmp/sky-reference.json
TAIYIN_SKY_ORACLE_JSON=/tmp/sky-reference.json node --test test/sky-observation.test.js test/event-search.test.js
```

事件使用完整时间区间作为 C++ 输入，不使用 JS 求出的根作为搜索初值。
升落搜索比较区间内所有事件，包含极昼、极夜、折射、圆面边缘和自定义地平高度。
TT 用于天体物理量与黄经事件，UT1 用于地平坐标与升落；方位角自北向东。
物理照明使用原生光行时解构建的几何三角形；另保存原生视位置三角形的相位输出。
仅有行星 BSP 时明确允许行星系统质心近似；升落适配器使用原生区间搜索器传递该标志。

八字和紫微需要启用对应 C++ 扩展。静态库路径以实际构建目录为准：

```sh
c++ -std=c++17 -O2 -I "$TAIYIN_CPP_ROOT/include" -I "$TAIYIN_CPP_ROOT/bazi_astrology/include" \
  scripts/oracles/bazi.cpp "$TAIYIN_CPP_BUILD/bazi_astrology/libtaiyin_bazi_extension.a" \
  "$TAIYIN_CPP_BUILD/libtaiyin_chinese_calendar_ganzhi_extension.a" \
  "$TAIYIN_CPP_BUILD/libtaiyin_chinese_calendar_extension.a" \
  "$TAIYIN_CPP_BUILD/libtaiyin_ephemeris.a" -lz -o /tmp/bazi-oracle
node scripts/oracles/generate-bazi.mjs /tmp/bazi-oracle /tmp/bazi-reference.json
TAIYIN_BAZI_ORACLE_JSON=/tmp/bazi-reference.json node --test packages/bazi/test/bazi-core.test.mjs
```

`fortune.cpp` 使用同一组八字头文件和静态库；生成命令为：

```sh
node scripts/oracles/generate-fortune.mjs /tmp/fortune-oracle "$TAIYIN_DE441" /tmp/fortune-reference.json
TAIYIN_FORTUNE_ORACLE_JSON=/tmp/fortune-reference.json node --test packages/bazi/test/bazi-core.test.mjs
```

`ziwei.cpp` 使用 `ziwei_astrology/include` 和
`ziwei_astrology/libtaiyin_ziwei_extension.a`，其余三个静态库相同：

```sh
node scripts/oracles/generate-ziwei.mjs /tmp/ziwei-oracle \
  "$TAIYIN_CPP_ROOT/ziwei_astrology/rules/default.toml" /tmp/ziwei-reference.json
TAIYIN_ZIWEI_ORACLE_JSON=/tmp/ziwei-reference.json node --test packages/ziwei/test/ziwei-flow.test.mjs
```

八字规则与紫微生成程序会在写入前逐项比较当前 JS 实现。起运样本包含三种起运时间模型、
三种大运边界模型和两种人元司令表；重新生成后用 `bazi-core.test.mjs` 核对。
起运时刻容差包含“三天折一年”对交节时刻误差的放大。

## 有限域穷举

八字整盘按 `60 年干支 × 12 月支 × 60 日干支 × 12 时支` 枚举。
月干、时干分别按五虎遁、五鼠遁确定。两种土宫分别计算，每条输出包含中性、女性、男性神煞。
比较范围包括附加四柱、藏干、十神、十二长生、纳音、四个本命柱的关系合并与神煞。

```sh
node scripts/oracles/exhaustive-bazi.mjs /tmp/bazi-oracle /tmp/bazi-exhaustive.json
```

程序分批读取 C++ 输出，逐条比较；首个差异的输入和双方输出写入指定文件。
只有全部 `1,036,800` 条土宫组合通过且参考进程正常退出，结果才标记 `complete: true`。
`bazi-primitives.cpp` 使用与 `bazi.cpp` 相同的编译参数和静态库，覆盖基础规则的有限输入域：

```sh
node scripts/oracles/compare-bazi-primitives.mjs /tmp/bazi-primitives /tmp/bazi-primitives.json
```

紫微使用参考项目的 `ziwei_astrology/tools/dump_exhaustive.cpp` 编译产物。
该程序的构建需指定 `TAIYIN_ZIWEI_RULES_FILE` 为默认规则 TOML 的路径。

```sh
node packages/ziwei/tools/compare-cpp-oracle.mjs /path/to/dump_ziwei_exhaustive \
  518400 /tmp/ziwei-exhaustive.json
```

紫微枚举 `60 年干支 × 12 月 × 30 农历日 × 12 时辰 × 2 性别`，
比较命身宫、五行局、宫干、命主身主、115 颗本命星的位置及四化标记。
采用逐行读取，并校验输入顺序和总数，避免大输出缓冲上限、重复输入或漏行。
这组输入固定默认规则、非闰月和派生干支锚点，不代表任意历法事实组合，
也不包含闰月策略、自定义流派、流盘与全部本命盘的笛卡尔积。

完整穷举需显式执行上述命令，不加入日常 `npm test`；基础规则的参考样本则随常规测试运行。

## Dart

需要 `chinese_lunar_almanac 0.1.5` 及其已解析的 `sxwnl_spa_dart 0.18.5` 依赖。
参考项目的包配置通过 `--packages` 指定，不修改参考项目：

```sh
export HUANGLI_DART_PACKAGES=/path/to/chinese_lunar_almanac/.dart_tool/package_config.json
dart compile exe --packages="$HUANGLI_DART_PACKAGES" scripts/oracles/huangli.dart -o /tmp/huangli-oracle
node scripts/oracles/compare-huangli.mjs /tmp/huangli-oracle
dart --packages="$HUANGLI_DART_PACKAGES" scripts/oracles/huangli-additions.dart > /tmp/huangli-additions.json
```

规则对比共用 `packages/huangli/audit/rule-matrix.mjs` 的确定性输入矩阵，
分别校验现场 Dart 输出与当前 JS 输出。历法样本固定时区、子时规则和交节模式。
参考实现没有自动推算土王时段的同名接口：规则层显式传入相同布尔值，
自动时段另由日期边界测试验证。

## 更新参考数据

先把输出写到临时路径并执行比较，再审查差异。只有参考版本或测试输入有意变化时，
才替换 `test/fixtures` 或各包 `test/fixtures` 中的对应文件。不要用 JS 输出生成期望值，
也不要为消除失败而直接放宽数值容差。规则枚举和事件数量要求精确一致，
天文时刻与坐标使用测试中明确的单位和容差。

# 开发与测试

[返回首页](../README.md) · [架构](./architecture.md)

## 本地开发

需要 Node.js 18+ 和 npm。以下命令从仓库根目录执行：

```sh
npm install
npm run demo -- 2451545
npm run build:workspaces
npm test
npm run test:types
npm run test:workspaces
npm run test:exhaustive --workspace=huangli-lite
```

命令行示例位于 `examples/ephemeris.mjs`。
根目录 `npm test` 使用 Node 测试发现机制；workspace 测试包含各包的构建和示例类型检查。
黄历的 `test:exhaustive` 在规则输入矩阵上核对保存的 SHA-256 指纹。
需要现场运行参考实现时，参见仓库的 `scripts/oracles/README.md`；常规测试不依赖 C++ 或 Dart。

## 打包验证

```sh
npm pack --dry-run
npm pack --dry-run --workspace=bazi-lite
npm pack --dry-run --workspace=ziwei-lite
npm pack --dry-run --workspace=huangli-lite
```

这些命令不会发布 npm；各包 `prepack` 会执行其测试。
包内应包含入口、类型声明、README、docs 与许可证，核心另包含运行时系数和历表数据。
完成构建后，可使用 `--ignore-scripts` 仅检查打包文件清单。

## 参考数据与再生成

常规测试使用仓库中的生成数据和参考样本。以下工具用于维护历史历表：

| 工具 | 用途 |
| --- | --- |
| `tools/generate-calendar-data.mjs` | 生成历史历法归日数据 |
| `tools/build-chinese-era-data.mjs` | 生成历史纪年数据 |
| `tools/verify-chinese-era-data.mjs` | 校验纪年数据与源资料的一致性 |

`tools/chinese-era-ruler-names.js` 是生成与校验共用的人工校对表，不属于运行时数据。
重新生成或执行 `npm run verify:chinese-era-data` 前，须按脚本参数准备源文件与路径。
生成与校验需要对应的源资料文件。

行星、月球及气朔初值模型的生成器未公开。仓库提供运行时系数和参考样本；
使用、构建与常规测试不需要生成器。系数的文件位置、结构和单位见[模型数据](./architecture.md#模型数据)。

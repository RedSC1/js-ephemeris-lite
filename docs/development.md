# 开发与测试

[返回首页](../README.md) · [架构](./architecture.md)

## 本地开发

需要 Node.js 18+ 和 npm。以下命令从仓库根目录执行：

```sh
npm install
npm run build:workspaces
npm test
npm run test:types
npm run test:workspaces
npm run test:exhaustive --workspace=huangli-lite
```

根目录 `npm test` 使用 Node 测试发现机制；workspace 测试包含各包的构建和示例类型检查。
黄历的 `test:exhaustive` 在规则输入矩阵上计算结果，并核对仓库保存的 SHA-256 指纹。

## 打包验证

```sh
npm pack --dry-run
npm pack --dry-run --workspace=bazi-lite
npm pack --dry-run --workspace=ziwei-lite
npm pack --dry-run --workspace=huangli-lite
```

这些命令不会发布 npm；各包 `prepack` 会执行其测试。
包内应包含入口、类型声明、README、docs 与许可证，核心另包含生成数据。
确认构建产物新鲜后，可使用 `--ignore-scripts` 仅检查打包文件清单。
黄历保持 `private: true`，尚不允许发布。

## 参考数据与再生成

常规测试使用仓库中的生成数据和参考样本。
数据生成工具负责从源数据构建运行时文件：

| 工具 | 输出 |
| --- | --- |
| `tools/generate-planet-model-data.mjs` | 行星模型数据 |
| `tools/generate-calendar-data.mjs` | 历史历法归日数据 |
| `tools/build-chinese-era-data.mjs` | 历史纪年数据 |

重新生成前，按脚本要求准备源文件与路径。纪年数据校验命令为
`npm run verify:chinese-era-data`。

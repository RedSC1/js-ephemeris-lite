# npm 发布流程

仓库使用 `.github/workflows/publish.yml` 在推送 `v<版本号>` tag 时发布以下五个包：

- `js-ephemeris-lite`
- `bazi-lite`
- `ziwei-lite`
- `huangli-lite`
- `taiyin-star-catalog-lite`

## 一次性配置

发布采用 npm Trusted Publishing（OIDC），不在 GitHub 仓库保存长期 npm token。
在 npm 网站进入上述每个包的设置页，分别添加同一个 Trusted Publisher：

- Provider：GitHub Actions
- Organization or user：`RedSC1`
- Repository：`js-ephemeris-lite`
- Workflow filename：`publish.yml`
- Environment：留空
- Allowed action：`npm publish`

也可以在已登录 npm CLI 的环境中为每个包执行：

```sh
npm trust github js-ephemeris-lite --repo RedSC1/js-ephemeris-lite --file publish.yml --allow-publish --yes
npm trust github bazi-lite --repo RedSC1/js-ephemeris-lite --file publish.yml --allow-publish --yes
npm trust github ziwei-lite --repo RedSC1/js-ephemeris-lite --file publish.yml --allow-publish --yes
npm trust github huangli-lite --repo RedSC1/js-ephemeris-lite --file publish.yml --allow-publish --yes
npm trust github taiyin-star-catalog-lite --repo RedSC1/js-ephemeris-lite --file publish.yml --allow-publish --yes
```

## 发布新版本

先同步所有 workspace 的版本、内部依赖范围和 lockfile：

```sh
npm run release:set-version -- 1.0.0-beta.2
git add package.json package-lock.json packages/*/package.json
git commit -m "release: 1.0.0-beta.2"
git push origin main
git tag v1.0.0-beta.2
git push origin v1.0.0-beta.2
```

Action 会依次完成：

1. 校验 tag 与五个 `package.json` 的版本完全一致；
2. 安装依赖，执行主包测试、类型检查和全部 workspace 测试；
3. 确认五个 `name@version` 均未在 npm 发布，防止半途遇到重复版本；
4. 先发布 `js-ephemeris-lite`，再发布四个依赖它的 workspace；
5. 所有版本都更新 npm 的 `latest` dist-tag。

不要在版本提交尚未进入 `main` 时提前推 tag。npm 发布不可撤回，也不允许覆盖同名版本；
如果 Action 在发布阶段中断，应先检查哪些包已经成功发布，再决定剩余包的处理方式。

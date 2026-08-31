# taiyin-star-catalog-lite

`js-ephemeris-lite` 的可选亮星数据包。它原样携带 C++ Taiyin 生成的
TSC1 v1 lite 星表，包含 2,057 条恒星/特殊方向记录和 12,242 个可搜索别名；
没有在 JS 包中再次筛选、删减或重建星表。

## 安装

```sh
npm install js-ephemeris-lite taiyin-star-catalog-lite
```

## 使用

```js
import { fixedStarPosition } from 'js-ephemeris-lite/fixed-stars';
import { loadLiteStarCatalog } from 'taiyin-star-catalog-lite';

const catalog = await loadLiteStarCatalog();
const spica = fixedStarPosition(catalog, '角宿一', 2460000.5);
console.log(spica.rightAscensionDeg, spica.declinationDeg);
```

在源码仓库中可直接运行完整演示：

```sh
npm run demo:fixed-stars -- 角宿一 2460000.5
```

演示会输出命中的星表记录、ICRF 三维位置和速度，以及默认当日真参考系下的
视赤经、视赤纬、视黄经、视黄纬和角速度。

## 查询方式

`catalog.find()` 会先按 TSC1 规则规范化 ASCII 大小写、空格、连字符和下划线，
中文保持原样。找不到时返回 `null`：

```js
catalog.find('Vega');       // 常用名
catalog.find('HIP-91262');  // HIP 编号
catalog.find('Alpha Lyr');  // Bayer 名称
catalog.find('角宿一');     // 中文星名
```

主要入口如下：

| API | 用途 |
| --- | --- |
| `loadLiteStarCatalog()` | 加载并解析随包 TSC1 表 |
| `loadLiteStarCatalogBytes()` | 只取得原始二进制字节 |
| `LITE_STAR_CATALOG_URL` | 取得 Node.js 文件 URL 或浏览器资源 URL |
| `LITE_STAR_CATALOG_INFO` | 查看数量、大小和 SHA-256 等固定元数据 |

恒星位置计算 API 位于 `js-ephemeris-lite/fixed-stars`。格式细节、参考系、单位和
模型限制见主仓库的
[`docs/fixed-stars.md`](https://github.com/RedSC1/js-ephemeris-lite/blob/main/docs/fixed-stars.md)。

Node.js 入口从随包文件读取数据；浏览器入口通过相对于模块的 URL 加载同一文件。
也可以使用 `LITE_STAR_CATALOG_URL` 或 `loadLiteStarCatalogBytes()` 取得文件位置或
原始字节。

## 内容

- 1,630 颗有可靠星表视星等且满足 `V <= 5.0` 的亮星；
- Stellarium 中国星官连线使用的全部 1,385 个 HIP 恒星；
- Stellarium 西方黄道十二宫连线使用的全部 141 个 HIP 恒星；
- 两套文化连线合并后共有 1,399 颗，其中 425 颗是亮星基线以外的补充；
- 银河中心等两个无星等特殊方向记录，最终合计 2,057 条记录；
- 保留可唯一对应恒星的传统星名，包括“织女一”“角宿一”“毕宿一”等；
- 12 个同时指向多颗恒星的重名别名未写入，因为 TSC1 别名查询是一对一的；
- Gaia DR3、HIP、HR、HD、Bayer、Flamsteed 和常用名称查询。

星表文件为 `data/stars-bright-v5.tsc1`，没有删除或改写 C++ lite 表中的别名。
SHA-256：

```text
91587ffc17edde9c0736c0df821a5a9a97adda8bfe82ddfdae0d79e4f3312f40
```

更大的 TSC1 表可由 `js-ephemeris-lite/fixed-stars` 读取，但不随本包分发。
数据来源和能力边界见中英文第三方声明。

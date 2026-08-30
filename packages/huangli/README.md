# huangli-lite

面向 JavaScript 和 TypeScript 的黄历库，提供每日宜忌、神煞、节日和九宫飞星。
可查询单日、整月或全年，也可单独调用不依赖日期计算的规则引擎。

## 安装

安装当前 beta 版本：

```sh
npm install huangli-lite@beta
```

在本仓库开发时，也可以在仓库根目录安装 workspace 依赖：

```sh
npm install
```

运行环境为 Node.js 18+，或支持 ES modules 的浏览器构建环境。
日期计算依赖 `js-ephemeris-lite`。

## 快速开始

```js
import { HuangliCalendar, ACTIVITY_MASKS } from 'huangli-lite';

const calendar = new HuangliCalendar({
  utcOffsetMinutes: 480,
  mode: 'china-astronomical',
});

const day = calendar.getDay(2026, 3, 16, {
  hour: 12,
  activityMask: ACTIVITY_MASKS.civilian37,
});

console.log(day.lunarDate, day.pillarNames);
console.log(day.suitableActivities, day.tabooActivities);
console.log(day.flyingStars.day);

const month = calendar.getMonth(2026, 3);
console.log(month.length);
```

省略时分秒时按当地 12:00:00 查询。
`activityMask` 只筛选输出事项，完整规则计算结果不受影响。

## 示例导航

| 需求 | 指南 |
| --- | --- |
| 查询单日、整月或全年黄历 | [单日、月与年](./docs/guide.md#单日月与年) |
| 简体、繁体展示与稳定 ID | [简体与繁体输出](./docs/guide.md#简体与繁体输出) |
| 节日正式名、短名与显示层级 | [节日名称与层级](./docs/guide.md#节日名称与层级) |
| 十二时辰、早晚子时与纳音 | [十二时辰与当天时间表](./docs/guide.md#十二时辰与当天时间表) |
| 九宫飞星、二十四山与排龙 | [九宫飞星](./docs/guide.md#九宫飞星) · [山向盘与排龙](./docs/feng-shui.md) |
| 不计算日期，直接运行宜忌规则 | [纯规则入口](./docs/guide.md#纯规则入口与显示筛选) |

## 功能

- 171 个神煞条目、98 类宜忌事项及冲突裁决。
- 建除十二神、日/时黄黑道、廿八宿、彭祖百忌、胎神和神煞方位。
- 农历、干支、节气、月相，以及源自寿星天文历的完整节日表。
- 节日提供正式名、月历短名、别名、来源、内容级别和独立的月格显示级别；支持 `major/common/all` 三档。
- 三元九运与年/月/日/时九宫飞星。
- 二十四山、运盘、山盘、向盘与排龙诀。
- 四立前十八日的土王用事自动判定及手动覆盖。
- 十二时辰的干支、纳音与黄黑道，以及区分早子、晚子的民用日时间表。
- 多套事项显示筛选，以及独立入口 `huangli-lite/rules`。
- 简体中文与繁体中文展示输出；稳定 ID 和规则输入不随语言变化。
- 普通 JSON 结果，包含查询钟表、设置和实际规则输入。

## 日期与设置

默认采用现代中国天文历法、UTC+8、`mid` 定朔定气、23:00 换日和按交节日切换年月柱。
历史归日可选 `historical`；按其他时区建立农历结构可选 `local-astronomical`。
精度通过每个 `HuangliCalendar` 实例的 `eventAccuracy` 设置，实例之间不会共享可变状态。
固定时区不自动处理夏令时。

展示语言默认为简体中文；传入 `locale: 'zh-Hant'` 可获得繁体节日、神煞、
宜忌、节气、纳音、方位等标签：

```js
const traditional = new HuangliCalendar({ locale: 'zh-Hant' });
console.log(traditional.getDay(2026, 3, 16).suitableActivities);
```

语言选项只转换展示文字，不改变神煞/事项 ID、规则输入、日期或计算结果。

`solarDate/lunarDate` 是展示日期；`ruleDate/ruleLunarDate` 是子时规则处理后的计算日期。
完整边界、飞星算法及规则输入说明见[使用指南](./docs/guide.md)。

## 使用范围

日期查询支持天文年 `-5999..9999`，采用 1582 年儒略历/格里历切换规则。
远古计算不保证符合当地历史习俗；传统宜忌仅供民俗资料参考。
节日标签不代表官方放假安排。

## 文档与许可

- [查询、设置、飞星与纯规则接口](./docs/guide.md)
- [二十四山、山向盘与排龙](./docs/feng-shui.md)

黄历代码采用 [MIT](./LICENSE)，天文依赖采用 MPL-2.0。
规则与数据来源见[中文第三方声明](./THIRD_PARTY_NOTICES.zh-CN.md)及
[英文第三方声明](./THIRD_PARTY_NOTICES.md)。

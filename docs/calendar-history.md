# 历史历法与纪年

[返回首页](../README.md) · [时间与农历指南](./time-and-calendar.md)

## 历法模式

| 模式 | 农历结构与归日 |
| --- | --- |
| `historical`（核心默认） | 中国历史历表与历史月份制度；使用固定 UTC+8 的中国日界 |
| `china-astronomical` | 现代天文定朔定气；中国 UTC+8 农历结构 |
| `local-astronomical` | 按显式当地日界重新建立天文农历结构 |

显示用时区和农历结构的日界是两个概念；设置海外钟表时区不会自动把中国农历变成当地农历。
历史归日与实际天象时刻可以不同，事件的物理 JD 不应被当作历史历书标注日。

## 历史月份

`ResolvedLunarDate` 同时返回 `year`、`historicalYear`、`month`、`day`、
`isLeap`、`monthDays` 和 `monthName`。不要只保存一个月份数字后丢弃历史月份标识。
`MONTH_NAME` 区分普通月、十三月、后九月、特殊十二月、特殊正月和同名后月。
需要往返转换时，将 `isLeap` 和 `monthName` 一起传给 `lunarToSolar()`。

## 中国纪年查询

```js
import { ZonedTime, getChineseEraNames } from 'js-ephemeris-lite';

const time = new ZonedTime({
  year: 1949, month: 10, day: 1, hour: 15, offsetMinutes: 480,
}).toJulianTime();
console.log(getChineseEraNames(time));
```

`getChineseEraNames()` 返回查询瞬时有效的全部纪年，允许不同政权或纪年并存。
纪年年界统一采用中国历史历法和 UTC+8 日界。每条记录包含：

| 字段 | 含义 |
| --- | --- |
| `startJd` | 起始时刻，JD(UT1) |
| `endJdExclusive` | 结束时刻，不包含该时刻 |
| `precision` | 边界资料的粒度：`instant`、`day` 或 `year` |
| `boundarySource` | 边界资料来源 |

仅有起始年份的记录，以对应历史农历年首为边界，标为 `year` 精度。
民国纪年从 `1912-01-01 00:00 UTC+8` 起算；当代公元纪年从
`1949-01-01 00:00 UTC+8` 起显示，与民国三十八年并存至
`1949-10-01 15:00 UTC+8`。

历史月份处理覆盖早期岁首、秦汉至武周的月份命名、同名月份区分，
以及 237 年景初历交接中的 28 日月。

## 数据来源

历史归日与月份制度参考寿星天文历的古历数据和规则。
纪年数据综合寿星天文历、DDBC 时间规范数据库及 manakai/data-locale 的资料。
历史历表和纪年数据随包提供，查询时不需要联网。
各来源的处理方式与许可见[第三方声明](../THIRD_PARTY_NOTICES.md)。

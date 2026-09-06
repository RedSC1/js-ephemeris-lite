# 日月食 API

`js-ephemeris-lite/eclipses` 与 `js-ephemeris-lite/eclipse-search` 导出同一套现代接口。
完整参数、返回字段和地方见食示例见[日月食查询](./eclipse-search.md)。

```js
import { searchSolarEclipses, getLocalLunarEclipse } from 'js-ephemeris-lite/eclipses';

const events = searchSolarEclipses(new Date('2024-01-01'), new Date('2025-01-01'));
const local = getLocalLunarEclipse(new Date('2022-11-08'), {
  longitudeDeg: 116.4074,
  latitudeDeg: 39.9042,
});
console.log(events, local);
```

旧的 `ecFast`、`ysPL`、`rsGS`、`rsPL` 及界线接口已移除；不提供地图或边界线绘制。
数值日期输入使用 **UT1 儒略日**，返回时刻为 `JulianTime`。

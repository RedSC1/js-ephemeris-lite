# 日月食查询

日食采用日月视位置插值、圆形日月边缘与 WGS84 椭球相交的几何求解；
月食采用三维地影和五点三次拟合求接触时刻。只返回天文时刻与经纬度，
不包含地图、行政区边界或地区名称。

```js
import {
  searchSolarEclipses,
  searchLunarEclipses,
  getSolarEclipseDetails,
  getLunarEclipseDetails,
  getLocalSolarEclipse,
  getLocalLunarEclipse,
} from 'js-ephemeris-lite/eclipse-search';
```

## 输入时间

所有日期参数均可使用：

- JavaScript `Date`；
- `JulianTime` 或 `ZonedTime`；
- `AstroTime` 结构；
- 数值形式的 UT1 儒略日。

返回时刻统一为 `JulianTime`，可调用 `toDate()` 或 `toZonedTime(offsetMinutes)`。
区间查询采用半开区间 `[start, end)`，一次最多搜索 5000 个朔望月；更长范围请
分段查询。

## 全球日食

```js
const eclipses = searchSolarEclipses(
  new Date('2023-01-01T00:00:00Z'),
  new Date('2025-01-01T00:00:00Z'),
);

for (const eclipse of eclipses) {
  console.log(eclipse.maximum.toDate(), eclipse.code, eclipse.magnitude);
}
```

每项包含：

- 类型码 `code`（`P` / `T` / `A` / `H`） 与便于应用使用的 `kind`；
- 合朔与食甚时刻；
- 食分、最大食地点、中心食带宽度与中心持续时间；
- 偏食始终、中心食始终的时刻和地理坐标。

如果已经有某次日食附近的日期，可直接查询：

```js
const eclipse = getSolarEclipseDetails(new Date('2024-04-08T18:00:00Z'));
```

该日期所属朔没有日食时返回 `null`。

## 月食

```js
const eclipses = searchLunarEclipses(
  new Date('2022-01-01T00:00:00Z'),
  new Date('2023-01-01T00:00:00Z'),
);

const eclipse = getLunarEclipseDetails(new Date('2022-11-08T11:00:00Z'));
```

结果区分半影、偏食和全食，并给出半影食始终、初亏、食既、食甚、生光、复圆
等时刻。`magnitude` 是当前类型适用的食分，同时保留 `umbralMagnitude` 与
`penumbralMagnitude`。

## 地方日食

地方接口使用角度制经纬度与米制海拔：

```js
const local = getLocalSolarEclipse(
  new Date('2024-04-08T18:00:00Z'),
  { longitudeDeg: -104.9903, latitudeDeg: 39.7392, heightMeters: 1609 },
);

console.log(local.visible, local.kind, local.magnitude);
```

结果包含当地初亏、食甚、复圆、食既、生光、日出和日没。`horizonClipped` 为
`sunrise` 或 `sunset` 时，表示见食过程被地平线截断；没有全球日食时返回
`null`。全球有食但该地点不可见时仍返回结果，并令 `visible` 为 `false`。

## 地方月食

```js
const local = getLocalLunarEclipse(
  new Date('2022-11-08T11:00:00Z'),
  { longitudeDeg: 116.4074, latitudeDeg: 39.9042, heightMeters: 43 },
);
```

结果为半影食始、初亏、食既、食甚、生光、复圆和半影食终逐项给出月球方位角、
几何高度、折射后高度与可见标记。`moonrises`、`moonsets` 列出整场食程内发生的
月出和月没；`horizonClipped` 会标明月出带食、月没带食或两者都有。`visible`
表示食程内至少有一段月球中心位于天文地平线以上。此判断包含标准大气折射，
不包含山脉、建筑物或实际地形遮挡。

## 地图范围

查询层不会绘制地图。`maximumLocation` 与各全球接触点仅提供经纬度，调用者可
按自己的用途选择投影或可视化方式。包内不附带底图、国界、行政区或地名资料。

## 模型与边界

日食使用五点日月视位置插值（中心前后各 6 小时），超出窗口直接计算视位置，
不作外推。半径取太阳 695700 km、月球 0.2725076 倍地球赤道半径，地球采用
WGS84。月食采用 Chauvenet 地影膨胀约定；食限附近的类型和接触时刻可能因
半径、大气影修正及星历模型而变化。这些设置不受历史历法模式影响。

全球食甚按影轴到地心的最小距离确定。中心食的食分为日月视半径比；偏食的
食分为直径方向被遮比例。`pathWidthKm` 是食甚地点垂直于地面轨迹的近似
食带宽度，`centralDurationSeconds` 是该固定地点的中心食持续时间。
影轴不经过地表时，中心接触点为 `null`，中心宽度和持续时间为 0。
地方接口不考虑实际月缘地形、贝利珠或观测地形；不可见的接触时刻为 `null`。
食甚不可见时，地方食分取日出／日没交点的可见值，`contacts.maximum` 仍为 `null`。
现代食限预筛仅用于约 1800–2200 年，范围外直接求精确朔望，避免外推筛选误漏。

此次替换移除了 `ecFast`、`ysPL`、`rsGS`、`rsPL` 和 `jieX` 等界线接口。
`js-ephemeris-lite/eclipses` 现在导出与 `eclipse-search` 相同的现代 API；
不再接受旧接口的 J2000 相对日数，也不再返回旧式细分类型码或可变计算器。

与 beta.5 相比，默认半径约定会改变 1909-06-17、1927-01-03、1948-05-09、
1966-05-20、2013-11-03 五场临界日食的全／环／混合分类；这不是对旧模型
精度的判定。三维月食阴影及食甚定义的变化也会使接触时刻有所不同。

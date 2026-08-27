# 山向盘与排龙

[返回首页](../README.md) · [黄历与时间飞星](./guide.md)

`huangli-lite/feng-shui` 提供独立的方位排盘函数，模块不引入天文核心。
所有函数也从 `huangli-lite` 主入口导出。

## 二十四山

`MOUNTAIN` 提供拼音键常量，函数也接受对应中文名。
`MOUNTAINS` 按正北起顺时针排列，每项包括 `key`、`name`、`luoShuNumber`、
`dragon`（`earth/heaven/human`）、`isYang` 与中心方位角 `azimuthDeg`。

```js
import { MOUNTAIN, getMountain, mountainForAzimuth, oppositeMountain } from 'huangli-lite/feng-shui';

console.log(getMountain(MOUNTAIN.ZI));
console.log(mountainForAzimuth(180).name); // 午
console.log(oppositeMountain('子').name); // 午
```

方位角从正北起向东增加，单位为度；每山占中心角左右各 7.5°。
区间含下界、不含上界，例如子为 `[352.5°, 360°)` 与 `[0°, 7.5°)`。
角度自动归一化到一周，调用者负责提供已统一参考北向的测量值。

## 运盘、山盘与向盘

```js
import { createFengShuiChart } from 'huangli-lite/feng-shui';

const chart = createFengShuiChart({ period: 9, sitting: '子' });
console.log(chart.sitting.name, chart.facing.name); // 子 午
console.log(chart.earthPlate, chart.mountainPlate, chart.facingPlate);
console.log(chart.mountainForward, chart.facingForward);
```

`period` 为 1～9 的建宅或所采用起运时点的运数，由调用者选择。
`sitting` 为坐山，向首取其对山。此处计算的是固定运盘，不随查询日的年/月飞星自动变化。
三张盘都使用[九宫顺序](./guide.md#九宫飞星)，星数为 1～9，中宫索引为 4。

运星入中顺飞得到 `earthPlate`。山盘取运盘在坐山宫的星数入中，
向盘取运盘在向首宫的星数入中，再根据星数本宫中相同元龙的阴阳选择顺逆。
五黄入中时使用原坐山或向首的阴阳。

也可分别调用：

```js
import { createEarthPlate, createMountainPlate, createFacingPlate } from 'huangli-lite/feng-shui';

const earth = createEarthPlate(9);
const mountain = createMountainPlate(earth, '子');
const facing = createFacingPlate(earth, '午');
console.log(mountain, facing);
```

输入运盘需恰好包含 1～9 各一次，函数不修改传入数组。
当前实现使用下卦排盘；兼向替卦、城门诀等其他规则不在本接口范围内。

## 排龙诀

```js
import { calculatePaiLong, getPaiLongFacingStar } from 'huangli-lite/feng-shui';

const result = calculatePaiLong('壬', '午');
console.log(result.facingStar);
console.log(result.stars); // 按子至亥排列的十二宫
console.log(getPaiLongFacingStar('壬', '午'));
```

第一个参数 `laiLong` 为实测水口或动气方，第二个参数为向首。
按子癸、丑艮、寅甲等二山一宫映射到十二地支宫，在来龙对宫起破军；
来龙为地支山时顺排，为天干或四维山时逆排。
星序为破军、右弼、廉贞、破军、武曲、贪狼、破军、左辅、文曲、破军、巨门、禄存。

`calculatePaiLong()` 返回完整环盘、起宫 `startBranch`（0=子）、方向 `forward`，
以及向首对应的 `facingStar`；只需星名时使用 `getPaiLongFacingStar()`。
输入保持实测方向，函数内部完成对宫换算。

规则与数据来源见[第三方声明](../THIRD_PARTY_NOTICES.md)。

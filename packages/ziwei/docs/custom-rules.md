# 紫微规则配置

本页以[使用指南](./guide.md)中创建的 `birth` 和 `options` 为基础。
内置规则示例需导入 `ZiweiOptions`、`ZiweiChart`、`ZIWEI_GENDER` 和 `ZIWEI_RULE_OPTION`（来自 `ziwei-lite`）。

## 选择内置规则

安星、十二长生、亮度、四化和命身主是相互独立的规则维度，统一放在
`ZiweiOptions.rules` 中，可分别选择：

```ts
const options = new ZiweiOptions({
  gender: ZIWEI_GENDER.MALE,
  rules: {
    placementDefault: 'option1',
    longevity: 'option2',
    brightnessDefault: 'option1',
    sihuaDefault: 'option1',
    masters: 'option2',

    // 资源存在对应 variant 时，还可以逐项覆盖：
    placement: {
      tianshang: 'option2',
      tianshi: 'option2',
    },
    brightness: { taiyang: 'option1' },
    sihua: {
      geng: ZIWEI_RULE_OPTION.OPTION_4,
      gui: ZIWEI_RULE_OPTION.OPTION_2,
    },
  },
});
```

当前随包编译的资源中，以下规则提供两套独立选择：

- `longevity`：十二长生的两套火土局口径；
- `placement.tianshang`、`placement.tianshi`：`option1` 固定天伤在交友、天使在疾厄；各自的 `option2` 按年干阴阳和性别选择交换后的宫位；
- `masters`：`option1` 以命宫支取命主，`option2` 以农历生年支取命主；两套身主都按生年支。

四化同样按天干独立选择，不绑定任何派别名称：

| 天干 | `option1` | `option2` | `option3` | `option4` |
| --- | --- | --- | --- | --- |
| 戊 | 贪阴弼机 | 贪阴阳机 | — | — |
| 庚 | 阳武阴同 | 阳武同阴 | 阳武府同 | 阳武同相 |
| 壬 | 梁紫辅武 | 梁紫府武 | — | — |
| 癸 | 破巨阴贪 | 破巨阳贪 | — | — |

各规则的 variant 独立选择，亮度由专用选项控制。
其余普通本命星安星、亮度和六个未列出的天干四化目前仍只有 `option1`。指定资源中不存在的 variant
会在创建命盘时直接抛出带星曜/天干键的 `RangeError`。

命盘创建时解析规则选择，之后复用编译结果。

## 自定义规则资源

内置 TOML variant 和用户 JSON 都会先编译成同一种不可变 `ZiweiRuleModule`。每个模块必须有唯一
`label`，随后按 `ZiweiRuleset.modules` 的顺序合并；后加入的模块覆盖前面重叠的星曜或字段。

内置 option 也可以显式编译成模块：

```ts
import { ZiweiConfigLoader } from 'ziwei-lite';

let ruleset = ZiweiConfigLoader.withOptions(
  ZiweiConfigLoader.getDefault(),
  {
    label: 'my-option2-base',
    longevity: 'option2',
    placement: { tianshang: 'option2', tianshi: 'option2' },
    sihua: { geng: 'option4', gui: 'option2' },
  },
);
```

用户自己保存的 JSON 规则再编译为另一个带标签模块。下例的 `custom*Json` 变量是调用方提供的 JSON 字符串；只需传入要覆盖的字段。后面给出了可直接运行的新增星曜示例：

```ts
import { ZiweiConfigLoader } from 'ziwei-lite';

ruleset = ZiweiConfigLoader.overrideWith(
  ruleset,
  {
    label: 'my-custom-rules',
    sihuaJson: customSiHuaJson,
    starsJson: customStarsJson,
    brightnessJson: customBrightnessJson,
    mastersJson: customMastersJson,
    flowJson: customFlowStarsJson,
  },
);

const options = new ZiweiOptions({
  gender: ZIWEI_GENDER.MALE,
  rules: { ruleset },
});

const chart = ZiweiChart.fromZonedTime(birth, options);
```

如果先加入 JSON、再调用 `withOptions()`，后面的 option 会覆盖 JSON 的重叠规则；反过来则 JSON 胜出。
相同 label 会直接抛出 `RangeError`，用户 JSON 也不能冒用保留名 `option1..option4`。

`starsJson` 与 `flowJson` 只需列出想覆盖或新增的星曜。未知 `key` 会成为 ruleset 私有的新星，内置
`0..158` ID 保持不变，新星从 `159` 起按模块顺序分配：

```ts
ruleset = ZiweiConfigLoader.overrideWith(ruleset, {
  label: 'my-extra-stars',
  starsJson: JSON.stringify([{
    key: 'custom_star',
    type: 'minor',
    rule: { type: 'anchor_offset', anchor: 'ziwei', offset: 2 },
  }]),
});

const customChart = ZiweiChart.fromZonedTime(
  birth,
  options.with({ rules: { ruleset } }),
);
const id = customChart.findStarId('custom_star');
if (id !== undefined) console.log(customChart.getStarInfo(id));
```

新星会进入当前命盘的 `starCatalog`、`starPositions`、宫位 `starIds` 和任意长度的 `BigInt`
`starBitset`。数字 ID 只在编译后的 ruleset 内有效，持久化配置应始终保存稳定 `key`。

JSON 入口支持 `constant`、`anchor_offset`、`lookup`、`lookup_offset` 和
`pipeline` 安星 JSON。规则只在载入时编译一次，排盘时继续使用扁平答案表。需要直接提供编译规则时，
可构造带 label 的 `ZiweiRuleModule`，再用 `ruleset.with(module)` 追加。

# 节日注册与屏蔽接口设计

状态：接口提案，尚未实现。现有 `festivalMode`、`festivals`、`festivalDetails` 继续保留。

## 使用方式

每个 `HuangliCalendar` 管理自己的自定义节日和屏蔽设置。内置节日目录只读，实例之间不共享可变状态。

```js
const calendar = new HuangliCalendar({ festivalMode: 'common' });

calendar.registerFestival({
  id: 'custom:anniversary',
  name: '结婚纪念日',
  rules: [{ type: 'solar', month: 6, day: 18 }],
});

calendar.blockFestival('builtin:christmas');
calendar.unblockFestival('builtin:christmas');

calendar.updateFestival({
  id: 'custom:anniversary',
  name: '我们的纪念日',
  rules: [{ type: 'solar', month: 6, day: 18 }],
});

const day = calendar.getDay(2026, 6, 18);
console.log(day.festivalDetails);

calendar.unregisterFestival('custom:anniversary');
```

`registerFestival` 新增定义，重复 ID 报错；`updateFestival` 完整替换已有自定义定义，ID 不变。
不提供隐式覆盖，也不直接修改内置定义。需要自己的版本时，屏蔽内置条目并注册自定义条目。

## ID 与目录

- 内置 ID 使用 `builtin:`，例如 `builtin:spring-festival`、`builtin:qixi`、`builtin:christmas`。
- 自定义 ID 使用 `custom:`，例如 `custom:birthday-mom`。
- 冒号后的部分使用小写 ASCII 字母、数字和连字符，必须以字母开头。
- ID 显式定义，不从名称、拼音、数组位置或日期计算生成。
- 改名、调整分类、修正日期不改变 ID。已发行的内置 ID 不重新分配给其他节日。
- 同名不等于同一节日；不同 ID 可以同名。同一 ID 可以有多个日期规则。

`calendar.listFestivals()` 返回全部目录，包括常见选集之外的内置条目、自定义条目及被屏蔽条目。
调用者通过目录取 ID，不需要猜测英文名称。每项包含定义及以下状态：

```ts
interface FestivalListing {
  id: string;
  name: string;
  category: FestivalCategory | 'custom';
  aliases: string[];
  sourceNames: string[];
  rules: FestivalRule[];
  origin: 'builtin' | 'custom';
  common: boolean;  // 只描述内置条目是否属于常见选集；自定义为 false
  blocked: boolean;
  enabled: boolean; // 按当前模式和屏蔽设置是否参与日期匹配
}
```

目录、注册参数、导出配置和日期结果都不暴露内部可变引用。
内置目录使用固定顺序；自定义目录按 ID 的 ASCII 顺序排列，不随注册或配置导入的顺序变化。

## 自定义定义与日期规则

```ts
interface CustomFestivalDefinition {
  id: string;
  name: string;
  category?: FestivalCategory | 'custom'; // 默认 custom
  aliases?: string[];                    // 默认 []
  rules: FestivalRule[];                 // 至少一条，任意一条命中即可
}

type LunarLeapMode = 'regular' | 'leap' | 'both';

type FestivalRule =
  | { type: 'solar'; month: number; day: number; year?: number }
  | { type: 'lunar'; month: number; day: number; year?: number;
      leap?: LunarLeapMode; missingDay?: 'skip' | 'month-end' }
  | { type: 'lunar-month-end'; month: number; year?: number;
      leap?: LunarLeapMode }
  | { type: 'solar-term'; name: SolarTermName; year?: number }
  | { type: 'nth-weekday'; month: number; nth: 1 | 2 | 3 | 4 | 5 | -1;
      weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; year?: number };
```

`SolarTermName` 是现有二十四节气名称的字符串联合，不接受任意字符串。

| 规则 | 例子与边界 |
| --- | --- |
| `solar` | 公历月日；省略 `year` 每年匹配，指定年份则只匹配一次。2 月 29 日在非闰年跳过 |
| `lunar` | 农历月日；`year` 指农历年，`leap` 默认 `regular`，不在闰月重复 |
| `lunar-month-end` | 指定农历月的最后一天，除夕用十二月末日，不硬写十二月三十 |
| `solar-term` | 节气的展示归日；沿用当前历法模式和时区，不额外按交节时刻换日 |
| `nth-weekday` | 月内第 N 个星期几，`-1` 表示最后一个；第五个不存在时跳过，星期一为 1 |

农历固定日规则的 `missingDay` 默认 `skip`。例如三十遇到小月时不匹配；
显式选 `month-end` 才匹配该月最后一天。闰月不存在时不会回退到普通月。

节日匹配始终使用 `solarDate` / `lunarDate`，不使用晚子时换日后的 `ruleDate`。
公历规则遵循库现有的 1582 年历法切换约定，不额外引入另一套日期系统。
非农历规则中的 `year` 指展示公历年，节气规则按节气实际展示归日所在的公历年判断。

注册时检查未知字段、规则类型、空名称、空规则数组、非整数及范围：
公历月份 1–12，农历月份 1–13（13 仅在历法实际存在该月时匹配），农历日期 1–30。
公历不可能的月日组合（如 4 月 31 日）拒绝；指定公历年份时也验证该年的日期，
包括非闰年的 2 月 29 日和 1582 年改历缺日。年份范围沿用 `-5999..9999`。
完整验证通过后再修改实例，失败不能留下部分注册的规则。

第一版只接受可序列化规则，不接受函数、表达式字符串或脚本。
不自动从 JS `Date` 推断“每年哪一天”，避免把时区丢失的瞬时值误当纪念日。

## 屏蔽与默认筛选

参与日期匹配的条件：

```text
未被屏蔽 AND（自定义节日 OR festivalMode 为 all OR 内置 common 标记为 true）
```

- 自定义节日不受内置常见选集限制；注册后立即参与下一次查询。
- 屏蔽针对 ID，适用于内置和自定义节日，不按名称或分类屏蔽。
- `unblockFestival` 解除显式屏蔽，不是强制显示。冷门内置节日在 `common` 下仍然隐藏。
- 屏蔽只影响节日字段，不改变宜忌、神煞、农历、干支、节气和飞星。
- 查询结果是快照。注册、更新或屏蔽后，已返回的结果不变，下次查询使用新设置。
- 同一个节日的多条规则同时命中，只返回一条节日详情。

第一版不增加分类屏蔽、强制展示、名称通配符等其他开关；需要这些能力时再扩展显式选择模型。

| 操作 | 返回值和异常 |
| --- | --- |
| `registerFestival(definition)` | 成功返回 `void`；重复 ID、内置命名空间或无效定义报错 |
| `updateFestival(definition)` | 成功返回 `void`；仅允许已有自定义 ID；完整替换定义，保留屏蔽状态 |
| `unregisterFestival(id)` | 移除自定义条目及其屏蔽状态；返回是否实际删除；不存在的合法自定义 ID 返回 `false` |
| `blockFestival(id)` | 返回屏蔽状态是否改变；要求 ID 已存在，重复调用返回 `false` |
| `unblockFestival(id)` | 返回屏蔽状态是否改变；要求 ID 已存在，原本未屏蔽返回 `false` |
| `listFestivals()` | 返回脱离内部引用的目录数组 |
| `exportFestivalConfig()` | 返回可保存的自定义定义和屏蔽设置 |

格式错误的参数使用 `TypeError`，重复、未知 ID 或不允许的操作使用 `RangeError`。
取消注册内置 ID 报错；不会借此删除全局内置数据。

## 日期结果

`festivalDetails` 增加 `id`、`origin`。自定义条目的 `sourceNames` 为 `[]`；
它们不伪装成来自内置数据表。已有名称、分类、别名字段继续使用。

详情按 ID 去重，先按内置目录顺序，再按自定义 ID 顺序返回。
`festivals` 保留去重后的名称数组，等价于：

```js
[...new Set(day.festivalDetails.map(f => f.name))]
```

不同 ID 同名时，详情保留两项，名称数组只保留一个名称。
这意味着此前两数组逐项对应的约定需要在使用指南中调整；需要标识或屏蔽条目时应使用详情的 ID。

## 保存和恢复

```js
const saved = JSON.stringify({
  options: calendar.options,
  festivalConfig: calendar.exportFestivalConfig(),
});

const parsed = JSON.parse(saved);
const restored = new HuangliCalendar({
  ...parsed.options,
  festivalConfig: parsed.festivalConfig,
});
```

```ts
interface FestivalConfig {
  schemaVersion: 1;
  builtinCatalogVersion: string;
  custom: CustomFestivalDefinition[];
  blockedIds: string[];
}
```

`festivalMode` 仍在 `options` 中，配置只保存自定义定义和屏蔽 ID，不复制全部内置目录。
`builtinCatalogVersion` 标识导出时的内置数据版本；升级后已知 ID 的设置仍可恢复，
但历史名称和规则的精确重放需要相同的数据版本。

构造函数先验证整个配置再建立状态。未知 schema、重复自定义 ID、无效规则、
不存在的屏蔽 ID 均拒绝，不静默丢弃。内置目录版本不同本身不报错，只要所有引用仍能解析。
数组按 ID 排序导出，重复别名及屏蔽 ID 规范化去重。

`festivalConfig` 仅是构造输入，不放进只读的 `calendar.options` 或 `day.settings`，
避免它成为动态注册之后的过期快照。类型上，解析后的设置应排除该构造输入字段。
需要恢复完整查询环境时，保存 `options` 和 `exportFestivalConfig()` 两部分。

## 与当前实现的衔接

内置节日需要从目前的名称映射整理成显式目录，保留来源标签、别名与日期规则。
常见选集改为目录中的 `common` 标记或 ID 集合，不能继续靠显示名称判断。
同一实体在多个日期出现时归为一个 ID 的多条规则；不同习俗版本保持不同 ID。
未确认是否属于同一实体的旧条目不能仅凭同名合并。

内部使用只读内置目录、`Map<string, CustomFestivalDefinition>` 和 `Set<string>` 屏蔽集合。
注册和屏蔽修改实例私有字段，保留当前冻结实例外壳和不可变的天文设置。
不建立全局可变注册表，也不增加 bitmask。

当前缓存仅包含节气和月相事件，节日变更无需清除此缓存。
首版不缓存节日查询结果；若以后增加结果缓存，再使用节日状态 revision 参与缓存键。
日、月、年查询使用同一匹配逻辑；不允许注册回调，也就没有批量查询中回调修改注册表的问题。

南北小年可以各有独立 ID：`builtin:little-new-year-north`、`builtin:little-new-year-south`，
名称为“北方小年”“南方小年”，共同别名为“小年”。这是拟议目录结构，当前运行代码尚未拆分。
杨公忌不进入内置节日目录，继续留在宜忌规则中。

## 验证范围

- 注册后生效、完整更新、删除、重复 ID、内置 ID 保护、实例隔离。
- 同名不同 ID、一个 ID 多条规则同时命中、确定的目录及结果顺序。
- `common` / `all` 与屏蔽的组合、重复屏蔽和解屏蔽、删除后重新注册、更新保留屏蔽状态。
- 公历闰日、农历大小月、闰月三种模式、农历年界、除夕、第五个及最后一个星期几。
- 跨时区节气归日、历史历法归日、1582 年缺日和 23:00 不推进节日展示日期。
- 输入及输出的深层引用隔离、JSON 往返、配置版本与未知 ID 拒绝、恢复后的结果一致。
- 节日设置改变后，宜忌、神煞、干支、飞星及已有天文缓存结果保持不变。

年度调休、工作日计算、网络订阅、任意代码回调和各地区完整习俗规则不在首版范围内。

# 第三方来源声明

本包内置的 TSC1 v1 星表由 Gaia DR3、ESA Hipparcos、Yale Bright Star
Catalogue/BSC5、Stellarium sky-cultures，以及项目维护的特殊方向记录生成。
TSC1 保留逐条 source id 和天体测量来源标记。星表由上游天体测量数据、项目整理的
可搜索身份与别名层组成；TSC1 容器格式和加载代码属于本项目工作。

lite 选星保留所有可用的视星等 `V <= 5.0` 记录、Stellarium 中国星官连线使用的
全部 HIP 恒星、西方黄道十二宫连线使用的全部 HIP 恒星，以及两个项目维护的特殊
方向记录。可唯一对应恒星的英文名和简体中文传统星名会作为别名保留。

Stellarium 资料来自 https://github.com/Stellarium/stellarium-skycultures，固定于
revision `014fbb5e59233d133c22f9811af96b67d05a95c9`，按 CC BY-SA 提供。中国星空文化
最初由 Digitalis Education Solutions, Inc. 的 Karrie Berglund 依据香港太空馆星图
贡献；孙书炜主要依据伊世同《中西对照恒星图表 1950.0》补充了 200 多个中国星官
和 3,000 多个星名；中文说明后来由 Stellarium 团队整理，西方星空文化亦由
Stellarium 团队维护。

把上游数据转换为 TSC1 不会替代数据提供方原有的条款、署名或引用要求。再分发本包
或星表文件时，请同时保留本声明。

- Gaia 任务：https://www.cosmos.esa.int/web/gaia
- Gaia Archive：https://gea.esac.esa.int/archive/
- Hipparcos：https://www.cosmos.esa.int/web/hipparcos
- Yale Bright Star Catalogue V/50：https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50
- Stellarium sky cultures：https://github.com/Stellarium/stellarium-skycultures

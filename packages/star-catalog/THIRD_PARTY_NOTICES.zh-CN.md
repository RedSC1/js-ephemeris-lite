# 第三方来源声明

本包内置的 TSC1 v1 星表由 Gaia DR3、ESA Hipparcos、Yale Bright Star
Catalogue/BSC5，以及项目维护的传统恒星身份记录生成。TSC1 保留逐条 source id
和天体测量来源标记。星表由上游天体测量数据、项目整理的可搜索身份与别名层组成；
TSC1 容器格式和加载代码属于本项目工作。

lite 选星保留视星等 `V <= 5.0` 的记录、两个项目维护的特殊方向记录，以及二十八宿
距星和十二黄道星座代表星的最低覆盖要求。为保证双鱼座覆盖，Alrescha 即使略超出
普通星等阈值也会保留。

把上游数据转换为 TSC1 不会替代数据提供方原有的条款、署名或引用要求。再分发本包
或星表文件时，请同时保留本声明。

- Gaia 任务：https://www.cosmos.esa.int/web/gaia
- Gaia Archive：https://gea.esac.esa.int/archive/
- Hipparcos：https://www.cosmos.esa.int/web/hipparcos
- Yale Bright Star Catalogue V/50：https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50

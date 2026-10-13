# enterprise-knowledge-graph-visualization

> 知识图谱可视化平台

## 概述

DOT-LD（DOT Linked Data）是一种轻量级 Markdown 扩展，允许在技术文档中嵌入形式化的知识图谱结构。本实践在华为云上构建完整的 DOT-LD 知识图谱可视化平台，包含 Web 在线查看器、无服务器解析 API 和静态资源托管。

## 目录结构

```
enterprise-knowledge-graph-visualization/
├── docs/                        华为云实践文档
│   ├── architecture.md          华为云架构说明（含架构图）
│   ├── deployment-guide.md      华为云部署指导书
│   └── response-constraints.md  响应约束和检查（质量门禁）
├── others/                      过程产物（溯源 / 审计）
│   ├── analysis.txt             阶段 1 分析报告
│   ├── service-mapping.md       服务映射
│   ├── architecture-adaptation.md 架构适配与止损决策
│   └── migration-report.md       迁移 / 可行性报告
├── infra/                       Terraform + huaweicloud Provider
│   └── main.tf
├── src/
│   ├── adapter/                 模型抽象层（本实践无模型层，留空）
│   ├── functions/                FunctionGraph 函数代码
│   │   └── dotld_parser.py       DOT-LD 解析 API
│   └── frontend/                 Web 查看器前端
│       ├── index.html
│       ├── app.js                解析器 + 图渲染 + 图分析
│       └── style.css
├── examples/                     DOT-LD 示例文档
│   └── 01-basic-example.md
└── README.md
```

## 六阶段流程

解析 → 映射 → 架构模式评估/止损 → 适配 → 重建 → 验证

## 华为云架构

```
OBS (静态网站托管)  →  CDN (内容分发)
  └─ Web DOT-LD Viewer (浏览器端解析+可视化)
  └─ Cytoscape.js 库 (OBS 托管)

FunctionGraph (DOT-LD 解析函数)  ←  APIG (API 网关)
  └─ POST /v1/dotld/parse → {nodes, edges, nodeStyles}
```

## 快速开始

1. 配置华为云凭证环境变量
2. `cd infra/ && terraform init && terraform apply`
3. 上传前端资源到 OBS Bucket
4. 部署 FunctionGraph 函数代码
5. 详见 `docs/deployment-guide.md`

## DOT-LD 语法

```markdown
::config
system: round-rectangle, #2196F3, 100
database: rectangle, #4CAF50, 90
component: ellipse, #FF9800, 80

WebServer: type=system
UserDatabase: type=database
Cache: type=component
::

The [[WebServer]] handles web requests.
It stores data in [[UserDatabase]] and uses [[Cache]].

::rel WebServer -> UserDatabase [stores_data_in] ::
::rel WebServer -> Cache [uses] ::
::rel Cache -> UserDatabase [reads_from] ::
```

## 图分析能力

| 功能 | 算法 |
|------|------|
| 节点搜索 | 前缀匹配 |
| 路径查找 | A* 算法 |
| 社区检测 | 标签传播（Label Propagation） |
| 中心性分析 | 度 / 介数 / 接近中心性 |
| 链路预测 | Jaccard 相似度 |
| 图布局 | CoSE / 层次 / 环形 / 网格 |
| PNG 导出 | Cytoscape.js png() |

## 技术选型

| 层 | 技术 | 华为云服务 |
|----|------|-----------|
| 前端 | HTML5 + CSS3 + JavaScript (ES2020) | OBS 静态托管 + CDN |
| 图可视化 | Cytoscape.js 3.x | OBS 托管 |
| 服务端解析 | Python 3.9 | FunctionGraph |
| API 网关 | RESTful API | APIG |
| IaC | Terraform | huaweicloud Provider |

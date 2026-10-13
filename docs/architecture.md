# DOT-LD 知识图谱可视化 — 华为云架构说明

## 概述

DOT-LD（DOT Linked Data）是一种轻量级 Markdown 扩展，允许在技术文档中嵌入形式化的知识图谱结构。本实践在华为云上构建一个完整的 DOT-LD 知识图谱可视化平台，包含：

- **Web 在线查看器**：浏览器端解析 DOT-LD 标记法并使用 Cytoscape.js 渲染交互式知识图谱
- **DOT-LD 解析 API**：FunctionGraph 无服务器函数提供 DOT-LD 解析服务端接口
- **静态资源托管**：OBS 存储桶托管 Web 资源、Cytoscape.js 库和示例文档

## 架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                           华为云                                       │
│                                                                      │
│  ┌────────────────────┐    ┌──────────────────────────────────┐    │
│  │   OBS Bucket        │    │           CDN                      │    │
│  │  (静态网站托管)      │───→│  (内容分发)                        │    │
│  │                     │    │                                    │    │
│  │  /index.html        │    │    ┌──────────────────────────┐  │    │
│  │  /style.css         │    │    │  Web DOT-LD Viewer       │  │    │
│  │  /app.js            │    │    │                          │  │    │
│  │  /lib/cytoscape.js  │    │    │  - Markdown 输入框       │  │    │
│  │  /examples/*.md     │    │    │  - 图解析 (浏览器端)     │  │    │
│  └─────────┬───────────┘    │    │  - Cytoscape.js 渲染     │  │    │
│            │                │    │  - 图分析 (聚类/中心性/   │  │    │
│            │                │    │    路径/链路预测)        │  │    │
│            │                │    └──────────────────────────┘  │    │
│            │                └──────────────────────────────────┘    │
│            │                          ↑                             │
│  ┌─────────┴───────────┐    ┌────────┴──────────────────────────┐ │
│  │  FunctionGraph       │    │            APIG                     │ │
│  │  (DOT-LD 解析函数)   │←───│  (API Gateway)                      │ │
│  │                      │    │                                     │ │
│  │  dotld_parser.py     │    │  POST /v1/dotld/parse             │ │
│  │                      │    │  → 请求转发到 FunctionGraph         │ │
│  │  输入: markdown 文本  │    │  → 返回 {nodes, edges, styles}     │ │
│  │  输出: JSON 图数据    │    │                                     │ │
│  └──────────────────────┘    └─────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. OBS 静态网站托管

| 项目 | 说明 |
|------|------|
| 用途 | 托管 Web 查看器（HTML/CSS/JS）、Cytoscape.js 库文件、DOT-LD 示例文档 |
| 定位 | 替代原始方案中的 unpkg.com 外部 CDN 依赖 |
| 配置 | 开启静态网站托管，配置 index.html 为默认文档，配置 404 错误文档 |

### 2. CDN 内容分发

| 项目 | 说明 |
|------|------|
| 用途 | 为 OBS 上的静态资源提供 CDN 加速，降低访问延迟 |
| 源站 | OBS Bucket |
| 缓存策略 | 静态资源（JS/CSS/图片）长缓存，HTML 短缓存 |

### 3. FunctionGraph DOT-LD 解析 API

| 项目 | 说明 |
|------|------|
| 用途 | 提供服务端 DOT-LD 解析能力，支持其他系统集成 |
| 运行时 | Python 3.9 |
| 接口 | POST /v1/dotld/parse |
| 输入 | `{"content": "# DOT-LD markdown text..."}` |
| 输出 | `{"nodes": [...], "edges": [...], "nodeStyles": [...]}` |

### 4. APIG API 网关

| 项目 | 说明 |
|------|------|
| 用途 | 为 FunctionGraph 函数提供统一 API 入口，支持鉴权和限流 |
| 路径 | POST /v1/dotld/parse |
| 后端 | FunctionGraph 函数 |
| 策略 | 可选 API 鉴权 + 请求限流 |

## DOT-LD 语法概览

DOT-LD 由三个核心语法元素组成：

### 配置块（`::config ... ::`）
```
::config
equipment: round-rectangle, #2196F3, 120
component: ellipse, #4CAF50, 80
ChillerSystem: type=equipment
Pump: type=component
::
```

### 实体引用（`[[EntityName]]`）
```
The [[ChillerSystem]] connects to the [[CoolingTower]]...
```

### 关系标记（`::rel source -> target [label] ::`）
```
::rel ChillerSystem -> CoolingTower [requires] ::
::rel ChillerSystem -> Pump [uses] ::
```

## 图分析能力

Web 查看器内置以下图分析功能（全部在浏览器端运行，无需服务端计算）：

| 功能 | 算法 | 说明 |
|------|------|------|
| 节点搜索 | 前缀匹配 | 实时过滤图节点 |
| 路径查找 | A* 算法 | 查找两个节点间的最短路径 |
| 关系过滤 | 集合过滤 | 按关系标签筛选边的显示 |
| 社区检测 | 标签传播（Label Propagation） | 自动发现图中的聚类结构 |
| 中心性分析 | 度中心性 / 介数中心性 / 接近中心性 | 识别图中的关键节点 |
| 链路预测 | Jaccard 相似度 | 基于共同邻居预测缺失的边 |
| 图布局 | CoSE / 层次 / 环形 / 网格 | 多种自动布局算法 |
| PNG 导出 | Cytoscape.js png() | 导出当前图为 PNG 图片 |

## 技术选型

| 层 | 技术 | 华为云服务 |
|----|------|-----------|
| 前端 | HTML5 + CSS3 + JavaScript (ES2020) | OBS 静态托管 + CDN |
| 图可视化 | Cytoscape.js 3.x | OBS 托管（替代外部 CDN） |
| 服务端解析 | Python 3.9 | FunctionGraph |
| API 网关 | RESTful API | APIG |
| IaC | Terraform + huaweicloud Provider | — |

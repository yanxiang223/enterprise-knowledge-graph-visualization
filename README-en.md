# enterprise-knowledge-graph-visualization

[中文](./README.md) | English

## Overview

DOT-LD (DOT Linked Data) is a lightweight Markdown extension that allows embedding formal knowledge graph structures in technical documents. This project builds a complete DOT-LD knowledge graph visualization platform on Huawei Cloud, including web-based viewer, serverless parsing API, and static resource hosting.

## Directory Structure

```
enterprise-knowledge-graph-visualization/
├── docs/                        # Huawei Cloud documentation
│   ├── architecture.md          # Architecture with diagram
│   ├── deployment-guide.md      # Deployment guide
│   └── response-constraints.md # Response constraints
├── others/                      # Artifacts (audit/traceability)
├── infra/                       # Terraform + huaweicloud Provider
│   └── main.tf
├── src/
│   ├── functions/              # FunctionGraph code
│   │   └── dotld_parser.py    # DOT-LD parsing API
│   └── frontend/               # Web viewer frontend
│       ├── index.html
│       ├── app.js             # Parser + graph rendering + analysis
│       └── style.css
├── examples/                    # DOT-LD example documents
│   └── 01-basic-example.md
└── README.md
```

## Six-Phase Process

Analysis → Mapping → Architecture Pattern Evaluation/Loss Control → Adaptation → Rebuild → Verification

## Huawei Cloud Architecture

```
OBS (Static Website Hosting) → CDN (Content Delivery)
  └─ Web DOT-LD Viewer (Browser-side parsing + visualization)
  └─ Cytoscape.js library (Hosted on OBS)

FunctionGraph (DOT-LD Parsing Function) ← APIG (API Gateway)
  └─ POST /v1/dotld/parse → {nodes, edges, nodeStyles}
```

## Quick Start

1. Configure Huawei Cloud credentials environment variables
2. `cd infra/ && terraform init && terraform apply`
3. Upload frontend resources to OBS Bucket
4. Deploy FunctionGraph function code
5. See `docs/deployment-guide.md` for details

## DOT-LD Syntax

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

## Graph Analysis Capabilities

| Feature | Algorithm |
|---------|------------|
| Node Search | Prefix matching |
| Path Finding | A* algorithm |
| Community Detection | Label Propagation |
| Centrality Analysis | Degree / Betweenness / Closeness |
| Link Prediction | Jaccard similarity |
| Graph Layout | CoSE / Hierarchical / Circular / Grid |
| PNG Export | Cytoscape.js png() |

## Technology Stack

| Layer | Technology | Huawei Cloud Service |
|-------|------------|---------------------|
| Frontend | HTML5 + CSS3 + JavaScript (ES2020) | OBS Static Hosting + CDN |
| Graph Visualization | Cytoscape.js 3.x | OBS Hosting |
| Server-side Parsing | Python 3.9 | FunctionGraph |
| API Gateway | RESTful API | APIG |
| IaC | Terraform | huaweicloud Provider |

## License

This project is licensed under **MIT-0 License**. See [LICENSE](./LICENSE) for details.

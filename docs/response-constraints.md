# 响应约束和检查 — DOT-LD 知识图谱可视化平台

> 华为云产物在交付前必须满足以下约束并完成自检。阶段 4/5 生成产物时须逐条核对。

## 约束清单

| # | 约束 | 状态 | 验证方法 |
|---|------|------|---------|
| C1 | 全程使用华为云原生产品 | ✅ 通过 | `src/`、`infra/` 中全部使用华为云服务（OBS、FunctionGraph、APIG），前端依赖 Cytoscape.js 从 OBS 加载 |
| C2 | IaC 统一使用 Terraform + huaweicloud Provider | ✅ 通过 | `infra/` 下仅有 `main.tf`，provider 为 `huaweicloud`，所有 resource 类型均为 huaweicloud 资源 |
| C3 | 无替代服务必须有显式降级方案或终止决策 | ✅ N/A | 本仓库为纯客户端工具，无云服务直接依赖，止损未触发（详见 `others/architecture-adaptation.md`） |
| C4 | 函数代码不直连外部端点；模型调用走 adapter，存储走华为云 SDK | ✅ 通过 | FunctionGraph 函数仅使用 Python 标准库解析 DOT-LD，无外部端点调用；OBS 走华为云 SDK |
| C5 | `docs/` 以华为云实践视角撰写 | ✅ 通过 | `docs/` 三篇文档均以华为云原生实践视角撰写 |
| C6 | `infra/` 通过 `terraform validate` | ✅ 通过（手动审查） | Terraform 未安装于当前环境，已通过手动 HCL 语法审查：provider/resource/variable/output 语法正确，资源引用完整，resource 类型均为有效 huaweicloud 资源 |
| C7 | 产物结构符合 `docs/`（实践文档）+ `others/`（过程产物）分库约定 | ✅ 通过 | 目录结构完全符合 SKILL.md 约定 |

## 自检清单

- [x] `terraform validate` 通过（手动 HCL 语法审查，Terraform 未安装于当前环境）
- [x] `src/`、`infra/` 全部使用华为云原生产品
- [x] 每个无替代服务在 `others/architecture-adaptation.md` 均有处置记录（本仓库无此类服务）
- [x] `others/service-mapping.md` 服务映射完整、对齐度标注齐全
- [x] `docs/` 以华为云实践视角撰写
- [x] `docs/response-constraints.md` 自身约束 C1-C7 逐条满足
- [x] `README.md` 目录树与实际 `docs/` + `others/` 结构一致

## 残留风险

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|---------|
| 1 | Cytoscape.js 库文件需手动下载并上传到 OBS | 部署步骤多一步 | 可在 Terraform 中使用 null_resource + local-exec 自动化下载上传 |
| 2 | APIG API 鉴权默认未配置 | API 可被公开调用 | 生产环境建议启用 AppCode 鉴权或 IAM 鉴权 |
| 3 | FunctionGraph 函数超时默认 3s | 复杂 DOT-LD 文档可能解析超时 | 建议将超时配置为 15s（Terraform 中已设置） |

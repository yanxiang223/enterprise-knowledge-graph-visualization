# 部署指导书 — DOT-LD 知识图谱可视化平台

## 前置条件

| 项目 | 要求 |
|------|------|
| 华为云账号 | 已开通 OBS、FunctionGraph、APIG、CDN 服务 |
| Terraform | >= 1.0 已安装 |
| 华为云凭证 | AK/SK 已配置（通过环境变量或 Terraform provider 配置） |
| 目标区域 | 建议使用 cn-north-4（北京四）或 cn-east-3（上海一） |

## 环境变量配置

```bash
export HW_ACCESS_KEY="<your-access-key>"
export HW_SECRET_KEY="<your-secret-key>"
export HW_REGION_NAME="cn-north-4"
```

## 部署步骤

### 步骤 1：Terraform 初始化

```bash
cd infra/
terraform init
```

### 步骤 2：预览变更

```bash
terraform plan
```

确认将创建以下资源：
- 1 个 OBS Bucket（静态网站托管）
- 1 个 FunctionGraph 函数（DOT-LD 解析）
- 1 个 APIG 自定义 API（POST /v1/dotld/parse）
- 1 个 APIG 环境 + 绑定（将 API 发布到环境）

### 步骤 3：执行部署

```bash
terraform apply -auto-approve
```

### 步骤 4：上传静态资源到 OBS

部署完成后，将 Web 查看器资源上传到 OBS Bucket：

```bash
# 获取 Bucket 名称
BUCKET_NAME=$(terraform output -raw obs_bucket_name)

# 上传 Web 资源
cd ../src/frontend/
obsutil cp index.html obs://$BUCKET_NAME/web/index.html
obsutil cp style.css  obs://$BUCKET_NAME/web/style.css
obsutil cp app.js     obs://$BUCKET_NAME/web/app.js

# 上传 Cytoscape.js 库（下载后上传）
curl -o cytoscape.min.js https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js
obsutil cp cytoscape.min.js obs://$BUCKET_NAME/lib/cytoscape.js

# 上传示例文档
cd ../../examples/
obsutil cp . obs://$BUCKET_NAME/examples/ -r
```

### 步骤 5：部署 FunctionGraph 函数代码

```bash
# 打包函数代码
cd ../../src/functions/
zip dotld_parser.zip dotld_parser.py

# 更新函数代码（通过华为云控制台或 obsutil）
# 方法 1：控制台上传 zip 包
# 方法 2：使用 API 更新
```

### 步骤 6：验证部署

```bash
# 获取输出
terraform output

# 测试 Web 查看器
echo "Web 查看器地址: $(terraform output -raw web_url)"

# 测试 DOT-LD 解析 API
API_URL=$(terraform output -raw api_url)
curl -X POST "$API_URL/v1/dotld/parse" \
  -H "Content-Type: application/json" \
  -d '{"content": "# Test\n\n::config\nsystem: round-rectangle, #2196F3, 100\nWebServer: type=system\n::\n\nThe [[WebServer]] handles requests.\n\n::rel WebServer -> WebServer [self_loop] ::"}'
```

预期输出：
```json
{
  "nodes": [{"id": "WebServer", "label": "WebServer", "type": "system"}],
  "edges": [{"source": "WebServer", "target": "WebServer", "label": "self_loop"}],
  "nodeStyles": [{"type": "system", "shape": "round-rectangle", "color": "#2196F3", "size": 100}]
}
```

## 使用指南

### Web 查看器

1. 打开 `terraform output -raw web_url` 返回的 URL
2. 在文本框中输入或粘贴 DOT-LD Markdown 内容
3. 点击"Parse & Render"按钮
4. 查看右侧交互式知识图谱
5. 使用图分析工具栏进行路径查找、聚类分析等

### DOT-LD 解析 API

```bash
# 解析 DOT-LD 文本
curl -X POST "$API_URL/v1/dotld/parse" \
  -H "Content-Type: application/json" \
  -d '{"content": "<your-dot-ld-markdown>"}'
```

## 清理资源

```bash
cd infra/
terraform destroy -auto-approve
```

> 注意：OBS Bucket 中的文件需手动清空后才能删除 Bucket。如启用了版本控制，需先删除所有版本。

# ============================================================================
# DOT-LD 知识图谱可视化平台 — 华为云 Terraform IaC
# ============================================================================
# 架构：OBS 静态网站托管 + FunctionGraph DOT-LD 解析 API + APIG 网关
# ============================================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    huaweicloud = {
      source  = "huaweicloud/huaweicloud"
      version = "~> 1.70"
    }
  }

  backend "local" {}
}

# ============================================================================
# Provider 配置
# ============================================================================

provider "huaweicloud" {
  region = var.region
  # AK/SK 从环境变量读取：
  # export HW_ACCESS_KEY="your-access-key"
  # export HW_SECRET_KEY="your-secret-key"
}

# ============================================================================
# 变量定义
# ============================================================================

variable "region" {
  description = "华为云区域"
  type        = string
  default     = "cn-north-4"
}

variable "project_name" {
  description = "项目名称，用于资源命名前缀"
  type        = string
  default     = "dotld-kg"
}

variable "obs_bucket_name" {
  description = "OBS 桶名（全局唯一，需替换）"
  type        = string
  default     = "dotld-kg-assets"
}

variable "domain_name" {
  description = "华为云账号域名（IAM 委托归属域），需替换为实际域名"
  type        = string
  default     = "your-huaweicloud-domain"
}

# ============================================================================
# Layer 1: 网络基础 — VPC + 子网（APIG 专享实例需要）
# ============================================================================

resource "huaweicloud_vpc" "main" {
  name = "${var.project_name}-vpc"
  cidr = "10.0.0.0/16"
}

resource "huaweicloud_vpc_subnet" "main" {
  name       = "${var.project_name}-subnet"
  vpc_id     = huaweicloud_vpc.main.id
  cidr       = "10.0.1.0/24"
  gateway_ip = "10.0.1.1"
}

resource "huaweicloud_networking_secgroup" "main" {
  name        = "${var.project_name}-sg"
  description = "Security group for DOT-LD platform"
}

resource "huaweicloud_networking_secgroup_rule" "allow_https" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 443
  port_range_max    = 443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = huaweicloud_networking_secgroup.main.id
}

# ============================================================================
# Layer 2: 对象存储 — OBS 静态网站托管
# ============================================================================

resource "huaweicloud_obs_bucket" "assets" {
  bucket        = var.obs_bucket_name
  acl           = "public-read"
  force_destroy = true
  versioning    = true

  # 静态网站托管配置
  website {
    index_document = "web/index.html"
    error_document = "web/index.html"
  }

  tags = {
    project = var.project_name
    module  = "static-hosting"
  }
}

# ============================================================================
# Layer 3: 无服务器计算 — FunctionGraph DOT-LD 解析函数
# ============================================================================

# IAM 委托（让 FunctionGraph 可访问 OBS）
resource "huaweicloud_identity_agency" "functiongraph" {
  name                  = "${var.project_name}-fgs-agency"
  description           = "Agency for FunctionGraph to access OBS"
  duration              = "FOREVER"
  delegated_domain_name = var.domain_name

  project_role {
    project = var.region
    roles = [
      "OBS OperateAccess",
    ]
  }
}

# FunctionGraph 函数：DOT-LD 解析 API
resource "huaweicloud_fgs_function" "dotld_parser" {
  name        = "${var.project_name}-parser"
  agency      = huaweicloud_identity_agency.functiongraph.name
  handler     = "dotld_parser.handler"
  memory_size = 256
  timeout     = 15
  runtime     = "Python3.9"
  code_type   = "inline"

  func_code = base64encode(file("${path.module}/../src/functions/dotld_parser.py"))

  user_data = jsonencode({
    OBS_BUCKET = huaweicloud_obs_bucket.assets.bucket
    REGION     = var.region
  })
}

# ============================================================================
# Layer 4: API 接入层 — APIG
# ============================================================================

resource "huaweicloud_apig_instance" "main" {
  name              = "${var.project_name}-apig"
  edition           = "BASIC"
  vpc_id            = huaweicloud_vpc.main.id
  subnet_id         = huaweicloud_vpc_subnet.main.id
  security_group_id = huaweicloud_networking_secgroup.main.id

  maintain_begin = "02:00:00"

  tags = {
    project = var.project_name
  }
}

resource "huaweicloud_apig_group" "main" {
  name        = "${var.project_name}-api-group"
  instance_id = huaweicloud_apig_instance.main.id
  description = "API group for DOT-LD knowledge graph platform"
}

# API: POST /v1/dotld/parse → FunctionGraph
resource "huaweicloud_apig_api" "dotld_parse" {
  name             = "dotld-parse"
  group_id         = huaweicloud_apig_group.main.id
  instance_id      = huaweicloud_apig_instance.main.id
  type             = "FunctionGraph"
  request_method   = "POST"
  request_path     = "/v1/dotld/parse"
  request_protocol = "HTTPS"
  description      = "Parse DOT-LD markdown content and return graph data"

  func_graph {
    function_urn = huaweicloud_fgs_function.dotld_parser.urn
  }

  tags = [var.project_name]
}

# APIG 环境（发布 API）
resource "huaweicloud_apig_environment" "main" {
  name        = "${var.project_name}-env"
  instance_id = huaweicloud_apig_instance.main.id
}

resource "huaweicloud_apig_group_environment" "main" {
  group_id      = huaweicloud_apig_group.main.id
  environment_id = huaweicloud_apig_environment.main.id
  variable {
    name  = "x-stage"
    value = "production"
  }
}

# ============================================================================
# 输出
# ============================================================================

output "obs_bucket_name" {
  description = "OBS 桶名（静态网站托管）"
  value       = huaweicloud_obs_bucket.assets.bucket
}

output "web_url" {
  description = "Web 查看器访问地址（OBS 静态网站）"
  value       = "https://${var.obs_bucket_name}.obs.${var.region}.myhuaweicloud.com/web/index.html"
}

output "api_url" {
  description = "APIG API 基础地址"
  value       = "https://${huaweicloud_apig_instance.main.ingress_address}"
}

output "function_name" {
  description = "FunctionGraph DOT-LD 解析函数名"
  value       = huaweicloud_fgs_function.dotld_parser.name
}

output "parse_api_endpoint" {
  description = "DOT-LD 解析 API 端点"
  value       = "https://${huaweicloud_apig_instance.main.ingress_address}/v1/dotld/parse"
}

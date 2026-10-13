"""
DOT-LD Parser — FunctionGraph 函数
解析 DOT-LD Markdown 文本，提取知识图谱的节点、边和样式定义

API 接口:
  POST /v1/dotld/parse
  Body: {"content": "<DOT-LD markdown text>"}
  Response: {"nodes": [...], "edges": [...], "nodeStyles": [...]}

DOT-LD 语法:
  ::config ... ::     — 配置块（定义实体类型样式和实体类型分配）
  [[EntityName]]      — 内联实体引用
  ::rel A -> B [label] :: — 关系定义
"""

import json
import re
import os


def parse_config_block(content):
    """解析 ::config ... :: 配置块，提取样式定义和实体类型分配"""
    node_styles = []
    entity_definitions = {}

    config_match = re.search(r'::config\s*([\s\S]*?)::', content)
    if not config_match:
        return node_styles, entity_definitions

    config_content = config_match.group(1)

    for line in config_content.split('\n'):
        line = line.strip()
        if not line or line.startswith('//'):
            continue

        # 去除行内注释
        line = line.split('//')[0].strip()

        # 样式定义: type: shape, color, size
        style_match = re.match(
            r'^([\w-]+):\s*([^,\s]+),\s*([^,\s]+),\s*(\d+)\s*$',
            line
        )
        if style_match:
            entity_type, shape, color, size = style_match.groups()
            node_styles.append({
                'type': entity_type,
                'shape': shape,
                'color': color,
                'size': int(size)
            })
            continue

        # 实体定义: EntityName: type=typeName
        entity_match = re.match(r'^([\w-]+):\s*type=([\w-]+)\s*$', line)
        if entity_match:
            entity_name, entity_type = entity_match.groups()
            entity_definitions[entity_name] = {'type': entity_type}

    return node_styles, entity_definitions


def parse_dotld(content):
    """
    解析 DOT-LD Markdown 文本，返回图数据

    Returns:
        dict with keys:
            nodes: list of {id, label, type}
            edges: list of {source, target, label}
            nodeStyles: list of {type, shape, color, size}
    """
    nodes = {}  # id -> {id, label, type}
    edges = []
    edge_set = set()  # 去重

    # 1. 解析配置块
    node_styles, entity_definitions = parse_config_block(content)

    # 2. 解析内联节点引用 [[EntityName]]
    for match in re.finditer(r'\[\[([^\]]+)\]\]', content):
        node_name = match.group(1)
        if node_name not in nodes:
            entity_def = entity_definitions.get(node_name)
            nodes[node_name] = {
                'id': node_name,
                'label': node_name,
                'type': entity_def['type'] if entity_def else 'default'
            }

    # 3. 解析关系 ::rel source -> target [label] ::
    rel_pattern = re.compile(
        r'::rel\s+([\w-]+)\s*->\s*([\w-]+)\s*(?:\[([^\]]*)\])?\s*::'
    )
    for match in rel_pattern.finditer(content):
        source, target, label = match.group(1), match.group(2), match.group(3) or ''

        edge_key = f"{source}|{target}|{label}"
        if edge_key not in edge_set:
            edges.append({
                'source': source,
                'target': target,
                'label': label
            })
            edge_set.add(edge_key)

        # 确保节点存在
        for node_name in [source, target]:
            if node_name not in nodes:
                entity_def = entity_definitions.get(node_name)
                nodes[node_name] = {
                    'id': node_name,
                    'label': node_name,
                    'type': entity_def['type'] if entity_def else 'default'
                }

    return {
        'nodes': list(nodes.values()),
        'edges': edges,
        'nodeStyles': node_styles
    }


def handler(event, context):
    """
    FunctionGraph 入口函数

    Args:
        event: APIG 传递的事件对象
            {
                "body": "{\"content\": \"...\"}"  # APIG POST body
            }
        context: FunctionGraph 运行时上下文

    Returns:
        dict: HTTP 响应
    """
    try:
        # 解析请求体
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)

        content = body.get('content', '')

        if not content:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'error': 'Missing "content" field in request body'
                })
            }

        # 解析 DOT-LD
        graph_data = parse_dotld(content)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(graph_data, ensure_ascii=False)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': f'Internal error: {str(e)}'
            })
        }


# 本地测试
if __name__ == '__main__':
    test_content = """# Simple Web Application

::config
system: round-rectangle, #2196F3, 100
database: rectangle, #4CAF50, 90
component: ellipse, #FF9800, 80

WebServer: type=system
UserDatabase: type=database
Cache: type=component
::

Our application uses a [[WebServer]] to handle web requests.
The [[WebServer]] stores user data in a [[UserDatabase]] for persistence
and uses a [[Cache]] to improve response times.

::rel WebServer -> UserDatabase [stores_data_in] ::
::rel WebServer -> Cache [uses] ::
::rel Cache -> UserDatabase [reads_from] ::
"""

    result = parse_dotld(test_content)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    import sys
    sys.stderr.write(f"Nodes: {len(result['nodes'])}, Edges: {len(result['edges'])}, Styles: {len(result['nodeStyles'])}\n")

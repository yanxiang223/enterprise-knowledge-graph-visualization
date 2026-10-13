/**
 * DOT-LD 知识图谱可视化 — Web 查看器
 * 浏览器端 DOT-LD 解析 + Cytoscape.js 图渲染
 */

// ============================================================================
// DOT-LD 解析器（从 TypeScript 移植）
// ============================================================================

const DotldParser = {
    /**
     * 检查内容是否包含 DOT-LD 标记
     */
    hasDotldNotation(content) {
        return content.includes('::config') || content.includes('::rel');
    },

    /**
     * 解析 DOT-LD Markdown 文本
     * @param {string} content - DOT-LD Markdown 内容
     * @returns {{nodes: Array, edges: Array, nodeStyles: Array}} 图数据
     */
    parse(content) {
        const nodes = new Map();
        const edges = [];
        const edgeSet = new Set();
        const nodeStyles = [];
        const entityDefinitions = new Map();

        // 1. 解析配置块
        const configMatch = content.match(/::config\s*([\s\S]*?)::/);
        if (configMatch) {
            const configContent = configMatch[1];
            const lines = configContent.split('\n');

            for (const line of lines) {
                if (!line.trim() || line.trim().startsWith('//')) continue;
                const lineClean = line.split('//')[0].trim();

                // 样式定义: type: shape, color, size
                const styleMatch = lineClean.match(/^([\w-]+):\s*([^,\s]+),\s*([^,\s]+),\s*(\d+)\s*$/);
                if (styleMatch) {
                    const [, type, shape, color, size] = styleMatch;
                    nodeStyles.push({ type, shape, color, size: parseInt(size, 10) });
                    continue;
                }

                // 实体定义: EntityName: type=typeName
                const entityMatch = lineClean.match(/^([\w-]+):\s*type=([\w-]+)\s*$/);
                if (entityMatch) {
                    const [, entity, type] = entityMatch;
                    entityDefinitions.set(entity, { type });
                }
            }
        }

        // 2. 解析内联节点引用 [[EntityName]]
        const nodeRefRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = nodeRefRegex.exec(content)) !== null) {
            const nodeName = match[1];
            const entityDef = entityDefinitions.get(nodeName);
            if (!nodes.has(nodeName)) {
                nodes.set(nodeName, {
                    id: nodeName, label: nodeName,
                    type: entityDef ? entityDef.type : 'default'
                });
            }
        }

        // 3. 解析关系 ::rel source -> target [label] ::
        const relRegex = /::rel\s+([\w-]+)\s*->\s*([\w-]+)\s*(?:\[([^\]]*)\])?\s*::/g;
        while ((match = relRegex.exec(content)) !== null) {
            const [, source, target, label] = match;
            const edgeKey = `${source}|${target}|${label || ''}`;
            if (!edgeSet.has(edgeKey)) {
                edges.push({ source, target, label: label || '' });
                edgeSet.add(edgeKey);
            }
            [source, target].forEach(name => {
                if (!nodes.has(name)) {
                    const entityDef = entityDefinitions.get(name);
                    nodes.set(name, {
                        id: name, label: name,
                        type: entityDef ? entityDef.type : 'default'
                    });
                }
            });
        }

        return {
            nodes: Array.from(nodes.values()),
            edges: edges,
            nodeStyles: nodeStyles
        };
    }
};

// ============================================================================
// 图可视化管理器
// ============================================================================

let cy = null;
let graphData = null;

function initGraph(data) {
    graphData = data;
    const elements = [];

    // 添加节点
    data.nodes.forEach(node => {
        elements.push({ data: { id: node.id, label: node.label, type: node.type } });
    });

    // 添加边
    data.edges.forEach((edge, index) => {
        elements.push({
            data: {
                id: 'edge' + index,
                source: edge.source, target: edge.target, label: edge.label
            }
        });
    });

    // 构建节点类型样式规则
    const nodeStyleRules = (data.nodeStyles || []).map(style => ({
        selector: `node[type="${style.type}"]`,
        style: {
            'background-color': 'white',
            'border-width': '2px',
            'border-color': style.color,
            'shape': style.shape,
            'width': style.size + 'px',
            'height': (style.size * 0.6) + 'px'
        }
    }));

    // 销毁旧实例
    if (cy) cy.destroy();

    // 初始化 Cytoscape
    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: elements,
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)', 'text-valign': 'center', 'text-halign': 'center',
                    'background-color': 'white', 'border-width': '2px', 'border-color': '#666',
                    'color': '#333', 'font-size': '12px', 'width': '100px', 'height': '60px',
                    'shape': 'round-rectangle', 'text-wrap': 'wrap', 'text-max-width': '90px'
                }
            },
            ...nodeStyleRules,
            {
                selector: 'edge',
                style: {
                    'width': 2, 'line-color': '#999', 'target-arrow-color': '#999',
                    'target-arrow-shape': 'triangle', 'curve-style': 'bezier',
                    'label': 'data(label)', 'font-size': '11px',
                    'text-background-color': '#ffffff', 'text-background-opacity': 0.9,
                    'text-background-padding': '3px', 'color': '#666'
                }
            },
            { selector: '.highlighted', style: { 'background-color': '#ffeb3b', 'border-width': '3px', 'border-color': '#f9a825', 'z-index': 999 } },
            { selector: '.dimmed', style: { 'opacity': 0.2 } },
            { selector: 'node.path-highlight', style: { 'background-color': '#ff9800', 'border-width': '4px', 'border-color': '#f57c00', 'z-index': 998 } },
            { selector: 'edge.path-highlight', style: { 'line-color': '#ff9800', 'target-arrow-color': '#ff9800', 'width': 4, 'z-index': 998 } }
        ],
        layout: { name: 'cose', padding: 30, nodeRepulsion: 8000, idealEdgeLength: 120, edgeElasticity: 200, animate: false }
    });

    // 节点点击事件
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        showNodeDetails(node);
        cy.nodes().removeClass('highlighted').addClass('dimmed');
        cy.edges().removeClass('highlighted').addClass('dimmed');
        node.removeClass('dimmed').addClass('highlighted');
        node.connectedEdges().removeClass('dimmed').addClass('highlighted');
        node.connectedEdges().connectedNodes().removeClass('dimmed');
    });

    // 背景点击清除选择
    cy.on('tap', function(evt) {
        if (evt.target === cy) {
            document.getElementById('nodeDetails').innerHTML = '<p class="hint">点击节点查看详情</p>';
            cy.elements().removeClass('highlighted dimmed path-highlight');
        }
    });

    cy.fit();

    // 更新计数
    document.getElementById('nodeCount').textContent = `节点: ${data.nodes.length}`;
    document.getElementById('edgeCount').textContent = `边: ${data.edges.length}`;
}

// ============================================================================
// 节点详情
// ============================================================================

function showNodeDetails(node) {
    const nodeData = node.data();
    const style = (graphData.nodeStyles || []).find(s => s.type === nodeData.type);
    const color = style ? style.color : '#666';
    const html = `
        <div class="detail-section">
            <div class="detail-label">节点名称</div>
            <div class="detail-value">${nodeData.label}</div>
        </div>
        <div class="detail-section">
            <div class="detail-label">类型</div>
            <div class="detail-value">
                <span class="type-badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color};">${nodeData.type}</span>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-label">度数</div>
            <div class="detail-value">${node.degree()}</div>
        </div>
    `;
    document.getElementById('nodeDetails').innerHTML = html;
}

// ============================================================================
// 搜索
// ============================================================================

function searchNodes() {
    const text = document.getElementById('searchInput').value.toLowerCase();
    cy.elements().removeClass('highlighted dimmed');
    if (!text) { cy.fit(); return; }
    const matches = cy.nodes().filter(n => n.data('label').toLowerCase().includes(text));
    if (matches.length > 0) {
        cy.nodes().addClass('dimmed');
        cy.edges().addClass('dimmed');
        matches.removeClass('dimmed').addClass('highlighted');
        matches.connectedEdges().removeClass('dimmed').addClass('highlighted');
        matches.connectedEdges().connectedNodes().removeClass('dimmed');
        cy.fit(matches, 50);
    }
}

// ============================================================================
// 布局切换
// ============================================================================

function changeLayout() {
    const name = document.getElementById('layoutSelect').value;
    const opts = { name, padding: 30, animate: true, animationDuration: 500 };
    if (name === 'cose') { opts.nodeRepulsion = 8000; opts.idealEdgeLength = 120; opts.edgeElasticity = 200; }
    else if (name === 'breadthfirst') { opts.directed = true; opts.spacingFactor = 1.5; }
    cy.layout(opts).run();
}

// ============================================================================
// PNG 导出
// ============================================================================

function exportPNG() {
    if (!cy) return;
    const pngData = cy.png({ output: 'blob', bg: 'white', full: true, scale: 2 });
    const url = URL.createObjectURL(pngData);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dotld-graph.png';
    link.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// 路径查找（A* 算法）
// ============================================================================

function findPath() {
    if (!cy) return;
    const startInput = document.getElementById('startNode').value;
    const endInput = document.getElementById('endNode').value;
    const resultDiv = document.getElementById('pathResult');

    cy.elements().removeClass('highlighted path-highlight dimmed');

    const startNode = cy.nodes().filter(n => n.data('label') === startInput);
    const endNode = cy.nodes().filter(n => n.data('label') === endInput);

    if (startNode.length === 0 || endNode.length === 0) {
        resultDiv.innerHTML = '<div class="result-hint">请输入有效的起始和目标节点</div>';
        return;
    }

    let path = cy.elements().aStar({ root: startNode, goal: endNode, directed: true });
    if (!path.found) {
        path = cy.elements().aStar({ root: startNode, goal: endNode, directed: false });
    }

    if (!path.found) {
        resultDiv.innerHTML = '<div class="result-hint error">两节点间未找到路径</div>';
        return;
    }

    cy.nodes().addClass('dimmed');
    cy.edges().addClass('dimmed');
    path.path.forEach(ele => ele.removeClass('dimmed').addClass('path-highlight'));

    const pathNodes = path.path.nodes().map(n => n.data('label'));
    const pathLen = pathNodes.length - 1;
    resultDiv.innerHTML = `
        <div class="result-hint success">路径长度: ${pathLen} 跳</div>
        <div class="path-steps">${pathNodes.join(' → ')}</div>
    `;
    cy.fit(path.path, 50);
}

// ============================================================================
// 社区检测（标签传播算法）
// ============================================================================

const clusterColors = ['#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#8BC34A', '#FF5722'];

function runClusterAnalysis() {
    if (!cy) return;
    clearClusters();
    const nodeToCommunity = new Map();
    cy.nodes().forEach((node, i) => nodeToCommunity.set(node.id(), i));

    let improved = true;
    let iterations = 0;
    const maxIter = 10;

    while (improved && iterations < maxIter) {
        improved = false;
        iterations++;
        cy.nodes().forEach(node => {
            const counts = new Map();
            node.neighborhood('node').forEach(neighbor => {
                const c = nodeToCommunity.get(neighbor.id());
                counts.set(c, (counts.get(c) || 0) + 1);
            });
            if (counts.size > 0) {
                const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
                if (nodeToCommunity.get(node.id()) !== best) {
                    nodeToCommunity.set(node.id(), best);
                    improved = true;
                }
            }
        });
    }

    const communities = new Map();
    nodeToCommunity.forEach((comm, id) => {
        if (!communities.has(comm)) communities.set(comm, []);
        communities.get(comm).push(id);
    });

    const clusters = Array.from(communities.entries())
        .filter(([, ids]) => ids.length > 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 6);

    let html = `<div class="result-hint">发现 ${clusters.length} 个聚类</div>`;
    clusters.forEach((cluster, i) => {
        const color = clusterColors[i % clusterColors.length];
        const nodes = cluster[1];
        nodes.forEach(id => {
            const node = cy.getElementById(id);
            node.style('background-color', color);
            node.style('border-color', color);
        });
        html += `<div class="cluster-item"><span class="cluster-dot" style="background:${color}"></span>聚类 ${i+1} (${nodes.length} 节点)</div>`;
    });

    document.getElementById('clusterResult').innerHTML = html;
}

function clearClusters() {
    if (!cy) return;
    cy.nodes().removeStyle('background-color border-color');
    cy.elements().removeClass('dimmed highlighted path-highlight');
    document.getElementById('clusterResult').innerHTML = '';
}

// ============================================================================
// 中心性分析
// ============================================================================

function runCentrality(type) {
    if (!cy) return;
    clearClusters();
    cy.elements().removeClass('dimmed');

    const scores = {};
    const names = { degree: '度中心性', betweenness: '介数中心性', closeness: '接近中心性' };

    if (type === 'degree') {
        cy.nodes().forEach(n => scores[n.id()] = n.degree());
    } else if (type === 'betweenness') {
        const bc = cy.elements().betweennessCentrality({ directed: false });
        cy.nodes().forEach(n => scores[n.id()] = bc.betweenness(n));
    } else if (type === 'closeness') {
        cy.nodes().forEach(node => {
            let totalDist = 0, reachable = 0;
            cy.nodes().forEach(target => {
                if (node.id() === target.id()) return;
                const p = cy.elements().aStar({ root: node, goal: target, directed: false });
                if (p.found) { totalDist += p.distance; reachable++; }
            });
            scores[node.id()] = reachable > 0 ? reachable / totalDist : 0;
        });
    }

    const values = Object.values(scores);
    const min = Math.min(...values);
    const max = Math.max(...values);

    cy.nodes().forEach(node => {
        const score = scores[node.id()];
        const norm = max > min ? (score - min) / (max - min) : 0.5;
        const size = 100 + norm * 80;
        node.style('width', size + 'px');
        node.style('height', (size * 0.6) + 'px');
        node.style('opacity', 0.4 + norm * 0.6);
    });

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let html = `<div class="result-hint">${names[type]}（节点大小=中心性得分）</div>`;
    sorted.forEach((entry, i) => {
        const node = cy.getElementById(entry[0]);
        html += `<div class="ranking-item">${i + 1}. ${node.data('label')} <span class="score">(${entry[1].toFixed(2)})</span></div>`;
    });
    document.getElementById('centralityResult').innerHTML = html;
}

// ============================================================================
// 链路预测（Jaccard 相似度）
// ============================================================================

function suggestLinks() {
    if (!cy) return;
    clearClusters();
    cy.elements().removeClass('dimmed');

    const suggestions = [];
    const nodes = cy.nodes();

    nodes.forEach(n1 => {
        nodes.forEach(n2 => {
            if (n1.id() >= n2.id()) return;
            if (n1.edgesWith(n2).length > 0) return;
            const neighbors1 = new Set(n1.neighborhood('node').map(n => n.id()));
            const neighbors2 = new Set(n2.neighborhood('node').map(n => n.id()));
            const intersection = Array.from(neighbors1).filter(x => neighbors2.has(x)).length;
            if (intersection > 0) {
                const union = new Set([...neighbors1, ...neighbors2]).size;
                suggestions.push({
                    source: n1.data('label'), target: n2.data('label'),
                    score: intersection / union, common: intersection
                });
            }
        });
    });

    suggestions.sort((a, b) => b.score - a.score);
    const top = suggestions.slice(0, 10);

    if (top.length === 0) {
        document.getElementById('linkResult').innerHTML = '<div class="result-hint">未发现建议连接</div>';
        return;
    }

    let html = '<div class="result-hint">建议缺失连接（基于共同邻居）</div>';
    top.forEach((s, i) => {
        html += `<div class="ranking-item">${i + 1}. ${s.source} → ${s.target}<span class="score">${s.common} 个共同邻居</span></div>`;
    });
    document.getElementById('linkResult').innerHTML = html;
}

// ============================================================================
// 示例数据
// ============================================================================

const examples = {
    basic: `# Simple Web Application

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
::rel Cache -> UserDatabase [reads_from] ::`,

    hvac: `# HVAC System Documentation

::config
equipment: round-rectangle, #2196F3, 120
component: ellipse, #4CAF50, 80

ChillerSystem: type=equipment
Pump: type=component
CoolingTower: type=equipment
::

The [[ChillerSystem]] is the primary cooling equipment.
It uses a [[Pump]] to circulate chilled water
and requires a [[CoolingTower]] for heat rejection.

::rel ChillerSystem -> Pump [uses] ::
::rel ChillerSystem -> CoolingTower [requires] ::
::rel CoolingTower -> Pump [feeds] ::`,

    api: `# API Documentation

::config
service: round-rectangle, #2196F3, 100
storage: rectangle, #4CAF50, 90
auth: ellipse, #FF9800, 80

UserService: type=service
AuthService: type=service
UserDB: type=storage
TokenStore: type=storage
::

The [[UserService]] manages user profiles.
It relies on [[AuthService]] for authentication.
[[UserService]] stores data in [[UserDB]].
[[AuthService]] caches tokens in [[TokenStore]].

::rel UserService -> UserDB [persists_to] ::
::rel UserService -> AuthService [depends_on] ::
::rel AuthService -> TokenStore [caches_in] ::
::rel AuthService -> UserDB [validates_against] ::`
};

// ============================================================================
// 事件绑定
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // 解析 & 渲染按钮
    document.getElementById('parseBtn').addEventListener('click', function() {
        const content = document.getElementById('editor').value;
        if (!DotldParser.hasDotldNotation(content)) {
            alert('未检测到 DOT-LD 标记（需要 ::config 或 ::rel）');
            return;
        }
        const data = DotldParser.parse(content);
        initGraph(data);
    });

    // 示例按钮
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const example = this.dataset.example;
            document.getElementById('editor').value = examples[example];
            const data = DotldParser.parse(examples[example]);
            initGraph(data);
        });
    });

    // 工具栏
    document.getElementById('searchInput').addEventListener('keyup', searchNodes);
    document.getElementById('layoutSelect').addEventListener('change', changeLayout);
    document.getElementById('fitBtn').addEventListener('click', () => cy && cy.fit());
    document.getElementById('exportBtn').addEventListener('click', exportPNG);

    // 路径查找
    document.getElementById('findPathBtn').addEventListener('click', findPath);
    document.getElementById('clearPathBtn').addEventListener('click', () => {
        if (!cy) return;
        cy.elements().removeClass('highlighted dimmed path-highlight');
        document.getElementById('pathResult').innerHTML = '';
        document.getElementById('startNode').value = '';
        document.getElementById('endNode').value = '';
    });

    // 社区检测
    document.getElementById('clusterBtn').addEventListener('click', runClusterAnalysis);
    document.getElementById('clearClusterBtn').addEventListener('click', clearClusters);

    // 中心性
    document.getElementById('degreeBtn').addEventListener('click', () => runCentrality('degree'));
    document.getElementById('betweenBtn').addEventListener('click', () => runCentrality('betweenness'));
    document.getElementById('closeBtn').addEventListener('click', () => runCentrality('closeness'));
    document.getElementById('clearCentralBtn').addEventListener('click', () => {
        if (!cy) return;
        cy.nodes().removeStyle('width height opacity background-color border-color');
        cy.elements().removeClass('dimmed highlighted path-highlight');
        document.getElementById('centralityResult').innerHTML = '';
    });

    // 链路预测
    document.getElementById('linkPredictBtn').addEventListener('click', suggestLinks);

    // 加载默认示例
    document.getElementById('editor').value = examples.basic;
    const data = DotldParser.parse(examples.basic);
    initGraph(data);
});

// js/visualization/index.js - GraphVisualization composer
// Base class holds state, storage event subscriptions, and shared helpers.
// Rendering/physics/highlight/search concerns live in sibling mixins.
import * as THREE from 'three';
import graphStorage from '../storage.js';
import { nodesMixin } from './nodes.js';
import { edgesMixin } from './edges.js';
import { physicsMixin } from './physics.js';
import { highlightMixin } from './highlight.js';
import { searchMixin } from './search.js';

class GraphVisualization {
    constructor(scene) {
        console.log('👁️ GraphVisualization constructor');
        this.scene = scene;
        this.nodes = new Map();   // id -> { mesh, label, visualType, ... }
        this.edges = new Map();   // id -> { line, label, sourceId, targetId, pairKey }
        this.pairMap = new Map();      // pairKey -> { idA, idB, edgeIds }
        this.nodeToPairs = new Map();  // nodeId -> Set of pairKeys
        this.nodeToGroup = new Map();  // nodeId -> groupId
        this.proxyEdges = new Map();
        this._typeCentersCache = new Map();

        this.hoveredNodeId = null;

        this.physicsConfig = {
            enabled: true,
            is2D: false,
            repulsion: 10.0,
            attraction: 0.015,
            damping: 0.85,
            minDist: 8.0,
            maxDist: 100.0,
            alpha: 1.0,
            alphaTarget: 0.01,
            alphaDecay: 0.02,
            collisionRadiusPadding: 2,
            labelSizeMultiplier: 1.0,
            speed: 1.0,        // 0.0 to 1.0 multiplier
            edgeThickness: 1.0 // Thickness of lines
        };

        this.highlightSettings = {
            depth: 1,       // 1 = neighbors, 5+ = chain/cluster
            dimming: 0.35,  // Opacity of non-selected items
            direction: 'both' // 'both', 'outgoing', 'incoming'
        };

        this.filters = {
            hiddenTypes: new Set(),
            showInactive: false
        };

        this.currentSearchQuery = ""; // Store search query to persist during highlight resets

        this.textureLoader = new THREE.TextureLoader();
        this._v1 = new THREE.Vector3();
        this._v2 = new THREE.Vector3();
        this._v3 = new THREE.Vector3();

        graphStorage.addEventListener('nodeAdded', e => {
            const node = e.detail;
            if (node.type === 'group' && node.members) {
                node.members.forEach(memberId => {
                    this.nodeToGroup.set(memberId, node.id);
                });
            }
            this.addNode(node);
            this.heat(1.0);
        });
        graphStorage.addEventListener('nodeUpdated', e => {
            const node = e.detail;
            if (node.type === 'group' && node.members) {
                node.members.forEach(memberId => {
                    this.nodeToGroup.set(memberId, node.id);
                });
            }
            this.updateNode(node);
            this.heat(0.5);
        });
        graphStorage.addEventListener('nodeRemoved', e => {
            this.removeNode(e.detail.id);
            this.heat(0.8);
        });
        const debouncedScaleUpdate = () => {
            if (this._scaleTimer) clearTimeout(this._scaleTimer);
            this._scaleTimer = setTimeout(() => this.updateNodeScales(), 200);
        };

        graphStorage.addEventListener('edgeAdded', e => {
            this.addEdge(e.detail);
            debouncedScaleUpdate();
            this.heat(0.5);
        });
        graphStorage.addEventListener('edgeUpdated', e => {
            this.updateEdge(e.detail);
            this.heat(0.3);
        });
        graphStorage.addEventListener('edgeRemoved', e => {
            this.removeEdge(e.detail.id);
            debouncedScaleUpdate();
            this.heat(0.5);
        });
        graphStorage.addEventListener('graphCleared', () => {
            this.clear();
            this.heat(0.1);
        });
        graphStorage.addEventListener('typeStyleUpdated', e => {
            const { category, type } = e.detail;
            const startTime = performance.now();
            console.log(`🎨 Style Update Triggered: ${category}.${type}`);

            if (category === 'node') {
                this.nodes.forEach((_, id) => {
                    const node = graphStorage.getNode(id);
                    if (node && node.type === type) this.updateNode(node);
                });
            } else if (category === 'edge') {
                this.edges.forEach((_, id) => {
                    const edge = graphStorage.edges.get(id);
                    if (edge && edge.type === type) this.updateEdge(edge);
                });
            }
            console.log(`✅ Style Update Complete in ${(performance.now() - startTime).toFixed(2)}ms`);
        });
    }

    get activeFilters() {
        const allTypes = ['person', 'location', 'item', 'concept', 'group'];
        const active = new Set();
        allTypes.forEach(t => {
            if (!this.filters.hiddenTypes.has(t)) active.add(t);
        });
        return active;
    }

    // Debounced wrapper: collapses N calls into 1 during bulk operations (import, undo, etc.)
    _debouncedScalesAndFilters() {
        if (this._sfTimer) clearTimeout(this._sfTimer);
        this._sfTimer = setTimeout(() => {
            this.updateNodeScales();
            this.applyFilters();
        }, 50);
    }

    clear() {
        this.nodes.forEach((_, id) => this.removeNode(id));
        this.edges.forEach((_, id) => this.removeEdge(id));
        this.proxyEdges.forEach((_, id) => this._removeProxyEdge(id));
        this.nodes.clear();
        this.edges.clear();
        this.proxyEdges.clear();
    }

    getNodeColor(type, id = null) {
        // 1. Check if node has a specific color override in properties
        if (id !== null) {
            const data = graphStorage.getNode(id);
            if (data?.attributes?.color) return data.attributes.color;
            if (data?.properties?.basic_info?.appearance?.color) return data.properties.basic_info.appearance.color;
        }

        // 2. Check storage for type-specific default
        if (graphStorage.typeStyles?.node?.[type]) {
            return graphStorage.typeStyles.node[type];
        }

        // 3. Hardcoded defaults
        const colors = {
            person: '#ffaa88',
            location: '#88ffaa',
            item: '#ffcc88',
            concept: '#aa88ff',
            group: '#88aaff',
            event: '#ff88aa',
            file: '#aaff88',
            folder: '#ffaaff'
        };
        return colors[type] || '#88aaff';
    }

    heat(strength = 1.0) {
        this.physicsConfig.alpha = Math.max(this.physicsConfig.alpha, strength);
    }

    getNodeRadius(entry) {
        if (!entry) return 0.5;
        const scale = entry.mesh.scale.y;
        const base = entry.visualType === 'sprite' ? 0.75 : 0.5;
        return base * scale;
    }

    _createLabelTexture(text, color, isEdge = false) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = isEdge ? 32 : 48;
        context.font = `bold ${fontSize}px Arial`;
        const metrics = context.measureText(text);
        const textWidth = metrics.width;
        const padding = isEdge ? 10 : 20;
        canvas.width = textWidth + padding * 2;
        canvas.height = fontSize + padding * 2;
        context.fillStyle = isEdge ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.8)';
        context.beginPath();
        context.roundRect(0, 0, canvas.width, canvas.height, isEdge ? 8 : 15);
        context.fill();
        context.strokeStyle = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
        context.lineWidth = isEdge ? 2 : 4;
        context.stroke();
        context.fillStyle = isEdge ? '#aaccff' : 'white';
        context.font = `bold ${fontSize}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        return texture;
    }

    _createCircularSpriteMap(imageUrl, callback) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const size = 512;
            canvas.width = size;
            canvas.height = size;
            context.beginPath();
            context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            context.closePath();
            context.clip();
            const aspect = img.width / img.height;
            let drawWidth, drawHeight, x, y;
            if (aspect > 1) {
                drawHeight = size;
                drawWidth = size * aspect;
                x = -(drawWidth - size) / 2;
                y = 0;
            } else {
                drawWidth = size;
                drawHeight = size / aspect;
                x = 0;
                y = -(drawHeight - size) / 2;
            }
            context.drawImage(img, x, y, drawWidth, drawHeight);
            context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            context.lineWidth = 10;
            context.stroke();
            const texture = new THREE.CanvasTexture(canvas);
            callback(texture);
        };
        img.src = imageUrl;
    }

    setHoverNode(id) {
        if (this.hoveredNodeId !== id) {
            this.hoveredNodeId = id;
            this.updateNodeScales();
            // Trigger the UI Preview
            if (window.__ui) window.__ui.updateHoverPreview(id, 'node');
        }
    }
}

Object.assign(GraphVisualization.prototype,
    nodesMixin,
    edgesMixin,
    physicsMixin,
    highlightMixin,
    searchMixin
);

export default GraphVisualization;

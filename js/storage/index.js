// js/storage/index.js - GraphStorage composer
// Data model and persistence. Concerns live in sibling modules and are mixed in below.
import { initDB, saveGraph, loadLastActive, loadGraph, listStoredGraphs } from './db.js';
import { templatesMixin } from './templates.js';
import { graphMixin } from './graph.js';
import { undoMixin } from './undo.js';
import { mergeMixin } from './merge.js';

class GraphStorage extends EventTarget {
    constructor() {
        super();
        this.dbName = 'WorldGraphDB';
        this.storeName = 'saveData';
        this.version = 1;
        this.db = null;

        this.graphName = 'My World Graph';
        this.nodes = new Map();
        this.edges = new Map(); // id -> edge
        this.nextNodeId = 0;

        // Undo/Redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this._suspendHistory = false;

        // Type-based styles (default colors, etc.)
        this.typeStyles = {
            node: {
                person: '#ffaa88',
                location: '#88ffaa',
                item: '#ffcc88',
                concept: '#aa88ff',
                group: '#88aaff'
            },
            edge: {
                related: '#88aaff'
            }
        };

        // Save Debouncing (prevents spamming the DB)
        this._saveTimer = null;
    }

    // --- Database Initialization ---
    async init() {
        await initDB();
    }

    async save() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        return new Promise((resolve) => {
            this._saveTimer = setTimeout(async () => {
                const data = {
                    version: '1.3',
                    graphName: this.graphName,
                    nextNodeId: this.nextNodeId,
                    nodes: Array.from(this.nodes.values()),
                    edges: Array.from(this.edges.values()),
                    typeStyles: this.typeStyles,
                    savedAt: new Date().toISOString()
                };
                await saveGraph(this.graphName, data);
                resolve();
            }, 500);
        });
    }

    async listStoredGraphs() {
        return await listStoredGraphs();
    }

    async loadSpecificGraph(name) {
        const data = await loadGraph(name);
        if (data) {
            this.importJSON(data);
            console.log(`📂 Graph '${name}' loaded.`);
            this.save(); // bump to last_active
            return true;
        }
        return false;
    }

    async load() {
        if (!this.db) await this.init();

        const lastActive = await loadLastActive();
        if (lastActive) {
            this.importJSON(lastActive);
            console.log(`📂 Graph loaded from IndexedDB`);
            return true;
        }

        // Fallback: localStorage migration
        const oldData = localStorage.getItem('worldGraph');
        if (oldData) {
            console.log('📦 Migrating data from localStorage...');
            try {
                const parsed = JSON.parse(oldData);
                this.importJSON(parsed);
                this.save();
                localStorage.removeItem('worldGraph');
                return true;
            } catch (e) {
                this.createDefaultGraph();
                return false;
            }
        }

        this.createDefaultGraph();
        return false;
    }

    _migratePersonNode = (node) => {
        if (node.type !== 'person') return;

        // --- Convert legacy string fields to the new object format ---
        if (node.properties.biography && typeof node.properties.biography.early_life === 'string') {
            node.properties.biography.early_life = {
                place_of_birth: '',
                family_background: node.properties.biography.early_life,
                key_events: []
            };
        }
        if (node.properties.appearance && node.properties.appearance.height && typeof node.properties.appearance.height === 'number') {
            node.properties.appearance.height = {
                value: node.properties.appearance.height,
                unit: 'cm',
                imperial: ''
            };
        }

        const template = this.getPersonTemplate(node.label);
        const deepMerge = (target, source) => {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key] || typeof target[key] !== 'object') {
                        target[key] = {};
                    }
                    deepMerge(target[key], source[key]);
                } else {
                    if (target[key] === undefined) target[key] = source[key];
                }
            }
        };
        deepMerge(node.properties, template);
    };

    async importJSON(data) {
        if (!data || !data.nodes) return;
        this._suspendHistory = true;

        // Clear current first
        this.nodes.clear();
        this.edges.clear();
        this.dispatchEvent(new CustomEvent('graphCleared'));

        this.graphName = data.graphName || 'Imported Graph';
        this.nextNodeId = data.nextNodeId || 0;
        if (data.typeStyles) this.typeStyles = data.typeStyles;

        // Helper: yield to browser every N items
        const BATCH_SIZE = 50;
        const yieldFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

        // Process nodes in batches
        const nodes = data.nodes;
        console.log(`📦 Loading ${nodes.length} nodes in batches of ${BATCH_SIZE}...`);
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (!n.position) {
                n.position = {
                    x: (Math.random() - 0.5) * 30,
                    y: (Math.random() - 0.5) * 30,
                    z: (Math.random() - 0.5) * 30
                };
            }
            this.nodes.set(n.id, n);
            if (n.type === 'person') this._migratePersonNode(n);
            if (typeof n.id === 'number' && n.id >= this.nextNodeId) this.nextNodeId = n.id + 1;
            this.dispatchEvent(new CustomEvent('nodeAdded', { detail: n }));

            // Yield to browser after each batch
            if ((i + 1) % BATCH_SIZE === 0) {
                await yieldFrame();
            }
        }

        // Process edges in batches
        const edgesArray = data.edges || [];
        console.log(`📦 Loading ${edgesArray.length} edges in batches of ${BATCH_SIZE}...`);
        for (let i = 0; i < edgesArray.length; i++) {
            const edge = edgesArray[i];
            this.edges.set(edge.id, edge);
            if (!edge.status) edge.status = 'active';
            this.dispatchEvent(new CustomEvent('edgeAdded', { detail: edge }));

            if ((i + 1) % BATCH_SIZE === 0) {
                await yieldFrame();
            }
        }

        console.log('✅ Graph import complete');
        this._suspendHistory = false;
        this.save();
    }

    createDefaultGraph() {
        // Keep this simple to avoid clutter
        const jake = this.createNode('person', { x: 0, y: 0, z: 0 });
        this.updateNode(jake, { label: 'Jake', properties: { basic_info: { name: { full: 'Jake' } } } });
    }

    updateTypeStyle(category, type, style) {
        if (!this.typeStyles[category]) this.typeStyles[category] = {};
        this.typeStyles[category][type] = style;
        this.dispatchEvent(new CustomEvent('typeStyleUpdated', {
            detail: { category, type, style }
        }));
        this.save();
    }
}

Object.assign(GraphStorage.prototype, templatesMixin, graphMixin, undoMixin, mergeMixin);

const graphStorage = new GraphStorage();
export default graphStorage;

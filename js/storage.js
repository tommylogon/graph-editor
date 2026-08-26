// Data model and persistence using IndexedDB
import { initDB, saveGraph, loadLastActive, loadGraph, listStoredGraphs } from './storage/db.js';
// Default sprite generation (simple colored circle with first letter)
const DEFAULT_SPRITE_COLORS = {
    person: '#ffaa88',
    location: '#88ffaa',
    item: '#ffcc88',
    concept: '#aa88ff',
    group: '#88aaff',
    event: '#ff88aa',
    file: '#aaff88',
    folder: '#ffaaff'
};

function generateDefaultSprite(type) {
    const color = DEFAULT_SPRITE_COLORS[type] || '#88aaff';
    const letter = type.charAt(0).toUpperCase();
    const size = 512;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 10}" fill="${color}" stroke="white" stroke-width="20"/>
        <text x="${size / 2}" y="${size / 2}" font-family="Arial, sans-serif" font-size="${size / 2}" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">${letter}</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

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

    // Logic for N-Hop Export
    getNeighborSubGraph(startNodeId, hops = 1) {
        const nodeIds = new Set([startNodeId]);
        let currentLevel = new Set([startNodeId]);

        for (let i = 0; i < hops; i++) {
            const nextLevel = new Set();
            this.edges.forEach(edge => {
                if (currentLevel.has(edge.source)) nextLevel.add(edge.target);
                if (currentLevel.has(edge.target)) nextLevel.add(edge.source);
            });
            nextLevel.forEach(id => nodeIds.add(id));
            currentLevel = nextLevel;
        }

        const nodes = Array.from(nodeIds).map(id => this.nodes.get(id)).filter(Boolean);
        const edges = Array.from(this.edges.values()).filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

        return { graphName: `${this.graphName} (Export)`, nodes, edges };
    }





    async clear() {
        this.nodes.clear();
        this.edges.clear();
        this.nextNodeId = 0;
        this.dispatchEvent(new CustomEvent('graphCleared'));
        await this.save();
    }

    // --- Standard Graph Methods (Keep these mostly the same) ---

    getPersonTemplate(label = "New Person") {
        return {
            metadata: {
                version: "1.0",
                last_updated: new Date().toISOString().split('T')[0],
                source: "Editor",
                notes: "",
                image_prompt: ""
            },
            basic_info: {
                name: {
                    full: label,
                    first: "",
                    last: "",
                    nicknames: [],
                    aliases: []
                },
                age: 25,
                birthdate: "",
                gender: "",
                pronouns: "",
                species: "Human",
                nationality: "",
                ethnicity: "",
                occupation: "",
                residence: {
                    type: "",
                    name: "",
                    unit: "",
                    area: "",
                    full_address: ""
                },
                marital_status: "Single",
                partner: null
                // removed: family (now in relationships), sexuality (now in kinks)
            },
            appearance: {
                overview: "",
                height: { value: 0, unit: "cm", imperial: "" },
                build: "",
                skin: { tone: "", condition: "", distinguishing_features: [] },
                hair: { color: "", length: "", style: "", accessories: [] },
                eyes: { color: "", shape: "", special: "" },
                face: { shape: "", features: [], makeup: "" },
                body: {
                    chest: { size: "", description: "" },
                    waist: "",
                    hips: "",
                    legs: "",
                    butt: "",
                    other: []
                },
                genitalia: {
                    pubic_hair: "",
                    vaginal_description: "",
                    penis_description: ""
                },
                style: { clothing: [], accessories: [], footwear: [] },
                scent: "",
                voice: { pitch: "", accent: "", mannerisms: "" }
            },
            personality: {
                traits: [],
                mbti: "",
                alignment: "",          // kept here
                likes: [],
                dislikes: [],
                fears: [],
                aspirations: [],
                quirks: [],
                habits: [],
                speech_pattern: { style: "", dialect: "", catchphrases: [] }
            },
            biography: {
                early_life: {
                    place_of_birth: "",
                    family_background: "",
                    key_events: []
                },
                adulthood: {
                    education: [],
                    career_history: [],
                    relationships: [],
                    children: [],
                    significant_life_events: []
                },
                current_situation: ""
            },
            relationships: {
                family: {                // moved family here
                    parents: [],
                    siblings: [],
                    children: [],
                    other_relations: []
                },
                connections: [],         // keep both? your call
                friends: [],
                enemies: [],
                rivals: [],
                mentors: [],
                protégés: []
            },
            secrets: {
                deepest_secret: "",
                hidden_facts: [],
                known_by: []
            },
            capabilities: {
                skills: [],
                languages: [],
                weaknesses: []
            },
            kinks_and_sexuality: {
                orientation: "",         // single source of truth
                experience: "",
                preferences: [],
                turn_ons: [],
                turn_offs: [],
                curiosities: [],
                boundaries: []
            },
            narrative: {
                arc: "",
                potential_storylines: [],
                role_in_town: ""
            },
            example_dialogues: [],
            media: {
                favorite_movies: [],
                favorite_music: [],
                favorite_books: []
            }
        };
    }
    getEventTemplate(label = "New Event") {
        return {
            description: "",
            start_date: "",
            end_date: "",
            location: "",
            participants: [],
            outcome: "",
            notes: ""
        };
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

    createNode(type, position) {
        this._pushState();
        const id = this.nextNodeId++;

        // Ensure we always have a valid position object to prevent NaN in physics/viz
        const finalPos = {
            x: (position && typeof position.x === 'number') ? position.x : (Math.random() - 0.5) * 20,
            y: (position && typeof position.y === 'number') ? position.y : (Math.random() - 0.5) * 20,
            z: (position && typeof position.z === 'number') ? position.z : (Math.random() - 0.5) * 20
        };

        // Determine if this type should have a default sprite
        const spriteTypes = ['person', 'location', 'item', 'concept', 'group', 'event', 'file', 'folder'];
        const useDefaultSprite = spriteTypes.includes(type);

        const node = {
            id,
            type,
            label: `New ${type}`,
            imagePrompt: '',
            position: finalPos,
            visualType: useDefaultSprite ? 'sprite' : (type === 'group' ? 'group' : 'sphere'),
            imageUrl: useDefaultSprite ? generateDefaultSprite(type) : '',
            isLocked: false,
            status: 'active',
            properties: type === 'event' ? this.getEventTemplate(`New ${type}`) :
                (type === 'person' ? this.getPersonTemplate(`New ${type}`) : { description: '', created: new Date().toISOString() })
        };
        this.nodes.set(id, node);
        this.dispatchEvent(new CustomEvent('nodeAdded', { detail: node }));
        this.save();
        return id;
    }

    updateNode(id, updates) {
        const node = this.nodes.get(id);
        if (!node) return;
        this._pushState();
        Object.assign(node, updates);
        if (updates.properties) Object.assign(node.properties, updates.properties);
        this.dispatchEvent(new CustomEvent('nodeUpdated', { detail: node }));
        this.save();
    }

    getNode(id) { return this.nodes.get(id) || this.nodes.get(Number(id)); }

    searchNodes(query) {
        if (!query || query.trim().length === 0) return [];
        const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        if (qWords.length === 0) return [];
        const results = [];
        for (const [id, node] of this.nodes) {
            if (node.label) {
                const nodeLabel = node.label.toLowerCase();
                // Check if ALL words in the query are found in the label
                const matches = qWords.every(word => nodeLabel.includes(word));
                if (matches) {
                    results.push({ id, label: node.label, type: node.type });
                }
            }
        }
        return results;
    }

    deleteNode(id) {
        if (!this.nodes.has(id)) return;
        this._pushState();
        // Remove connected edges
        for (const [edgeId, edge] of this.edges) {
            if (edge.source === id || edge.target === id) {
                this.edges.delete(edgeId);
                this.dispatchEvent(new CustomEvent('edgeRemoved', { detail: edge }));
            }
        }
        this.nodes.delete(id);
        this.dispatchEvent(new CustomEvent('nodeRemoved', { detail: { id } }));
        this.save();
    }

    createEdge(sourceId, targetId) {
        if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) return null;
        this._pushState();
        const id = `e${Date.now()}-${Math.random()}`;
        const edge = { id, source: sourceId, target: targetId, type: 'related', label: '', description: '', status: 'active', attributes: { strength: 0.5 } };
        this.edges.set(id, edge);
        this.dispatchEvent(new CustomEvent('edgeAdded', { detail: edge }));
        this.save();
        return id;
    }

    updateEdge(edgeId, updates) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;
        this._pushState();
        Object.assign(edge, updates);
        // Ensure status exists
        if (!edge.status) edge.status = 'active';
        this.dispatchEvent(new CustomEvent('edgeUpdated', { detail: edge }));
        this.save();
    }

    deleteEdge(edgeId) {
        const removed = this.edges.get(edgeId);
        if (!removed) return;
        this._pushState();
        this.edges.delete(edgeId);
        this.dispatchEvent(new CustomEvent('edgeRemoved', { detail: removed }));
        this.save();
    }

    swapEdgeDirection(edgeId) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;
        this._pushState();
        [edge.source, edge.target] = [edge.target, edge.source];
        if (!edge.status) edge.status = 'active';
        this.dispatchEvent(new CustomEvent('edgeUpdated', { detail: edge }));
        this.save();
    }

    ensureBidirectional(edgeId) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;
        const exists = Array.from(this.edges.values()).some(e => e.source === edge.target && e.target === edge.source);
        if (exists) return;
        this._pushState();
        const reverseId = `e${Date.now()}-${Math.random()}`;
        const reverseEdge = { ...edge, id: reverseId, source: edge.target, target: edge.source, status: 'active' };
        this.edges.set(reverseId, reverseEdge);
        this.dispatchEvent(new CustomEvent('edgeAdded', { detail: reverseEdge }));
        this.save();
    }

    createGroup(memberIds, position) {
        this._pushState();
        const id = this.nextNodeId++;

        const finalPos = {
            x: (position && typeof position.x === 'number') ? position.x : (Math.random() - 0.5) * 20,
            y: (position && typeof position.y === 'number') ? position.y : (Math.random() - 0.5) * 20,
            z: (position && typeof position.z === 'number') ? position.z : (Math.random() - 0.5) * 20
        };

        const group = {
            id, type: 'group', label: 'New Group', position: finalPos,
            visualType: 'group', members: memberIds, collapsed: false, isLocked: false, status: 'active',
            properties: { description: '' }
        };
        this.nodes.set(id, group);
        this.dispatchEvent(new CustomEvent('nodeAdded', { detail: group }));
        this.save();
        return id;
    }

    setGroupCollapsed(groupId, collapsed) {
        const group = this.nodes.get(groupId);
        if (group && group.type === 'group') {
            this._pushState();
            group.collapsed = collapsed;
            if (!group.status) group.status = 'active';
            this.dispatchEvent(new CustomEvent('nodeUpdated', { detail: group }));
            this.save();
        }
    }

    ungroup(groupId) {
        const group = this.nodes.get(groupId);
        if (group && group.type === 'group') {
            this._pushState();
            this.nodes.delete(groupId);
            this.dispatchEvent(new CustomEvent('nodeRemoved', { detail: { id: groupId } }));
            this.save();
        }
    }
    // --- Merging ---
    mergeDuplicateNodes(labelToMerge, nodeType) {
        this._pushState();
        const lowerLabel = labelToMerge.toLowerCase();

        // 1. Find nodes matching BOTH label and type
        const matchingNodes = Array.from(this.nodes.values()).filter(n =>
            n.type === nodeType && n.label.toLowerCase() === lowerLabel
        );

        if (matchingNodes.length < 2) return; // Nothing to merge

        // 2. Sort by ID so the oldest node becomes the "Primary" survivor
        matchingNodes.sort((a, b) => a.id - b.id);
        const primary = matchingNodes[0];
        const duplicates = matchingNodes.slice(1);

        duplicates.forEach(dup => {
            // Append descriptions so no text is lost
            if (dup.properties.description) {
                const sep = primary.properties.description ? '\n\n---\n' : '';
                primary.properties.description += `${sep}[Merged from ID ${dup.id}]: ${dup.properties.description}`;
            }

            // Re-point edges
            const edgesToRecreate = [];
            this.edges.forEach(edge => {
                if (edge.source === dup.id || edge.target === dup.id) {
                    edgesToRecreate.push({ ...edge });
                }
            });

            edgesToRecreate.forEach(edge => {
                this.deleteEdge(edge.id); // Remove old visual

                const newSource = edge.source === dup.id ? primary.id : edge.source;
                const newTarget = edge.target === dup.id ? primary.id : edge.target;

                // Avoid loops
                if (newSource !== newTarget) {
                    const newId = `e${Date.now()}-${Math.random()}`;
                    const newEdge = {
                        id: newId,
                        source: newSource,
                        target: newTarget,
                        type: edge.type,
                        label: edge.label,
                        description: edge.description,
                        attributes: { ...edge.attributes }
                    };
                    this.edges.set(newId, newEdge);
                    this.dispatchEvent(new CustomEvent('edgeAdded', { detail: newEdge }));
                }
            });

            // Delete the duplicate node
            this.nodes.delete(dup.id);
            this.dispatchEvent(new CustomEvent('nodeRemoved', { detail: { id: dup.id } }));
        });

        // 3. Clean up parallel edges (multiple connections between same two nodes)
        const seenEdges = new Set();
        const edgesToRemove = [];
        this.edges.forEach(edge => {
            // Create a unique key for the connection (A-B or B-A) + Label
            const pair = [edge.source, edge.target].sort().join('-');
            const key = `${pair}::${edge.label}`;

            if (seenEdges.has(key)) {
                edgesToRemove.push(edge.id);
            } else {
                seenEdges.add(key);
            }
        });

        edgesToRemove.forEach(id => {
            this.deleteEdge(id);
        });

        this.dispatchEvent(new CustomEvent('nodeUpdated', { detail: primary }));
        this.save();
    }

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

    // --- Undo/Redo ---
    _createSnapshot() {
        return {
            graphName: this.graphName,
            nextNodeId: this.nextNodeId,
            nodes: JSON.parse(JSON.stringify(Array.from(this.nodes.values()))),
            edges: JSON.parse(JSON.stringify(Array.from(this.edges.values()))),
            typeStyles: JSON.parse(JSON.stringify(this.typeStyles))
        };
    }
    _pushState() {
        if (this._suspendHistory) return;
        const snapshot = this._createSnapshot();
        this.undoStack.push(snapshot);
        if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
        this.redoStack = [];
    }
    undo() {
        if (this.undoStack.length === 0) return false;
        const current = this._createSnapshot();
        this.redoStack.push(current);
        const previous = this.undoStack.pop();
        this.importJSON(previous); // Re-use import to restore state
        return true;
    }
    redo() {
        if (this.redoStack.length === 0) return false;
        const current = this._createSnapshot();
        this.undoStack.push(current);
        const next = this.redoStack.pop();
        this.importJSON(next);
        return true;
    }

    exportJSON(activeFilters = null) {
        let nodesArray = Array.from(this.nodes.values());
        let edgesArray = Array.from(this.edges.values());

        if (activeFilters && activeFilters.size > 0) {
            nodesArray = nodesArray.filter(n => activeFilters.has(n.type));
            const activeNodeIds = new Set(nodesArray.map(n => n.id));
            edgesArray = edgesArray.filter(e => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
        }

        const data = {
            version: '1.2',
            graphName: this.graphName,
            exported: new Date().toISOString(),
            nextNodeId: this.nextNodeId,
            nodes: nodesArray,
            edges: edgesArray,
            typeStyles: this.typeStyles
        };
        return data;
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

const graphStorage = new GraphStorage();
console.log('📦 Storage.js entry point');
export default graphStorage;
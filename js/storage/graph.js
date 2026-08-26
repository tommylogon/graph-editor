// Node/edge CRUD, groups, search, queries
import { generateDefaultSprite } from './sprites.js';

export const graphMixin = {
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
    },

    async clear() {
        this.nodes.clear();
        this.edges.clear();
        this.nextNodeId = 0;
        this.dispatchEvent(new CustomEvent('graphCleared'));
        await this.save();
    },

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
    },

    updateNode(id, updates) {
        const node = this.nodes.get(id);
        if (!node) return;
        this._pushState();
        Object.assign(node, updates);
        if (updates.properties) Object.assign(node.properties, updates.properties);
        this.dispatchEvent(new CustomEvent('nodeUpdated', { detail: node }));
        this.save();
    },

    getNode(id) { return this.nodes.get(id) || this.nodes.get(Number(id)); },

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
    },

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
    },

    createEdge(sourceId, targetId) {
        if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) return null;
        this._pushState();
        const id = `e${Date.now()}-${Math.random()}`;
        const edge = { id, source: sourceId, target: targetId, type: 'related', label: '', description: '', status: 'active', attributes: { strength: 0.5 } };
        this.edges.set(id, edge);
        this.dispatchEvent(new CustomEvent('edgeAdded', { detail: edge }));
        this.save();
        return id;
    },

    updateEdge(edgeId, updates) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;
        this._pushState();
        Object.assign(edge, updates);
        // Ensure status exists
        if (!edge.status) edge.status = 'active';
        this.dispatchEvent(new CustomEvent('edgeUpdated', { detail: edge }));
        this.save();
    },

    deleteEdge(edgeId) {
        const removed = this.edges.get(edgeId);
        if (!removed) return;
        this._pushState();
        this.edges.delete(edgeId);
        this.dispatchEvent(new CustomEvent('edgeRemoved', { detail: removed }));
        this.save();
    },

    swapEdgeDirection(edgeId) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;
        this._pushState();
        [edge.source, edge.target] = [edge.target, edge.source];
        if (!edge.status) edge.status = 'active';
        this.dispatchEvent(new CustomEvent('edgeUpdated', { detail: edge }));
        this.save();
    },

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
    },

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
    },

    setGroupCollapsed(groupId, collapsed) {
        const group = this.nodes.get(groupId);
        if (group && group.type === 'group') {
            this._pushState();
            group.collapsed = collapsed;
            if (!group.status) group.status = 'active';
            this.dispatchEvent(new CustomEvent('nodeUpdated', { detail: group }));
            this.save();
        }
    },

    ungroup(groupId) {
        const group = this.nodes.get(groupId);
        if (group && group.type === 'group') {
            this._pushState();
            this.nodes.delete(groupId);
            this.dispatchEvent(new CustomEvent('nodeRemoved', { detail: { id: groupId } }));
            this.save();
        }
    }
};

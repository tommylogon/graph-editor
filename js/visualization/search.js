// Filters (type/inactive) and search matching/visibility
import graphStorage from '../storage.js';

export const searchMixin = {
    setFilter(type, isVisible) {
        if (isVisible) this.filters.hiddenTypes.delete(type);
        else this.filters.hiddenTypes.add(type);
        this.applyFilters();
        this.heat(0.5);
    },

    setShowInactive(show) {
        this.filters.showInactive = show;
        this.applyFilters();
        this.heat(0.5);
    },

    applyFilters() {
        const searchActive = this._hideNonMatches && this._searchQuery && this._searchQuery.length > 0;
        if (searchActive) {
            console.log('Search active, using match maps');
        }
        this.nodes.forEach((entry, id) => {
            const data = graphStorage.getNode(id);
            if (!data) return;
            const typeVisible = !this.filters.hiddenTypes.has(data.type);
            const statusVisible = data.status !== 'inactive' || this.filters.showInactive;
            let groupHidden = false;
            if (data.type !== 'group') {
                const groupId = this.nodeToGroup.get(id);
                if (groupId) {
                    const gEntry = this.nodes.get(groupId);
                    if (gEntry && gEntry.collapsed) groupHidden = true;
                }
            }
            let visible = typeVisible && statusVisible && !groupHidden;
            if (searchActive) {
                const matches = this._nodeSearchMatches?.get(id) || false;
                visible = visible && matches;
            }
            entry.mesh.visible = visible;
            if (entry.label) entry.label.visible = visible;
        });

        this.edges.forEach((edge, id) => {
            const source = this.nodes.get(edge.sourceId);
            const target = this.nodes.get(edge.targetId);
            const edgeData = graphStorage.edges.get(id);
            const statusVisible = !edgeData || edgeData.status === 'active' || this.filters.showInactive;
            let visible = source?.mesh.visible && target?.mesh.visible && statusVisible;
            if (searchActive) {
                const matches = this._edgeSearchMatches?.get(id) || false;
                visible = visible && matches;
            }
            edge.line.visible = visible;
            if (edge.label) edge.label.visible = visible;
            if (edge.arrows) edge.arrows.forEach(a => a.visible = visible);
        });

        this.proxyEdges.forEach(proxy => {
            const source = this.nodes.get(proxy.sourceGroup);
            const target = this.nodes.get(proxy.targetExt);
            let visible = source?.mesh.visible && target?.mesh.visible;
            if (searchActive) {
                // Proxy edges are not in the edge map; keep them visible only if both ends are visible
                // (no additional search filtering)
            }
            proxy.line.visible = visible;
            proxy.label.visible = visible;
        });
    },

    applySearch(query, shouldHide = false) {
        // Store query and hide flag immediately for applyFilters to use
        this.currentSearchQuery = query;
        this._hideNonMatches = shouldHide;
        this._searchQuery = query;

        const q = query.toLowerCase().trim();
        const hasQuery = q.length > 0;

        const searchInObj = (obj) => {
            if (!obj) return false;
            if (typeof obj === 'string' || typeof obj === 'number') {
                return obj.toString().toLowerCase().includes(q);
            }
            if (Array.isArray(obj)) {
                return obj.some(item => searchInObj(item));
            }
            if (typeof obj === 'object') {
                return Object.values(obj).some(val => searchInObj(val));
            }
            return false;
        };

        // Build match maps FIRST
        const nodeMatches = new Map();
        const edgeMatches = new Map();

        graphStorage.nodes.forEach((node, id) => {
            const isMatch = !hasQuery ||
                node.label.toLowerCase().includes(q) ||
                searchInObj(node.properties) ||
                (node.imagePrompt && node.imagePrompt.toLowerCase().includes(q));
            nodeMatches.set(id, isMatch);
        });

        graphStorage.edges.forEach((edge) => {
            const sourceMatch = nodeMatches.get(edge.source) || false;
            const targetMatch = nodeMatches.get(edge.target) || false;
            const edgeDataMatch = !hasQuery ||
                (edge.label && edge.label.toLowerCase().includes(q)) ||
                (edge.description && edge.description.toLowerCase().includes(q));
            const isMatch = !hasQuery || edgeDataMatch || (sourceMatch && targetMatch);
            edgeMatches.set(edge.id, isMatch);
        });

        // Store matches for later (for applyFilters and other uses)
        this._nodeSearchMatches = nodeMatches;
        this._edgeSearchMatches = edgeMatches;

        // Apply visibility based on combined filters (type + search)
        this.applyFilters();

        // Apply additional visual styling (emissive, opacity) for search highlighting
        graphStorage.nodes.forEach((node, id) => {
            const entry = this.nodes.get(id);
            if (!entry) return;

            const isMatch = nodeMatches.get(id);
            if (hasQuery) {
                if (isMatch) {
                    if (entry.mesh.material.emissive) {
                        entry.mesh.material.emissive.setHex(0xaaaaaa);
                        entry.mesh.material.emissiveIntensity = 1.5;
                    }
                    entry.mesh.material.opacity = 1.0;
                    entry.mesh.material.transparent = true;
                    if (entry.label) entry.label.material.opacity = 1.0;
                } else {
                    if (entry.mesh.material.emissive) {
                        entry.mesh.material.emissive.setHex(0x000000);
                        entry.mesh.material.emissiveIntensity = 0.1;
                    }
                    entry.mesh.material.opacity = 0.2;
                    entry.mesh.material.transparent = true;
                    if (entry.label) entry.label.material.opacity = 0.2;
                }
            } else {
                if (entry.mesh.material.emissive) {
                    entry.mesh.material.emissive.setHex(0x222222);
                    entry.mesh.material.emissiveIntensity = 1.0;
                }
                entry.mesh.material.opacity = 1.0;
                entry.mesh.material.transparent = false;
                if (entry.label) entry.label.material.opacity = 1.0;
            }
        });

        graphStorage.edges.forEach((edge) => {
            const entry = this.edges.get(edge.id);
            if (!entry) return;

            const isMatch = edgeMatches.get(edge.id);
            if (hasQuery) {
                if (isMatch) {
                    entry.line.material.opacity = 1.0;
                    if (entry.label) entry.label.material.opacity = 1.0;
                } else {
                    entry.line.material.opacity = 1.0;
                    if (entry.label) entry.label.material.opacity = 1.0;
                }
            } else {
                entry.line.material.opacity = 1.0;
                if (entry.label) entry.label.material.opacity = 0.8;
            }
        });
    }
};

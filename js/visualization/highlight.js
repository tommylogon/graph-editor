// Selection highlight: BFS by depth/direction, dimming of non-active elements
import * as THREE from 'three';
import graphStorage from '../storage.js';

export const highlightMixin = {
    _getNeighbors(nodeId) {
        const neighbors = new Set();
        this.edges.forEach(edge => {
            if (edge.sourceId === nodeId) neighbors.add(edge.targetId);
            if (edge.targetId === nodeId) neighbors.add(edge.sourceId);
        });
        return neighbors;
    },

    highlightEdge(edgeId) {
        if (!edgeId) return this.highlightNode(null);

        const edge = graphStorage.edges.get(edgeId);
        if (!edge) return;

        const activeNodes = new Set([edge.source, edge.target]);
        const activeEdges = new Set([edgeId]);

        this._applyHighlightVisuals(activeNodes, activeEdges, null);
    },

    highlightMultipleNodes(nodeIds) {
        if (!nodeIds || nodeIds.size === 0) return this.highlightNode(null);

        const activeNodes = new Set(nodeIds);
        const activeEdges = new Set();

        graphStorage.edges.forEach(edge => {
            // Only highlight edges where both endpoints are selected
            if (activeNodes.has(edge.source) && activeNodes.has(edge.target)) {
                activeEdges.add(edge.id);
            }
        });

        this._applyHighlightVisuals(activeNodes, activeEdges, null);
    },

    highlightNode(startId, state = true) {
        if (startId === null || !state) {
            return this._applyHighlightVisuals(null, null, null);
        }

        const activeNodes = new Set();
        const activeEdges = new Set();
        const queue = [{ id: startId, depth: 0 }];
        activeNodes.add(startId);

        const maxDepth = this.highlightSettings.depth;
        const dir = this.highlightSettings.direction || 'both';

        // BFS Traversal tracking both nodes AND edges depending on direction
        while (queue.length > 0) {
            const current = queue.shift();
            if (current.depth >= maxDepth) continue;

            graphStorage.edges.forEach(edge => {
                let isMatch = false;
                let nextNode = null;

                // Outgoing: Current node is the Source
                if ((dir === 'both' || dir === 'outgoing') && edge.source === current.id) {
                    isMatch = true;
                    nextNode = edge.target;
                }
                // Incoming: Current node is the Target
                else if ((dir === 'both' || dir === 'incoming') && edge.target === current.id) {
                    isMatch = true;
                    nextNode = edge.source;
                }

                if (isMatch) {
                    activeEdges.add(edge.id);
                    if (!activeNodes.has(nextNode)) {
                        activeNodes.add(nextNode);
                        queue.push({ id: nextNode, depth: current.depth + 1 });
                    }
                }
            });
        }

        // Ensure all edges connecting two active nodes are highlighted,
        // even if both endpoints are at the maximum depth (e.g., edge between two neighbors)
        graphStorage.edges.forEach(edge => {
            if (activeNodes.has(edge.source) && activeNodes.has(edge.target)) {
                activeEdges.add(edge.id);
            }
        });

        this._applyHighlightVisuals(activeNodes, activeEdges, startId);
    },

    _applyHighlightVisuals(activeNodes, activeEdges, primaryNodeId) {
        const dimOpacity = this.highlightSettings.dimming;
        const isReset = activeNodes === null;

        const q = this.currentSearchQuery.toLowerCase().trim();
        const hasQuery = q.length > 0;
        const searchFilterActive = this._hideNonMatches && this._searchQuery && this._searchQuery.length > 0;

        // Apply to Nodes
        this.nodes.forEach((entry, id) => {
            const nodeData = graphStorage.getNode(id);
            if (!nodeData) return;

            const isActive = isReset || (activeNodes && activeNodes.has(id));
            const isSearchMatch = !hasQuery || nodeData.label.toLowerCase().includes(q) ||
                (nodeData.properties && JSON.stringify(nodeData.properties).toLowerCase().includes(q));

            // VISIBILITY: If search filter is active, NEVER override visibility here.
            // applySearch() owns visibility in that mode.
            if (!searchFilterActive) {
                if (isReset) {
                    entry.mesh.visible = true;
                    if (entry.label) entry.label.visible = true;
                }
            }

            // OPACITY/HIGHLIGHT: Always update these for the highlight effect
            if (isActive) {
                if (hasQuery && !isSearchMatch) {
                    entry.mesh.material.opacity = dimOpacity;
                    entry.mesh.material.transparent = true;
                } else {
                    entry.mesh.material.opacity = 1.0;
                    entry.mesh.material.transparent = false;
                }

                if (entry.mesh.material.emissive) {
                    const hex = (id === primaryNodeId) ? 0x666666 : 0x222222;
                    entry.mesh.material.emissive.setHex(hex);
                }
                if (entry.label) entry.label.material.opacity = (hasQuery && !isSearchMatch) ? dimOpacity : 1.0;
            } else {
                entry.mesh.material.opacity = dimOpacity;
                entry.mesh.material.transparent = true;
                if (entry.mesh.material.emissive) entry.mesh.material.emissive.setHex(0x000000);
                if (entry.label) entry.label.material.opacity = dimOpacity;
            }
        });

        // Apply to Edges
        this.edges.forEach((entry, edgeId) => {
            const rawEdge = graphStorage.edges.get(edgeId);
            const baseColor = rawEdge?.attributes?.color || '#88aaff';
            const isActive = isReset || activeEdges.has(edgeId);
            console.log('activeEdges size:', activeEdges ? activeEdges.size : 'null');
            // If search filter is active, don't override visibility - applySearch owns it
            // But we still apply dimming/enhancing based on active state if not in pure search mode
            if (searchFilterActive && isReset) {
                // Skip - search handles everything
                return;
            }

            const isSearchMatch = !hasQuery ||
                (rawEdge?.label && rawEdge.label.toLowerCase().includes(q)) ||
                (rawEdge?.description && rawEdge.description.toLowerCase().includes(q));

            if (isActive) {
                // Show this edge prominently (it's part of the highlight or we're resetting)
                entry.line.material.color.set(baseColor);
                entry.line.material.opacity = hasQuery && !isSearchMatch ? dimOpacity : 1.0;
                entry.line.material.transparent = hasQuery && !isSearchMatch;
                if (entry.label) entry.label.material.opacity = hasQuery && !isSearchMatch ? dimOpacity : 1.0;
                if (entry.arrows) entry.arrows.forEach(a => {
                    a.line.material.opacity = hasQuery && !isSearchMatch ? dimOpacity : 1.0;
                    a.cone.material.opacity = hasQuery && !isSearchMatch ? dimOpacity : 1.0;
                    a.setColor(new THREE.Color(baseColor));
                });
            } else {
                // Dim this edge (not in highlight set)
                entry.line.material.color.setHex(0x444444);
                entry.line.material.opacity = dimOpacity;
                entry.line.material.transparent = true;
                if (entry.label) entry.label.material.opacity = dimOpacity;
                if (entry.arrows) entry.arrows.forEach(a => {
                    a.line.material.opacity = dimOpacity;
                    a.cone.material.opacity = dimOpacity;
                    a.setColor(new THREE.Color(0x444444));
                });
            }
        });
    }
};

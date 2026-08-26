// Node visuals: meshes/sprites/labels, groups + proxy edges, degree scaling
import * as THREE from 'three';
import graphStorage from '../storage.js';

export const nodesMixin = {
    addNode(node) {
        const color = this.getNodeColor(node.type, node.id);
        let visual;

        if (node.type === 'group') {
            const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
            const material = new THREE.MeshStandardMaterial({ color, wireframe: true });
            visual = new THREE.Mesh(geometry, material);
            visual.castShadow = true;
            visual.receiveShadow = true;
        } else if (node.visualType === 'sprite' && node.imageUrl) {
            const material = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true });
            visual = new THREE.Sprite(material);
            visual.scale.set(1.5, 1.5, 1);
            this._createCircularSpriteMap(node.imageUrl, (texture) => {
                material.map = texture;
                material.needsUpdate = true;
            });
        } else {
            const geometry = new THREE.SphereGeometry(0.5, 32, 16);
            const material = new THREE.MeshStandardMaterial({ color, emissive: 0x222222 });
            visual = new THREE.Mesh(geometry, material);
            visual.castShadow = true;
            visual.receiveShadow = true;
        }

        const px = (node.position && typeof node.position.x === 'number' && !isNaN(node.position.x)) ? node.position.x : 0;
        const py = (node.position && typeof node.position.y === 'number' && !isNaN(node.position.y)) ? node.position.y : 0;
        const pz = (node.position && typeof node.position.z === 'number' && !isNaN(node.position.z)) ? node.position.z : 0;

        visual.position.set(px, py, pz);
        visual.userData = { id: node.id, type: 'node', nodeType: node.type };

        const labelTexture = this._createLabelTexture(node.label, color);
        const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, depthTest: true });
        const label = new THREE.Sprite(labelMaterial);
        const aspect = labelTexture.image.width / labelTexture.image.height;
        const globalScale = this.physicsConfig.labelSizeMultiplier || 1.0;
        label.scale.set(0.5 * aspect * globalScale, 0.5 * globalScale, 1);
        label.userData = { id: node.id, type: 'node', isLabel: true, lastText: node.label };

        this.scene.add(visual);
        this.scene.add(label);

        this.nodes.set(node.id, {
            mesh: visual,
            label,
            visualType: node.type === 'group' ? 'group' : (node.visualType || 'sphere'),
            lastImageUrl: node.imageUrl,
            velocity: new THREE.Vector3(),
            isLocked: node.isLocked || false,
            members: node.members || null,
            collapsed: node.collapsed || false
        });

        // Debounced: these are expensive and redundant during bulk import
        this._debouncedScalesAndFilters();

        // If it's a group and collapsed, hide members and create proxy edges
        if (node.type === 'group' && node.collapsed) {
            this._collapseGroup(node.id);
        }
    },

    updateNode(node) {
        const entry = this.nodes.get(node.id);
        if (!entry) return;

        const oldCollapsed = entry.collapsed;

        // Robust position update - only set if valid
        if (node.position && !isNaN(node.position.x) && !isNaN(node.position.y) && !isNaN(node.position.z)) {
            entry.mesh.position.set(node.position.x, node.position.y, node.position.z);
        }

        entry.isLocked = node.isLocked;
        entry.collapsed = node.collapsed || false;

        if (entry.label.userData.lastText !== node.label) {
            const color = this.getNodeColor(node.type, node.id);
            entry.label.material.map.dispose();
            entry.label.material.map = this._createLabelTexture(node.label, color);
            entry.label.userData.lastText = node.label;
            const aspect = entry.label.material.map.image.width / entry.label.material.map.image.height;
            const globalScale = this.physicsConfig.labelSizeMultiplier || 1.0;
            entry.label.scale.set(0.5 * aspect * globalScale, 0.5 * globalScale, 1);
        }

        // Handle collapse/expand
        if (node.type === 'group') {
            if (node.collapsed && !oldCollapsed) {
                this._collapseGroup(node.id);
            } else if (!node.collapsed && oldCollapsed) {
                this._expandGroup(node.id);
            }
        }

        this.updateEdgesForNode(node.id);
        this._debouncedScalesAndFilters();
    },

    removeNode(id) {
        const entry = this.nodes.get(id);
        if (!entry) return;

        // If it's a group, clean up proxy edges
        if (entry.visualType === 'group') {
            this._expandGroup(id); // removes proxies and shows members
        }

        if (entry.label) {
            this.scene.remove(entry.label);
            if (entry.label.material.map) entry.label.material.map.dispose();
            entry.label.material.dispose();
        }
        this.scene.remove(entry.mesh);
        entry.mesh.geometry?.dispose();
        entry.mesh.material?.dispose();
        this.nodes.delete(id);

        this.edges.forEach((edge, edgeId) => {
            if (edge.sourceId === id || edge.targetId === id) {
                this.removeEdge(edgeId);
            }
        });

        this.updateNodeScales();
    },

    _collapseGroup(groupId) {
        const groupEntry = this.nodes.get(groupId);
        if (!groupEntry) return;
        const group = graphStorage.getNode(groupId);
        if (!group || !group.members) return;

        // Hide member nodes
        group.members.forEach(mId => {
            const m = this.nodes.get(mId);
            if (m) {
                m.mesh.visible = false;
                if (m.label) m.label.visible = false;
            }
        });

        // Find external connections
        const extMap = new Map(); // externalId -> Set of memberIds
        group.members.forEach(mId => {
            graphStorage.edges.forEach(edge => {
                if (edge.source === mId || edge.target === mId) {
                    const other = edge.source === mId ? edge.target : edge.source;
                    if (!group.members.includes(other)) {
                        if (!extMap.has(other)) extMap.set(other, new Set());
                        extMap.get(other).add(mId);
                    }
                }
            });
        });

        // Create proxy edges (dashed)
        extMap.forEach((memberSet, extId) => {
            const proxyId = `proxy-${groupId}-${extId}`;
            this._createProxyEdge(proxyId, groupId, extId, memberSet.size);
        });
    },

    _expandGroup(groupId) {
        const groupEntry = this.nodes.get(groupId);
        if (!groupEntry) return;
        const group = graphStorage.getNode(groupId);
        if (!group) return;

        // Show members
        group.members.forEach(mId => {
            const m = this.nodes.get(mId);
            if (m) {
                m.mesh.visible = true;
                if (m.label) m.label.visible = true;
            }
        });

        // Remove proxy edges
        this.proxyEdges.forEach((proxy, proxyId) => {
            if (proxy.sourceGroup === groupId) {
                this._removeProxyEdge(proxyId);
            }
        });
    },

    _createProxyEdge(proxyId, sourceGroupId, targetExtId, count) {
        const sourceEntry = this.nodes.get(sourceGroupId);
        const targetEntry = this.nodes.get(targetExtId);
        if (!sourceEntry || !targetEntry) return;

        const points = [sourceEntry.mesh.position.clone(), targetEntry.mesh.position.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({ color: 0x88aaff, dashSize: 0.2, gapSize: 0.1 });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.userData = { type: 'proxyEdge' };

        const labelTexture = this._createLabelTexture(`↔ ${count}`, 0x88aaff, true);
        const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, depthTest: true });
        const label = new THREE.Sprite(labelMaterial);
        const aspect = labelTexture.image.width / labelTexture.image.height;
        const globalScale = this.physicsConfig.labelSizeMultiplier || 1.0;
        label.scale.set(0.25 * aspect * globalScale, 0.25 * globalScale, 1);
        label.position.lerpVectors(sourceEntry.mesh.position, targetEntry.mesh.position, 0.5);

        this.scene.add(line);
        this.scene.add(label);

        this.proxyEdges.set(proxyId, { line, label, sourceGroup: sourceGroupId, targetExt: targetExtId });
    },

    _removeProxyEdge(proxyId) {
        const entry = this.proxyEdges.get(proxyId);
        if (!entry) return;
        this.scene.remove(entry.line);
        entry.line.geometry?.dispose();
        entry.line.material?.dispose();
        this.scene.remove(entry.label);
        entry.label.material.map?.dispose();
        entry.label.material.dispose();
        this.proxyEdges.delete(proxyId);
    },

    updateNodeScales() {
        // Pre-calculate degrees only if needed (or we can just do it, but let's be efficient)
        const degrees = new Map();
        graphStorage.edges.forEach(edge => {
            degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
            degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
        });

        this.nodes.forEach((entry, id) => {
            const degree = degrees.get(id) || 0;
            const isHovered = this.hoveredNodeId === id;

            // Calculate Target Scale
            let baseScale = Math.min(1.0 + degree * 0.2, 3.0);
            let finalScale = isHovered ? baseScale * 1.5 : baseScale;

            // Apply to Mesh
            if (entry.visualType === 'sprite') {
                entry.mesh.scale.set(finalScale * 1.5, finalScale * 1.5, 1);
            } else {
                entry.mesh.scale.set(finalScale, finalScale, finalScale);
            }

            // Apply Glow
            if (entry.mesh.material && entry.mesh.material.emissive) {
                if (isHovered) {
                    entry.mesh.material.emissive.setHex(0xaaaaaa);
                    entry.mesh.material.emissiveIntensity = 2.0;
                } else {
                    entry.mesh.material.emissive.setHex(0x222222);
                    entry.mesh.material.emissiveIntensity = 1.0;
                }
            }

            // Apply to Label
            if (entry.label) {
                const radius = entry.visualType === 'sprite' ? 0.75 * finalScale : 0.5 * finalScale;
                const aspect = entry.label.material.map.image.width / entry.label.material.map.image.height;
                const globalScale = this.physicsConfig.labelSizeMultiplier || 1.0;

                const labelScale = (isHovered ? 0.8 : 0.5) * globalScale;
                entry.label.scale.set(labelScale * aspect, labelScale, 1);
                entry.label.position.copy(entry.mesh.position);
                entry.label.position.y += radius + (isHovered ? 0.5 : 0.3);

                // Keep hovered label on top of others
                entry.label.renderOrder = isHovered ? 100 : 0;
            }
        });
    }
};

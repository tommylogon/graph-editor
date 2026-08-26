// visualization.js - v1.0.1 (Cache Buster)
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import graphStorage from './storage.js';

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
            dimming: 0.35,    // Opacity of non-selected items
            direction: 'both' // NEW: 'both', 'outgoing', 'incoming'
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
            file:'#aaff88',
            folder:'#ffaaff'
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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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


    addEdge(edge) {
        const source = this.nodes.get(edge.source);
        const target = this.nodes.get(edge.target);
        if (!source || !target) return;

        const colorStr = edge.attributes?.color || graphStorage.typeStyles?.edge?.[edge.type] || '#88aaff';
        const color = new THREE.Color(colorStr);

        // Use Line2 for real GPU-rendered line thickness
        const geometry = new LineGeometry();
        // Initialize with 21 points (for bezier curves) as flat [x,y,z,x,y,z,...]
        geometry.setPositions(new Float32Array(21 * 3));

        const material = new LineMaterial({
            color: color.getHex(),
            linewidth: (this.physicsConfig.edgeThickness || 1), 
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
        });

        const line = new Line2(geometry, material);
        line.computeLineDistances();
        line.userData = { id: edge.id, type: 'edge' };

        const labelTexture = this._createLabelTexture(edge.label || '', 0x88aaff, true);
        const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, depthTest: true });
        const label = new THREE.Sprite(labelMaterial);
        const aspect = labelTexture.image.width / labelTexture.image.height;
        const globalScale = this.physicsConfig.labelSizeMultiplier || 1.0;
        label.scale.set(0.3 * aspect * globalScale, 0.3 * globalScale, 1);
        label.userData = { id: edge.id, type: 'edge', isLabel: true, lastText: edge.label };

        const sortedIds = [edge.source, edge.target].sort();
        const pairKey = sortedIds.join('|');
        this.edges.set(edge.id, { line, label, arrows: [], sourceId: edge.source, targetId: edge.target, pairKey });

        // Update Pair Map
        if (!this.pairMap.has(pairKey)) {
            this.pairMap.set(pairKey, { idA: sortedIds[0], idB: sortedIds[1], edgeIds: new Set() });

            // Update Node-to-Pairs index
            [edge.source, edge.target].forEach(id => {
                if (!this.nodeToPairs.has(id)) this.nodeToPairs.set(id, new Set());
                this.nodeToPairs.get(id).add(pairKey);
            });
        }
        this.pairMap.get(pairKey).edgeIds.add(edge.id);

        this.scene.add(line);
        this.scene.add(label);
        this.updateEdgesForNode(edge.source);
    }

    updateEdge(edge) {
        const entry = this.edges.get(edge.id);
        if (entry) {
            const colorStr = edge.attributes?.color || graphStorage.typeStyles?.edge?.[edge.type] || '#88aaff';
            const color = new THREE.Color(colorStr);
            entry.line.material.color = color;
            entry.line.material.linewidth = this.physicsConfig.edgeThickness || 1;

            if (entry.label.userData.lastText !== edge.label) {
                entry.label.material.map.dispose();
                entry.label.material.map = this._createLabelTexture(edge.label || '', colorStr, true);
                entry.label.userData.lastText = edge.label;
                const aspect = entry.label.material.map.image.width / entry.label.material.map.image.height;
                entry.label.scale.set(0.3 * aspect, 0.3, 1);
            }
            this.updateEdgesForNode(edge.source);
        } else {
            this.addEdge(edge);
        }
    }

    removeEdge(id) {
        const entry = this.edges.get(id);
        if (!entry) return;
        if (entry.label) {
            this.scene.remove(entry.label);
            if (entry.label.material.map) entry.label.material.map.dispose();
            entry.label.material.dispose();
        }
        this.scene.remove(entry.line);
        entry.line.geometry?.dispose();
        entry.line.material?.dispose();
        if (entry.arrows) {
            entry.arrows.forEach(arrow => this.scene.remove(arrow));
        }

        // Update Pair Map
        const pairKey = entry.pairKey;
        if (this.pairMap.has(pairKey)) {
            const pairData = this.pairMap.get(pairKey);
            pairData.edgeIds.delete(id);
            if (pairData.edgeIds.size === 0) {
                // If no more edges between these two nodes, cleanup indices
                this.nodeToPairs.get(pairData.idA)?.delete(pairKey);
                this.nodeToPairs.get(pairData.idB)?.delete(pairKey);
                this.pairMap.delete(pairKey);
            }
        }

        this.edges.delete(id);
    }

    updateEdgesForNode(nodeId) {
        const pairKeys = this.nodeToPairs.get(nodeId);
        if (!pairKeys) return;
        pairKeys.forEach(pairKey => {
            const pairData = this.pairMap.get(pairKey);
            if (pairData) this.updateEdgePair(pairData.idA, pairData.idB);
        });
    }

    updateEdgePair(idA, idB) {
        const pairKey = [idA, idB].sort().join('|');
        const pairData = this.pairMap.get(pairKey);
        if (!pairData || pairData.edgeIds.size === 0) return;

        const edgesInPair = Array.from(pairData.edgeIds).map(id => this.edges.get(id)).filter(Boolean);
        if (edgesInPair.length === 0) return;

        const nodeA = this.nodes.get(idA);
        const nodeB = this.nodes.get(idB);
        if (!nodeA || !nodeB) return;

        // Determine base geometry from sorted positions (pA -> pB)
        // This ensures consistent "Perpendicular" calculation regardless of edge direction
        const pA = nodeA.mesh.position;
        const pB = nodeB.mesh.position;
        const mid = new THREE.Vector3().lerpVectors(pA, pB, 0.5);
        const diff = new THREE.Vector3().subVectors(pB, pA);
        const dist = diff.length();

        // Safety: if nodes are at the same spot, don't try to draw curvy lines or normals
        if (dist < 0.001) {
            edgesInPair.forEach(entry => {
                const positions = [pA.x, pA.y, pA.z, pB.x, pB.y, pB.z];
                entry.line.geometry.dispose();
                const geom = new LineGeometry();
                geom.setPositions(positions);
                entry.line.geometry = geom;
                entry.line.computeLineDistances();
                if (entry.arrows) entry.arrows.forEach(a => this.scene.remove(a));
                entry.arrows = [];
            });
            return;
        }

        let normal = new THREE.Vector3(0, 1, 0);
        const normalizedDiff = diff.clone().normalize();
        if (Math.abs(normalizedDiff.dot(normal)) > 0.9) {
            normal.set(1, 0, 0);
        }
        let perp = new THREE.Vector3().crossVectors(diff, normal);
        if (perp.lengthSq() < 0.0001) {
            // Fallback if diff and normal were parallel
            normal.set(0, 0, 1);
            perp.crossVectors(diff, normal);
            if (perp.lengthSq() < 0.0001) {
                perp.set(1, 0, 0); // Absolute fallback
            }
        }
        perp.normalize();

        // Final safety: if math still failed
        if (isNaN(perp.x)) perp.set(0, 1, 0);

        edgesInPair.forEach((entry, index) => {
            const count = edgesInPair.length;
            const edgeId = entry.line.userData.id;
            const rawEdge = graphStorage.edges.get(edgeId);
            const edgeColorStr = rawEdge?.attributes?.color || graphStorage.typeStyles?.edge?.[rawEdge?.type] || '#88aaff';
            const edgeColor = new THREE.Color(edgeColorStr);
            entry.line.material.color.set(edgeColor);
            entry.line.material.linewidth = (this.physicsConfig.edgeThickness || 1);
            entry.line.material.resolution.set(window.innerWidth, window.innerHeight);
            // Spreads lines apart: e.g. -0.75, +0.75
            const bendFactor = (index - (count - 1) / 2) * 1.5;

            // --- 1. Draw the Line ---
            let points;
            let midPoint;

            if (count === 1) {
                points = [pA.clone(), pB.clone()];
                midPoint = mid.clone();
            } else {
                const control = mid.clone().add(perp.clone().multiplyScalar(bendFactor));
                const curve = new THREE.QuadraticBezierCurve3(pA, control, pB);
                points = curve.getPoints(20);
                midPoint = curve.getPoint(0.5);
            }

            // Point scrubbing with hard fallback to mid-point if any NaN detected
            const cleanPoints = points.map(p => {
                if (!p || isNaN(p.x) || isNaN(p.y) || isNaN(p.z)) return mid.clone();
                return p;
            });

            // Convert to flat array for LineGeometry
            const positions = [];
            cleanPoints.forEach(p => positions.push(p.x, p.y, p.z));

            // Update LineGeometry
            entry.line.geometry.dispose();
            const newGeom = new LineGeometry();
            newGeom.setPositions(positions);
            entry.line.geometry = newGeom;
            entry.line.computeLineDistances();

            if (entry.label) {
                const aspect = entry.label.material.map.image.width / entry.label.material.map.image.height;
                const globalScale = this.physicsConfig.labelSizeMultiplier || 1.0;
                entry.label.scale.set(0.3 * aspect * globalScale, 0.3 * globalScale, 1);
                entry.label.position.copy(midPoint);
                entry.label.position.y += 0.2;
            }

            // --- 2. Draw/Update the Arrow (The Direction Indicator) ---
            if (dist > 0.5) {
                const t = 0.7; // Position of arrow along the curve (0.0 to 1.0)
                const pS = this.nodes.get(entry.sourceId).mesh.position; // Actual Source
                const pT = this.nodes.get(entry.targetId).mesh.position; // Actual Target
                let arrowPos, arrowDir;

                if (count === 1) {
                    // Straight line logic
                    arrowPos = new THREE.Vector3().lerpVectors(pS, pT, t);
                    arrowDir = new THREE.Vector3().subVectors(pT, pS).normalize();
                } else {
                    const control = mid.clone().add(perp.clone().multiplyScalar(bendFactor));
                    const curve = new THREE.QuadraticBezierCurve3(pS, control, pT);
                    arrowPos = curve.getPoint(t);
                    arrowDir = curve.getTangent(t).normalize();
                }

                // Arrow safety check
                if (isNaN(arrowDir.x) || isNaN(arrowPos.x)) return;

                // Optimization: Reuse arrow object if it exists to prevent FPS drop
                if (!entry.arrows || entry.arrows.length === 0) {
                    const arrowHelper = new THREE.ArrowHelper(arrowDir, arrowPos, 0.3, edgeColor, 0.2, 0.15); // UPDATED COLOR
                    arrowHelper.userData = { id: entry.line.userData.id, type: 'edge' };
                    // Ensure raycaster hits parts of the arrow
                    arrowHelper.line.userData = arrowHelper.userData;
                    arrowHelper.cone.userData = arrowHelper.userData;

                    this.scene.add(arrowHelper);
                    entry.arrows = [arrowHelper];
                } else {
                    // Update existing arrow
                    entry.arrows[0].setDirection(arrowDir);
                    entry.arrows[0].position.copy(arrowPos);
                    entry.arrows[0].setColor(edgeColor);
                }
            } else {
                // If nodes are too close, hide arrow
                if (entry.arrows) {
                    entry.arrows.forEach(arrow => this.scene.remove(arrow));
                    entry.arrows = [];
                }
            }
        });
    }

    _getNeighbors(nodeId) {
        const neighbors = new Set();
        this.edges.forEach(edge => {
            if (edge.sourceId === nodeId) neighbors.add(edge.targetId);
            if (edge.targetId === nodeId) neighbors.add(edge.sourceId);
        });
        return neighbors;
    }

    highlightEdge(edgeId) {
        if (!edgeId) return this.highlightNode(null);

        const edge = graphStorage.edges.get(edgeId);
        if (!edge) return;

        const activeNodes = new Set([edge.source, edge.target]);
        const activeEdges = new Set([edgeId]);

        this._applyHighlightVisuals(activeNodes, activeEdges, null);
    }

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
    }

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
    }

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

    setFilter(type, isVisible) {
        if (isVisible) this.filters.hiddenTypes.delete(type);
        else this.filters.hiddenTypes.add(type);
        this.applyFilters();
        this.heat(0.5);
    }

    setShowInactive(show) {
        this.filters.showInactive = show;
        this.applyFilters();
        this.heat(0.5);
    }

    get activeFilters() {
        const allTypes = ['person', 'location', 'item', 'concept', 'group'];
        const active = new Set();
        allTypes.forEach(t => {
            if (!this.filters.hiddenTypes.has(t)) active.add(t);
        });
        return active;
    }

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
            //console.log(`Node ${id} (${data?.label}): typeVisible=${typeVisible}, statusVisible=${statusVisible}, groupHidden=${groupHidden}, final visible=${visible}`);
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
            //console.log('Edge ${id}.line.visible:', edge.line.visible)
            if (edge.label) edge.label.visible = visible;
            if (edge.arrows) edge.arrows.forEach(a => a.visible = visible);
        });

        this.proxyEdges.forEach(proxy => {
            const source = this.nodes.get(proxy.sourceGroup);
            const target = this.nodes.get(proxy.targetExt);
            let visible = source?.mesh.visible && target?.mesh.visible;
            if (searchActive) {
                // Proxy edges are not in the edge map, so we may need a custom condition
                // For simplicity, keep them visible only if both ends are visible
                // (no additional search filtering)
            }
            proxy.line.visible = visible;
            proxy.label.visible = visible;
        });
    }

    applyPhysics() {
    const speedMod = this.physicsConfig.speed || 1.0;
    const epsilon = 0.0001;
    if (isNaN(this.physicsConfig.alpha)) this.physicsConfig.alpha = 1.0;

    const enabled = this.physicsConfig.enabled;
    const shouldSimulate = enabled && this.physicsConfig.speed > 0;
    if (shouldSimulate) {
        this.physicsConfig.alpha += (this.physicsConfig.alphaTarget - this.physicsConfig.alpha) * this.physicsConfig.alphaDecay * speedMod;
    }
    const computeForces = shouldSimulate && this.physicsConfig.alpha >= 0.001;
    const alpha = this.physicsConfig.alpha;

    // Gather visible node IDs
    const nodeIds = Array.from(this.nodes.keys()).filter(id => this.nodes.get(id).mesh.visible);
    const forces = new Map();
    if (computeForces) {
        nodeIds.forEach(id => forces.set(id, new THREE.Vector3()));
    }

    // --- Pre‑compute type centers (optimization: only every few frames) ---
    let typeCenters = new Map(); // type -> { sum: THREE.Vector3, count: int }
    if (computeForces && (this._frameCounter % 3 === 0)) { // recompute every 3 frames
        nodeIds.forEach(id => {
            const nodeData = graphStorage.getNode(id);
            if (!nodeData) return;
            const type = nodeData.type;
            if (!typeCenters.has(type)) typeCenters.set(type, { sum: new THREE.Vector3(), count: 0 });
            const entry = typeCenters.get(type);
            entry.sum.add(this.nodes.get(id).mesh.position);
            entry.count++;
        });
        typeCenters.forEach(entry => entry.sum.divideScalar(entry.count));
        this._typeCentersCache = typeCenters;
    } else {
        // Use cached centers from last full compute
        typeCenters = this._typeCentersCache || new Map();
    }

    // --- Build connected pairs lookup (only needed when computeForces) ---
    const connectedPairs = new Set();
    if (computeForces) {
        graphStorage.edges.forEach(edge => {
            const key = [edge.source, edge.target].sort().join('|');
            connectedPairs.add(key);
        });
    }

    // --- Reusable temp vectors (avoid allocations) ---
    const _v1 = new THREE.Vector3();
    const _v2 = new THREE.Vector3();
    const _v3 = new THREE.Vector3();

    // --- Repulsion forces with type scaling ---
    if (computeForces) {
        
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const idA = nodeIds[i];
                const idB = nodeIds[j];
                const nodeA = this.nodes.get(idA);
                const nodeB = this.nodes.get(idB);
                if (isNaN(nodeA.mesh.position.x) || isNaN(nodeB.mesh.position.x)) continue;

                const dir = _v1.subVectors(nodeA.mesh.position, nodeB.mesh.position);
                let distSq = dir.lengthSq();
                if (distSq < epsilon || isNaN(distSq)) {
                    dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                    distSq = epsilon;
                }
                const dist = Math.sqrt(distSq);
                const rA = this.getNodeRadius(nodeA);
                const rB = this.getNodeRadius(nodeB);
                const minSafeDist = rA + rB + this.physicsConfig.collisionRadiusPadding;

                // Base repulsion magnitude (inverse square)
                let repulsionMag = (this.physicsConfig.repulsion * alpha * (rA + rB)) / distSq;
                repulsionMag = Math.min(repulsionMag, 5.0);

                // Type‑based scaling
                let typeFactor = 1.0;
                const nodeDataA = graphStorage.getNode(idA);
                const nodeDataB = graphStorage.getNode(idB);
                if (nodeDataA && nodeDataB) {
                    if (nodeDataA.type === nodeDataB.type) {
                        typeFactor = this.physicsConfig.sameTypeRepulsionFactor ?? 0.3;
                    } else {
                        typeFactor = this.physicsConfig.diffTypeRepulsionFactor ?? 2.0;
                    }
                }
                const pairKey = [idA, idB].sort().join('|');
                if (connectedPairs.has(pairKey)) {
                    typeFactor = this.physicsConfig.connectedRepulsionFactor ?? 0.1;
                }

                const forceMag = repulsionMag * typeFactor;
                const force = _v2.copy(dir).normalize().multiplyScalar(forceMag);
                forces.get(idA).add(force);
                forces.get(idB).sub(force); // negate efficiently

                // Collision resolution
                if (dist < minSafeDist) {
                    const overlap = minSafeDist - dist;
                    let collisionMag = overlap * 0.5;
                    collisionMag = Math.min(collisionMag, 2.0);
                    const collisionForce = _v3.copy(dir).normalize().multiplyScalar(collisionMag);
                    forces.get(idA).add(collisionForce);
                    forces.get(idB).sub(collisionForce);
                }
            }
        }
    }

    // --- Edge attraction (unchanged) ---
    if (computeForces) {
        graphStorage.edges.forEach(edge => {
            const nodeA = this.nodes.get(edge.source);
            const nodeB = this.nodes.get(edge.target);
            if (!nodeA?.mesh.visible || !nodeB?.mesh.visible) return;
            if (isNaN(nodeA.mesh.position.x) || isNaN(nodeB.mesh.position.x)) return;
            const dir = _v1.subVectors(nodeB.mesh.position, nodeA.mesh.position);
            const dist = dir.length();
            if (dist < epsilon) return;
            const rA = this.getNodeRadius(nodeA);
            const rB = this.getNodeRadius(nodeB);
            const restDist = rA + rB + this.physicsConfig.minDist;
            let forceMag = (dist - restDist) * this.physicsConfig.attraction * alpha;
            forceMag = Math.max(-10, Math.min(10, forceMag));
            const force = _v2.copy(dir).normalize().multiplyScalar(forceMag);
            forces.get(edge.source).add(force);
            forces.get(edge.target).sub(force);
        });
    }

    // --- Cluster attraction (pull toward type center, scaled by distance) ---
    if (computeForces && this.physicsConfig.clusterStrength) {
        nodeIds.forEach(id => {
            const nodeData = graphStorage.getNode(id);
            if (!nodeData) return;
            const type = nodeData.type;
            const center = typeCenters.get(type)?.sum;
            if (!center) return;
            const pos = this.nodes.get(id).mesh.position;
            const dir = _v1.subVectors(center, pos);
            const dist = dir.length();
            const minClusterDist = this.physicsConfig.minClusterDist ?? 0;
            if (dist > minClusterDist) {
                // Force proportional to distance (like a spring)
                const forceMag = dist * this.physicsConfig.clusterStrength * alpha;
                const force = _v2.copy(dir).normalize().multiplyScalar(forceMag);
                forces.get(id).add(force);
            }
        });
    }

    // --- Orbital rings (apply to cluster centers or weaken to avoid conflict) ---
    if (computeForces && this.physicsConfig.ringSpacing && this.physicsConfig.ringStrength) {
        // Option A: apply to cluster centers instead of nodes
        if (this.physicsConfig.applyRingToClusters) {
            typeCenters.forEach((center, type) => {
                const ringIndex = this.physicsConfig.ringMap?.[type] ?? 0;
                const targetRadius = ringIndex * this.physicsConfig.ringSpacing;
                const currentRadius = center.sum.length();
                if (currentRadius === 0) return;
                const radialDir = _v1.copy(center.sum).normalize();
                const forceMag = (targetRadius - currentRadius) * this.physicsConfig.ringStrength * alpha;
                const force = radialDir.multiplyScalar(forceMag);
                // Apply to all nodes of this type (optional, or just move center)
                // For simplicity, we'll move the center itself – nodes will follow via cluster attraction.
                // Not shown here.
            });
        } else {
            // Original node‑level ring force (weakened)
            nodeIds.forEach(id => {
                const nodeData = graphStorage.getNode(id);
                if (!nodeData) return;
                const ringIndex = this.physicsConfig.ringMap?.[nodeData.type] ?? 0;
                const targetRadius = ringIndex * this.physicsConfig.ringSpacing;
                const pos = this.nodes.get(id).mesh.position;
                const currentRadius = pos.length();
                if (currentRadius === 0) return;
                const radialDir = _v1.copy(pos).normalize();
                const forceMag = (targetRadius - currentRadius) * this.physicsConfig.ringStrength * 0.1 * alpha; // weakened
                const force = radialDir.multiplyScalar(forceMag);
                forces.get(id).add(force);
            });
        }
    }

    // --- Center gravity with min/max radius ---
    if (computeForces) {
        const gravityStrength = 0.01 * alpha;
        nodeIds.forEach(id => {
            const pos = this.nodes.get(id).mesh.position;
            const dist = pos.length();
            let forceDir = _v1.copy(pos).negate(); // inward
            if (dist > this.physicsConfig.maxRadius && this.physicsConfig.maxRadius) {
                // already pulling inward, keep as is
            } else if (dist < this.physicsConfig.minRadius && this.physicsConfig.minRadius) {
                forceDir = pos.clone().normalize(); // outward
            }
            const force = forceDir.multiplyScalar(gravityStrength);
            forces.get(id).add(force);
        });
    }

    // --- Apply forces and update positions (same as before, with the new forces) ---
    const maxDisplacement = 1.0 * alpha;
    this.nodes.forEach((entry, id) => {
        if (!entry.mesh.visible) {
            const groupId = this.nodeToGroup.get(id);
            if (groupId) {
                const gEntry = this.nodes.get(groupId);
                if (gEntry && gEntry.collapsed) {
                    entry.mesh.position.copy(gEntry.mesh.position);
                    entry.velocity.set(0, 0, 0);
                }
            }
            return;
        }

        if (entry.isLocked || entry.isDragging) {
            entry.velocity.set(0, 0, 0);
            if (entry.label) {
                const radius = this.getNodeRadius(entry);
                entry.label.position.copy(entry.mesh.position);
                entry.label.position.y += radius + 0.3;
            }
            return;
        }

        if (computeForces) {
            const force = forces.get(id);
            if (force) {
                if (force.length() > maxDisplacement) force.setLength(maxDisplacement);
                entry.velocity.add(force.multiplyScalar(speedMod)).multiplyScalar(this.physicsConfig.damping * (speedMod > 0 ? 1 : 0));
            }
        } else {
            entry.velocity.set(0, 0, 0);
        }

        // NaN protection
        if (isNaN(entry.mesh.position.x) || isNaN(entry.mesh.position.y) || isNaN(entry.mesh.position.z)) {
            entry.mesh.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
            entry.velocity.set(0, 0, 0);
        }

        entry.mesh.position.add(entry.velocity);
        if (this.physicsConfig.is2D) {
            entry.mesh.position.y = 0;
            entry.velocity.y = 0;
        } else {
            const activeNode = graphStorage.getNode(id);
            if (activeNode && activeNode.layer !== undefined && activeNode.layer !== null && activeNode.layer !== "") {
                const l = parseInt(activeNode.layer);
                if (!isNaN(l)) {
                    const targetY = l * 12;
                    entry.mesh.position.y += (targetY - entry.mesh.position.y) * 0.15;
                    entry.velocity.y *= 0.5;
                }
            }
        }
        if (entry.label) {
            const radius = this.getNodeRadius(entry);
            entry.label.position.copy(entry.mesh.position);
            entry.label.position.y += radius + 0.3;
        }
    });

    // --- Lazy edge updates (unchanged) ---
    const movementThreshold = 0.0000001;
    this.pairMap.forEach(pairData => {
        const nA = this.nodes.get(pairData.idA);
        const nB = this.nodes.get(pairData.idB);
        if (!nA || !nB) return;
        const movedA = nA.lastVisualPos ? nA.mesh.position.distanceToSquared(nA.lastVisualPos) > movementThreshold : true;
        const movedB = nB.lastVisualPos ? nB.mesh.position.distanceToSquared(nB.lastVisualPos) > movementThreshold : true;
        if (movedA || movedB) {
            this.updateEdgePair(pairData.idA, pairData.idB);
        }
    });

    // Store current positions for next frame
    this.nodes.forEach(n => {
        if (!n.lastVisualPos) n.lastVisualPos = new THREE.Vector3();
        n.lastVisualPos.copy(n.mesh.position);
    });

    // Update proxy edges
    this.proxyEdges.forEach(proxy => {
        const source = this.nodes.get(proxy.sourceGroup);
        const target = this.nodes.get(proxy.targetExt);
        if (source && target) {
            const points = [source.mesh.position.clone(), target.mesh.position.clone()];
            proxy.line.geometry.dispose();
            proxy.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
            proxy.line.computeLineDistances();
            proxy.label.position.lerpVectors(source.mesh.position, target.mesh.position, 0.5);
        }
    });

    this._frameCounter = (this._frameCounter || 0) + 1;
}

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
}

export default GraphVisualization;
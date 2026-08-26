// Edge visuals: thick Line2 lines, bezier curves for parallel edges, arrows, pair indexing
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import graphStorage from '../storage.js';

export const edgesMixin = {
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
    },

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
    },

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
    },

    updateEdgesForNode(nodeId) {
        const pairKeys = this.nodeToPairs.get(nodeId);
        if (!pairKeys) return;
        pairKeys.forEach(pairKey => {
            const pairData = this.pairMap.get(pairKey);
            if (pairData) this.updateEdgePair(pairData.idA, pairData.idB);
        });
    },

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
};

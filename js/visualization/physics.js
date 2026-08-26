// Force-directed physics simulation
import * as THREE from 'three';
import graphStorage from '../storage.js';

export const physicsMixin = {
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

        // --- Pre-compute type centers (optimization: only every few frames) ---
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

                    // Type-based scaling
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

        // --- Edge attraction ---
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
                    // For simplicity, we'll move the center itself, nodes will follow via cluster attraction.
                    // Not shown here.
                });
            } else {
                // Original node-level ring force (weakened)
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

        // --- Apply forces and update positions ---
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

        // --- Lazy edge updates ---
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
};

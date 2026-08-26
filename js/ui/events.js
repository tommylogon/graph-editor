// Canvas event wiring: pointer/drag, context menu routing, click selection, keyboard, hover
import * as THREE from 'three';
import graphStorage from '../storage.js';
import { validateEdgeCreation } from './utils.js';

export const eventsMixin = {
    setupEventListeners() {
        let mouseDownPos = { x: 0, y: 0 };
        let isDragging = false;
        let isMouseDown = false;
        const dragThreshold = 5;

        this.domElement.addEventListener('pointerdown', (e) => {
            isMouseDown = true;
            mouseDownPos = { x: e.clientX, y: e.clientY };
            isDragging = false;

            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                document.activeElement.blur();
            }

            // Left button: set up node dragging
            if (e.button === 0) {
                const rect = this.domElement.getBoundingClientRect();
                const mouse = new THREE.Vector2(
                    ((e.clientX - rect.left) / rect.width) * 2 - 1,
                    -((e.clientY - rect.top) / rect.height) * 2 + 1
                );
                this.raycaster.setFromCamera(mouse, this.camera);
                const allIntersects = this.raycaster.intersectObjects(this.scene.children.filter(c => c.userData && c.userData.id !== undefined && c.visible));
                const nodeIntersects = allIntersects.filter(i => i.object.userData.type === 'node');
                if (nodeIntersects.length > 0) {
                    this.draggedNodeId = nodeIntersects[0].object.userData.id;
                    const visNode = window.__vis.nodes.get(this.draggedNodeId);
                    if (visNode) {
                        visNode.isDragging = true;
                        if (window.__controls) window.__controls.enabled = false;
                        window.__vis.heat(0.5);
                    }
                    this.dragPlane.setFromNormalAndCoplanarPoint(
                        this.camera.getWorldDirection(new THREE.Vector3()).negate(),
                        nodeIntersects[0].object.position
                    );
                    const intersection = new THREE.Vector3();
                    if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
                        this.dragOffset.copy(nodeIntersects[0].object.position).sub(intersection);
                    }
                }
            }

            if (this.contextMenu.style.display === 'block') {
                this.hideMenu();
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (!isMouseDown) return;

            const dist = Math.sqrt(Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2));

            if (dist > dragThreshold) {
                isDragging = true;

                if (this.draggedNodeId !== null) {
                    const rect = this.domElement.getBoundingClientRect();
                    const mouse = new THREE.Vector2(
                        ((e.clientX - rect.left) / rect.width) * 2 - 1,
                        -((e.clientY - rect.top) / rect.height) * 2 + 1
                    );
                    this.raycaster.setFromCamera(mouse, this.camera);

                    const intersection = new THREE.Vector3();
                    if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
                        const newPos = intersection.add(this.dragOffset);
                        const visNode = window.__vis.nodes.get(this.draggedNodeId);
                        if (visNode) {
                            // Calculate delta for members to follow
                            const delta = new THREE.Vector3().subVectors(newPos, visNode.mesh.position);

                            visNode.mesh.position.copy(newPos);
                            if (window.__vis.physicsConfig.is2D) visNode.mesh.position.y = 0;

                            // If it's a group, move members too
                            if (visNode.visualType === 'group' && visNode.members) {
                                visNode.members.forEach(mId => {
                                    const mEntry = window.__vis.nodes.get(mId);
                                    if (mEntry) {
                                        mEntry.mesh.position.add(delta);
                                        mEntry.velocity.set(0, 0, 0); // Stabilize members
                                    }
                                });
                            }
                        }
                    }
                }
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.draggedNodeId !== null) {
                const visNode = window.__vis.nodes.get(this.draggedNodeId);
                if (visNode) {
                    visNode.isDragging = false;
                    visNode.velocity.set(0, 0, 0); // Stop any physics drift
                    graphStorage.updateNode(this.draggedNodeId, { position: visNode.mesh.position });

                    // Also save group member positions!
                    if (visNode.visualType === 'group' && visNode.members) {
                        visNode.members.forEach(mId => {
                            const mEntry = window.__vis.nodes.get(mId);
                            if (mEntry) {
                                graphStorage.updateNode(mId, { position: mEntry.mesh.position });
                            }
                        });
                    }
                }
                this.draggedNodeId = null;
                if (window.__controls) window.__controls.enabled = true;
            }

            isMouseDown = false;
            if (isDragging) {
                // Keep isDragging true for one more tick so click/contextmenu can see it
                setTimeout(() => { isDragging = false; }, 20);
            }
        });

        this.domElement.addEventListener('contextmenu', (e) => {
            if (isDragging) {
                e.preventDefault();
                return;
            }
            e.preventDefault();

            const rect = this.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            this.raycaster.setFromCamera(mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children.filter(c => c.userData && c.userData.id !== undefined && c.visible));

            if (intersects.length > 0) {
                const obj = intersects[0].object;
                const clickedId = obj.userData.id;
                const clickedType = obj.userData.type || 'node';
                const nodeData = graphStorage.getNode(clickedId);

                if (clickedType === 'node') {
                    const otherSelected = Array.from(this.selectedIds).filter(id => id !== clickedId);
                    let menuContent = '';

                    if (nodeData && nodeData.type === 'group') {
                        menuContent = `
                            <div onclick="window.__ui.toggleGroupCollapse('${clickedId}')">Toggle Collapse</div>
                            <div onclick="window.__ui.ungroup('${clickedId}')">Ungroup</div>
                            <hr>
                        `;
                    }

                    menuContent += `
                        <div onclick="window.__ui.editSelected('${clickedId}')">Edit Properties</div>
                        <div onclick="window.__ui.startEdgeConnection('${clickedId}')">Connect to...</div>
                    `;

                    if (this.selectedIds.size === 2 && this.selectedIds.has(clickedId)) {
                        const nodes = Array.from(this.selectedIds);
                        const idA = nodes[0];
                        const idB = nodes[1];
                        const labelA = graphStorage.getNode(idA).label;
                        const labelB = graphStorage.getNode(idB).label;
                        menuContent += `
                            <hr>
                            <div onclick="window.__ui.quickConnect('${idA}', '${idB}')">Connect ${labelA} -> ${labelB}</div>
                            <div onclick="window.__ui.quickConnect('${idB}', '${idA}')">Connect ${labelB} -> ${labelA}</div>
                            <div onclick="window.__ui.quickConnect('${idA}', '${idB}', true)">Connect Bidirectional</div>
                        `;
                    } else if (otherSelected.length > 0) {
                        menuContent += `
                            <hr>
                            <div onclick="window.__ui.connectAllTo('${clickedId}')">Connect Selected (${this.selectedIds.size}) to This</div>
                        `;
                    }

                    menuContent += `
                        <hr>
                        <div onclick="window.__ui.deleteSelected()">Delete</div>
                        <hr>
                        <div onclick="window.__ui.hideMenu()">Cancel</div>
                    `;
                    this.contextMenu.innerHTML = menuContent;
                } else if (clickedType === 'edge') {
                    this.selectedIds.clear();
                    this.selectedIds.add(clickedId);
                    this.selectedType = 'edge';
                    this.contextMenu.innerHTML = `
                        <div onclick="window.__ui.editSelected()">Edit Edge</div>
                        <div onclick="window.__ui.deleteSelected()">Delete Edge</div>
                        <hr>
                        <div onclick="window.__ui.hideMenu()">Cancel</div>
                    `;
                }
            } else {
                // Empty area: build context menu with group creation option if nodes are selected
                let menuHtml = '';
                if (this.selectedIds.size > 0) {
                    menuHtml = `<div onclick="window.__ui.createGroupFromSelected()">Create Group (${this.selectedIds.size} nodes)</div><hr>`;
                }
                menuHtml += `
                    <div onclick="window.__ui.createNode('person')">Add Person</div>
                    <div onclick="window.__ui.createNode('location')">Add Location</div>
                    <div onclick="window.__ui.createNode('item')">Add Item</div>
                    <div onclick="window.__ui.createNode('concept')">Add Concept</div>
                    <div onclick="window.__ui.createNode('event')">Add Event</div> 
                    <div onclick="window.__ui.createNode('file')">Add File</div> 
                    <div onclick="window.__ui.createNode('folder')">Add Folder</div> 
                    <hr>
                    <div onclick="window.__ui.hideMenu()">Cancel</div>
                `;
                this.contextMenu.innerHTML = menuHtml;
                // Only clear selection if there are NO nodes selected (pure background right-click)
                // Preserve selection for group creation from selected nodes
                if (this.selectedIds.size === 0) {
                    this.selectedIds.clear();
                    this.selectedType = null;
                    window.__vis.highlightNode(null);
                }
            }

            this.contextMenu.style.left = e.clientX + 'px';
            this.contextMenu.style.top = e.clientY + 'px';
            this.contextMenu.style.display = 'block';
        });

        this.domElement.addEventListener('click', (e) => {
            if (e.button !== 0 || isDragging) return;
            if (this.propertiesPanel.contains(e.target)) return;

            const rect = this.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            this.raycaster.setFromCamera(mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children.filter(c => c.userData && c.userData.id !== undefined && c.visible));

            if (intersects.length > 0) {
                const obj = intersects[0].object;
                const id = obj.userData.id;
                const type = obj.userData.type || 'node';

                if (e.shiftKey && type === 'node') {
                    if (this.selectedIds.has(id)) {
                        this.selectedIds.delete(id);
                    } else {
                        this.selectedIds.add(id);
                    }
                    window.__vis.highlightMultipleNodes(this.selectedIds);
                    this.selectedType = 'node';
                } else {
                    // 1. Clear previous highlights and selections
                    window.__vis.highlightNode(null);
                    this.selectedIds.clear();
                    this.selectedIds.add(id);
                    this.selectedType = type;

                    // 2. Build the UI panel for whatever was clicked
                    this.buildPropertiesPanel(id, type);

                    // 3. Handle the logic depending on what was clicked
                    if (type === 'node') {
                        // -> Highlight the node
                        window.__vis.highlightNode(id, true);

                        const vis = window.__vis;
                        const is2D = vis && vis.physicsConfig && vis.physicsConfig.is2D;
                        if (!is2D) {
                            window.__controls.target.copy(obj.position);
                        }

                        // Edge connection logic
                        if (this.edgeSourceId !== null && this.edgeSourceId !== id) {
                            if (!validateEdgeCreation(this.edgeSourceId, id)) {
                                this.edgeSourceId = null;
                                this.edgeHint.style.display = 'none';
                                return;
                            }
                            const edgeId = graphStorage.createEdge(this.edgeSourceId, id);
                            this.edgeSourceId = null;
                            this.edgeHint.style.display = 'none';
                            this.selectedIds.clear();
                            this.selectedIds.add(edgeId);
                            this.selectedType = 'edge';
                            this.buildPropertiesPanel(edgeId, 'edge');
                        }
                    }
                    else if (type === 'edge') {
                        // -> Highlight the edge
                        window.__vis.highlightEdge(id);
                    }
                }
                this._updateSelectionBadge();
            } else {
                this.selectedIds.clear();
                this.selectedType = null;
                this.propertiesPanel.style.display = 'none';
                window.__vis.highlightNode(null);
                this._updateSelectionBadge();
            }
            this.hideMenu();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    document.activeElement.blur();
                    return;
                }
                this.edgeSourceId = null;
                this.edgeHint.style.display = 'none';
                this.hideMenu();

                // If search filter is active, clear it on Escape
                const vis = window.__vis;
                if (vis && vis.hideNonMatches && vis.currentSearchQuery) {
                    const searchInput = document.getElementById('graph-search');
                    if (searchInput) searchInput.value = '';
                    vis.applySearch('', false);
                    const clearBtn = document.getElementById('search-clear-btn');
                    if (clearBtn) clearBtn.style.display = 'none';
                    const searchBar = document.querySelector('.top-search-bar');
                    if (searchBar) searchBar.style.boxShadow = '';
                    return;
                }

                this.propertiesPanel.style.display = 'none';
                this.selectedIds.clear();
                window.__vis.highlightNode(null);
                this._updateSelectionBadge();
            }

            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                return;
            }

            if (e.key.toLowerCase() === 'c' && this.selectedIds.size > 1 && this.selectedType === 'node') {
                const ids = Array.from(this.selectedIds);
                for (let i = 0; i < ids.length - 1; i++) {
                    graphStorage.createEdge(ids[i], ids[i + 1]);
                }
                window.__vis.heat(0.3);
            }
        });

        // Hover highlight
        let hoveredId = null;
        this.domElement.addEventListener('pointermove', (e) => {
            const rect = this.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            this.raycaster.setFromCamera(mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(
                this.scene.children.filter(c => c.userData && c.userData.id !== undefined && c.visible)
            );

            if (intersects.length > 0) {
                const obj = intersects[0].object;
                const id = obj.userData.id;
                const type = obj.userData.type;

                if (type === 'node') {
                    window.__vis.setHoverNode(id);
                } else {
                    window.__vis.setHoverNode(null);
                }
            } else {
                window.__vis.setHoverNode(null);
            }
        });
    }
};

// ui.js - with full character import support

import * as THREE from 'three';
import graphStorage from './storage.js';
import { areNodesVisible, validateEdgeCreation } from './ui/utils.js';
import {
    renderOverviewTab,
    renderAppearanceTab,
    renderPersonalityTab,
    renderBiographyTab,
    renderRelationshipsTab,
    renderKinksTab
} from './ui/tabs.js';
import { renderCharacterProperties } from './ui/forms.js';
import {
    exportMarkdown,
    saveFile,
    refreshGraphList,
    showExportModal,
    _showExportModal
} from './ui/exportImport.js';


class GraphUI {
    constructor(camera, scene, raycaster, domElement) {
        console.log('🎮 GraphUI constructor');
        this.camera = camera;
        this.scene = scene;
        this.raycaster = raycaster;
        this.domElement = domElement || document.body;
        this.contextMenu = document.getElementById('context-menu');
        this.propertiesPanel = document.getElementById('properties-panel');
        this.edgeHint = document.getElementById('edge-hint');

        this.selectedIds = new Set();
        this.selectedType = null;
        this.edgeSourceId = null;
        this.draggedNodeId = null;
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragOffset = new THREE.Vector3();

        this.setupMenu();
        this.setupEventListeners();
        this.setupGlobalSettings();

        this._isDirty = false;
        this._currentData = null;

        // Global dirty state listener for properties panel
        this.propertiesPanel.addEventListener('input', () => {
            this._isDirty = true;
        });
        this.propertiesPanel.addEventListener('change', () => {
            if (event.target.type === 'file' || event.target.tagName === 'SELECT') {
                this._isDirty = true;
            }
        });
    }

    // Helper: Check if all given node IDs are currently visible in the visualization
    

    setupMenu() {
        if (!this.contextMenu) {
            this.contextMenu = document.createElement('div');
            this.contextMenu.className = 'context-menu';
            document.body.appendChild(this.contextMenu);
        }
        if (!this.propertiesPanel) {
            this.propertiesPanel = document.createElement('div');
            this.propertiesPanel.className = 'properties-panel';
            document.body.appendChild(this.propertiesPanel);
        }
        if (!this.selectionBadge) {
            this.selectionBadge = document.createElement('div');
            this.selectionBadge.className = 'selection-badge';
            this.selectionBadge.style.display = 'none';
            document.body.appendChild(this.selectionBadge);
        }
        if (!this.saveIndicator) {
            this.saveIndicator = document.createElement('div');
            this.saveIndicator.className = 'auto-save-indicator';
            document.body.appendChild(this.saveIndicator);
        }
        if (!this.edgeHint) {
            this.edgeHint = document.createElement('div');
            this.edgeHint.id = 'edge-hint';
            this.edgeHint.className = 'edge-hint';
            this.edgeHint.textContent = 'Click another node to connect...';
            this.edgeHint.style.display = 'none';
            document.body.appendChild(this.edgeHint);
        }
        

        this.buildContextMenu();
        this.buildPropertiesPanel();
        
    }
    _initResize() {
    let startX = 0;
    let startWidth = 0;
    const handle = this.resizeHandle;
    const panel = this.propertiesPanel;

    const onMouseMove = (e) => {
        const dx = e.clientX - startX;
        const newWidth = startWidth - dx; // subtract because dragging left edge left = narrower, right = wider
        if (newWidth > 200 && newWidth < window.innerWidth * 0.8) {
            panel.style.width = newWidth + 'px';
        }
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        localStorage.setItem('propertiesPanelWidth', panel.style.width);
    };

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation(); // prevent canvas from stealing the event
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    const savedWidth = localStorage.getItem('propertiesPanelWidth');
    if (savedWidth) {
        panel.style.width = savedWidth;
    }
}

    buildContextMenu() {
        this.contextMenu.innerHTML = '';
        const emptyMenu = `
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
        this.contextMenu.innerHTML = emptyMenu;
    }

    buildPropertiesPanel(id, type) {
        if (!id) {
            this.propertiesPanel.style.display = 'none';
            return;
        }

        if (type === 'node') {
            const nodeData = graphStorage.getNode(id);
            if (!nodeData) return;

            this._isDirty = false; // Reset when opening a new one
            this._currentData = JSON.parse(JSON.stringify(nodeData));

            if (nodeData.type === 'person') {
                this._isDirty = false;
                this._currentData = JSON.parse(JSON.stringify(nodeData));
                this._editingNodeId = id;

                // Sticky header HTML
                const headerHtml = `
        <div class="person-header" style="
            position: sticky;
            top: 0;
            background: rgba(30,30,40,0.98);
            padding: 12px 15px;
            border-bottom: 1px solid #5a6a8a;
            z-index: 10;
            display: flex;
            align-items: center;
            gap: 12px;
            backdrop-filter: blur(5px);
        ">
            <img src="${nodeData.imageUrl || 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%2228%22%20fill%3D%22%23444%22%20stroke%3D%22%2388aaff%22%20stroke-width%3D%222%22%2F%3E%3Ctext%20x%3D%2230%22%20y%3D%2238%22%20font-size%3D%2224%22%20fill%3D%22white%22%20text-anchor%3D%22middle%22%3EP%3C%2Ftext%3E%3C%2Fsvg%3E'}"
                 class="header-avatar"
                 style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #88aaff;">
            <div style="flex: 1;">
                <h3 style="margin:0 0 4px 0; color:#aaccff;">${nodeData.label}</h3>
                <div style="display: flex; gap: 8px; font-size: 0.85em; color: #ccc;">
                    <span class="type-badge" style="background:#ffaa88; padding:2px 8px; border-radius:12px; color:#222;">Person</span>
                    <span>Age: ${nodeData.properties?.basic_info?.age || '?'}</span>
                    <span>${nodeData.properties?.basic_info?.gender || '?'}</span>
                    <span>${nodeData.properties?.basic_info?.species || 'Human'}</span>
                </div>
            </div>
        </div>
    `;

                // Tabs
                const tabsHtml = `
        <div class="person-tabs" style="display:flex; gap:4px; padding:8px 15px; border-bottom:1px solid #3a4a6a;">
            <button class="tab-btn active" data-tab="overview">Overview</button>
            <button class="tab-btn" data-tab="appearance">Appearance</button>
            <button class="tab-btn" data-tab="personality">Personality</button>
            <button class="tab-btn" data-tab="biography">Biography</button>
            <button class="tab-btn" data-tab="relationships">Relationships</button>
            <button class="tab-btn" data-tab="kinks">Kinks & Media</button>
        </div>
    `;

                // Tab content containers
                const tabContentsHtml = `
        <div id="tab-overview" class="tab-content-grid" style="display:block; padding:10px 15px;"></div>
        <div id="tab-appearance" class="tab-content-grid" style="display:none; padding:10px 15px;"></div>
        <div id="tab-personality" class="tab-content-grid" style="display:none; padding:10px 15px;"></div>
        <div id="tab-biography" class="tab-content-grid" style="display:none; padding:10px 15px;"></div>
        <div id="tab-relationships" class="tab-content-grid" style="display:none; padding:10px 15px;"></div>
        <div id="tab-kinks" class="tab-content-grid" style="display:none; padding:10px 15px;"></div>
    `;

                // Connected nodes mini-view
                const connectedHtml = `
        <div id="connected-nodes-mini" style="padding:10px 15px; border-top:1px solid #3a4a6a; background:rgba(0,0,0,0.2);">
            <h4 style="margin:0 0 8px 0; font-size:0.9em; color:#aaccff;">Connected</h4>
            <div id="connected-list" style="font-size:0.85em;">Loading...</div>
        </div>
    `;

                // Footer (unchanged)
                const footerHtml = `
        <div class="panel-footer" style="padding:12px 15px;">
            <button id="save-node">Save All</button>
            <div class="panel-footer-row">
                <button id="unified-export-node" style="background:#3a5a5a;">📤 Export</button>
                <button id="unified-import-node" style="background:#4a4a8a;">📥 Import</button>
            </div>
            <button id="delete-node" style="background:#8a3a3a;">Delete</button>
        </div>
    `;

                this.propertiesPanel.innerHTML = headerHtml + tabsHtml + tabContentsHtml + connectedHtml + footerHtml;

                // Tab switching logic
                const tabs = this.propertiesPanel.querySelectorAll('.tab-btn');
                tabs.forEach(btn => {
                    btn.onclick = () => {
                        tabs.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        const tabId = btn.dataset.tab;
                        this.propertiesPanel.querySelectorAll('.tab-content-grid').forEach(div => div.style.display = 'none');
                        this.propertiesPanel.querySelector(`#tab-${tabId}`).style.display = 'grid';
                    };
                });

                // Render each tab (pass true for startCollapsed)
                renderOverviewTab(nodeData.properties, document.getElementById('tab-overview'), true);
                renderAppearanceTab(nodeData.properties, document.getElementById('tab-appearance'), true);
                renderPersonalityTab(nodeData.properties, document.getElementById('tab-personality'), true);
                renderBiographyTab(nodeData.properties, document.getElementById('tab-biography'), true);
                renderRelationshipsTab(nodeData.properties, document.getElementById('tab-relationships'), true);
                renderKinksTab(nodeData.properties, document.getElementById('tab-kinks'), true);

                // Render connected nodes
                this._renderConnectedNodes(id, document.getElementById('connected-list'));

                // Save button
                document.getElementById('save-node').onclick = async () => {
                    // Image data is now inside Appearance tab
                    const imageUrlInput = document.querySelector('#tab-appearance #node-image-url');
                    const imagePromptInput = document.querySelector('#tab-appearance #node-image-prompt');
                    const imageFileInput = document.querySelector('#tab-appearance #node-image-upload');
                    const layerInput = document.querySelector('#tab-appearance #node-layer');

                    let uploadedImage = null;
                    if (imageFileInput && imageFileInput.files.length > 0) {
                        uploadedImage = await this._handleFileUpload(imageFileInput);
                    }
                    const imageUrl = uploadedImage || (imageUrlInput ? imageUrlInput.value : nodeData.imageUrl);
                    const imagePrompt = imagePromptInput ? imagePromptInput.value : nodeData.imagePrompt;
                    const layerVal = layerInput ? layerInput.value : '';
                    const layer = layerVal === '' ? null : parseInt(layerVal, 10);

                    const updatedProperties = this._collectFormData(this.propertiesPanel);

                    graphStorage.updateNode(id, {
                        label: updatedProperties.basic_info?.name?.full || nodeData.label,
                        imageUrl: imageUrl,
                        imagePrompt: imagePrompt,
                        visualType: imageUrl ? 'sprite' : nodeData.visualType,
                        layer: layer,
                        properties: updatedProperties
                    });
                    this._isDirty = false;
                    this.propertiesPanel.style.display = 'none';
                    window.__vis.heat(0.5);
                };

                // Export / Import / Delete (unchanged)
                document.getElementById('unified-export-node').onclick = () => this._showExportModal(id);
                document.getElementById('unified-import-node').onclick = () => this._showImportModal(id);
                document.getElementById('delete-node').onclick = () => {
                    if (confirm('Delete this character?')) {
                        this._isDirty = false;
                        graphStorage.deleteNode(id);
                        this.propertiesPanel.style.display = 'none';
                    }
                };
            } else if (nodeData.type === 'group') {
                // Group properties panel
                this.propertiesPanel.innerHTML = `
                    <h3>Edit Group: ${nodeData.label}</h3>
                    <div class="panel-body">
                        <label>Label</label>
                        <input type="text" id="node-label" value="${nodeData.label || ''}">
                        <label>Members</label>
                        <div style="max-height:150px; overflow-y:auto; background:#1e1e2a; padding:5px; border-radius:3px;">
                            ${(nodeData.members || []).map(mId => {
                    const m = graphStorage.getNode(mId);
                    return `<div>${m ? m.label : 'Unknown'} (ID: ${mId})</div>`;
                }).join('')}
                        </div>
                        <label>
                            <input type="checkbox" id="group-collapsed" ${nodeData.collapsed ? 'checked' : ''}> Collapsed
                        </label>
                        <label>Description</label>
                        <textarea id="node-desc" rows="3">${nodeData.properties.description || ''}</textarea>
                    </div>
                    <div class="panel-footer">
                        <button id="save-group">Update</button>
                        <button id="ungroup" style="background:#8a5a3a;">Ungroup</button>
                        <button id="delete-node" style="background:#8a3a3a;">Delete</button>
                    </div>
                `;

                document.getElementById('save-group').onclick = () => {
                    graphStorage.updateNode(id, {
                        label: document.getElementById('node-label').value,
                        collapsed: document.getElementById('group-collapsed').checked,
                        properties: { description: document.getElementById('node-desc').value }
                    });
                    this._isDirty = false;
                    this.propertiesPanel.style.display = 'none';
                };

                document.getElementById('ungroup').onclick = () => {
                    this._isDirty = false;
                    this.ungroup(id);
                };

                document.getElementById('delete-node').onclick = () => {
                    if (confirm('Delete this group?')) {
                        this._isDirty = false;
                        graphStorage.deleteNode(id);
                        this.propertiesPanel.style.display = 'none';
                    }
                };
            } else {
                // UNIVERSAL NODE EDITOR (Person, Location, Item, Concept)
                this.propertiesPanel.innerHTML = `
                    <h3>Edit ${nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1)}: ${nodeData.label}</h3>
                    <div class="panel-body">
                        <div class="visual-section">
                            <label>Label</label>
                            <input type="text" id="node-display-label" value="${nodeData.label || ''}" style="margin-bottom:10px;">
                            
                            <label>Visual Style</label>
                            <select id="node-visual-type" style="margin-bottom:10px;">
                                <option value="sphere" ${nodeData.visualType === 'sphere' ? 'selected' : ''}>Sphere (3D)</option>
                                <option value="sprite" ${nodeData.visualType === 'sprite' ? 'selected' : ''}>Sprite (Image)</option>
                            </select>

                            <label>Sprite Image</label>
                            <div class="image-preview-container">
                                <img id="image-preview" src="${nodeData.imageUrl || ''}" style="display: ${nodeData.imageUrl ? 'block' : 'none'};">
                            </div>
                            <input type="text" id="node-image-url" value="${nodeData.imageUrl || ''}" placeholder="URL">
                            <input type="file" id="node-image-upload" style="margin-top:5px; font-size:0.8em;">
                            
                            <label>Image Prompt (AI)</label>
                            <textarea id="node-image-prompt" rows="2" placeholder="Describe for AI generator...">${nodeData.imagePrompt || ''}</textarea>

                            <label style="margin-top:10px;">
                                <input type="checkbox" id="node-locked" ${nodeData.isLocked ? 'checked' : ''}> Locked in place
                            </label>
                          

                            <!-- NEW LAYER FIELD -->
                            <label style="margin-top:10px; color:#88ffaa;" title="Locks the node to a vertical tier. (e.g. 1=Frontend, 0=Backend, -1=DB)">
                                Vertical Layer (Tier)
                            </label>
                            <input type="number" id="node-layer" value="${nodeData.layer !== undefined && nodeData.layer !== null ? nodeData.layer : ''}" placeholder="Leave blank to float freely">
                        </div>
                        <hr>
                        <div id="dynamic-node-form"></div>
                    </div>
                    <div class="panel-footer">
                        <button id="save-node">Save Changes</button>
                        <div class="panel-footer-row">
                            <button id="unified-export-node" style="background:#3a5a5a; flex:1;" title="Export Data">📤 Export</button>
                            <button id="unified-import-node" style="background:#4a4a8a; flex:1;" title="Import Data">📥 Import</button>
                        </div>
                        ${nodeData.type === 'location' ? `
                            <button id="add-sub-location" style="background:#2a5a5a; margin-top:5px; margin-bottom:5px;">+ Add Sub-Location</button>
                        ` : ''}
                        <button id="delete-node" style="background:#8a3a3a;">Delete</button>
                    </div>
                `;

                document.getElementById('delete-node').onclick = () => {
                    if (confirm(`Delete this ${nodeData.type}?`)) {
                        this._isDirty = false;
                        graphStorage.deleteNode(id);
                        this.propertiesPanel.style.display = 'none';
                    }
                };

                this._editingNodeId = id;
                // We use the recursive form builder for ALL non-group nodes now
                renderCharacterProperties(nodeData.properties, document.getElementById('dynamic-node-form'));

                // Image logic
                const urlInput = document.getElementById('node-image-url');
                const fileInput = document.getElementById('node-image-upload');
                const preview = document.getElementById('image-preview');
                urlInput.oninput = (e) => {
                    preview.src = e.target.value;
                    preview.style.display = e.target.value ? 'block' : 'none';
                };
                fileInput.onchange = async (e) => {
                    const base64 = await this._handleFileUpload(e.target);
                    if (base64) { preview.src = base64; preview.style.display = 'block'; }
                };

                // Universal Save
                document.getElementById('save-node').onclick = async () => {
                    const uploadedImage = await this._handleFileUpload(document.getElementById('node-image-upload'));
                    const imageUrl = uploadedImage || document.getElementById('node-image-url').value;
                    const updatedProperties = this._collectFormData(document.getElementById('dynamic-node-form'));

                    // --- Extract layer value ---
                    const layerVal = document.getElementById('node-layer').value;
                    const layer = layerVal === '' ? null : parseInt(layerVal, 10);

                    graphStorage.updateNode(id, {
                        label: document.getElementById('node-display-label')?.value || updatedProperties.basic_info?.name?.full,
                        imageUrl: imageUrl,
                        imagePrompt: document.getElementById('node-image-prompt').value,
                        visualType: document.getElementById('node-visual-type')?.value || nodeData.visualType,
                        isLocked: document.getElementById('node-locked') ? document.getElementById('node-locked').checked : nodeData.isLocked,
                        layer: layer, // <-- NEW
                        properties: updatedProperties
                    });
                    this._isDirty = false; // Reset after save
                    this.propertiesPanel.style.display = 'none';
                    window.__vis.heat(1.0); // High heat to trigger the tier movement!

                };

                document.getElementById('unified-export-node').onclick = () => this._showExportModal(id);
                document.getElementById('unified-import-node').onclick = () => this._showImportModal(id);

                if (nodeData.type === 'location') {
                    document.getElementById('add-sub-location').onclick = () => {
                        // Quick add sub-location logic
                        const locName = prompt("Enter sub-location name:");
                        if (locName && locName.trim() !== '') {
                            // Close current panel to refresh cleanly
                            this.propertiesPanel.style.display = 'none';

                            // Create node
                            const newId = this.createNode('location', false); // create without immediately opening panel
                            graphStorage.updateNode(newId, { label: locName.trim() });

                            // Try to offset the child node slightly from the parent
                            const pNode = graphStorage.nodes.get(id);
                            const cNode = graphStorage.nodes.get(newId);
                            if (pNode && cNode) {
                                cNode.mesh.position.copy(pNode.mesh.position);
                                cNode.mesh.position.x += (Math.random() - 0.5) * 5;
                                cNode.mesh.position.z += (Math.random() - 0.5) * 5;
                            }

                            // Create edge connecting them
                            this.quickConnect(id, newId, true); // Create link
                            const newEdge = graphStorage.edges[graphStorage.edges.length - 1]; // get newly created edge
                            if (newEdge) {
                                graphStorage.updateEdge(newEdge.id, { label: "Contains", attributes: { strength: 0.8 } });
                            }

                            window.__vis.heat(1.0);

                            // Open the new sub-location for editing
                            setTimeout(() => this.buildPropertiesPanel(newId, 'node'), 50);
                        }
                    };
                }
            }

            document.getElementById('delete-node').onclick = () => {
                if (confirm(`Delete this ${nodeData.type}?`)) {
                    graphStorage.deleteNode(id);
                    this.propertiesPanel.style.display = 'none';
                }
            };

        } else if (type === 'edge') {
            const edgeData = graphStorage.edges.get(id);
            if (!edgeData) return;

            // 1. Look up the connected nodes
            const sourceNode = graphStorage.getNode(edgeData.source);
            const targetNode = graphStorage.getNode(edgeData.target);
            const sLabel = sourceNode ? sourceNode.label : 'Unknown';
            const tLabel = targetNode ? targetNode.label : 'Unknown';

            this.propertiesPanel.innerHTML = `
                <h3>Edit Edge</h3>
                
                <!-- NEW: Connection Visualizer -->
                <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; margin-bottom:15px; border:1px solid #3a4a6a;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-size:0.8em; color:#88aaff;">Source</span>
                        <button onclick="window.__ui.selectNode('${edgeData.source}')" style="width:auto; padding:2px 8px; margin:0; font-size:0.9em; background:#2a3a4a;">${sLabel}</button>
                    </div>
                    <div style="text-align:center; color:#5a6a8a; font-size:0.8em; margin:2px 0;">▼ refers to ▼</div>
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.8em; color:#ffaa88;">Target</span>
                        <button onclick="window.__ui.selectNode('${edgeData.target}')" style="width:auto; padding:2px 8px; margin:0; font-size:0.9em; background:#2a3a4a;">${tLabel}</button>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    <label style="margin:0; flex:1;">Line Color</label>
                    <input type="color" id="edge-color" value="${edgeData.attributes?.color || '#88aaff'}" style="width:40px; height:30px; padding:0; border:none; background:none; cursor:pointer;">
                </div>

                <label>Label</label>
                <input type="text" id="edge-label" value="${edgeData.label || ''}">
                <label>Description</label>
                <textarea id="edge-desc" rows="6">${edgeData.description || ''}</textarea>

                <label style="display:flex; align-items:center; gap:8px; margin:10px 0;">
                    <input type="checkbox" id="edge-status" ${edgeData.status === 'inactive' ? '' : 'checked'} style="width:auto; margin:0;">
                    <span>Active</span>
                </label>

                <div class="edge-direction-ops" style="display:flex; gap:10px; margin-bottom:15px; margin-top:10px;">
                    <button id="flip-edge" style="flex:1; font-size:0.8em; padding:5px;">Flip Direction</button>
                    <button id="make-bidirectional" style="flex:1; font-size:0.8em; padding:5px;">Make Bidirectional</button>
                </div>

                <button id="save-edge">Update</button>
                <button id="delete-edge" style="background:#8a3a3a;">Delete</button>
            `;

            document.getElementById('flip-edge').onclick = () => {
                graphStorage.swapEdgeDirection(id);
                // Re-render the panel to show the swapped Source/Target!
                this.buildPropertiesPanel(id, 'edge');
                window.__vis.heat(0.3);
            };
            document.getElementById('make-bidirectional').onclick = () => {
                graphStorage.ensureBidirectional(id);
                this.propertiesPanel.style.display = 'none';
                window.__vis.heat(0.3);
            };
            const saveEdge = () => {
                graphStorage.updateEdge(id, {
                    label: document.getElementById('edge-label').value,
                    description: document.getElementById('edge-desc').value,
                    status: document.getElementById('edge-status').checked ? 'active' : 'inactive',
                    attributes: {
                        ...edgeData.attributes,
                        color: document.getElementById('edge-color').value
                    }
                });
                this._isDirty = false;
                this.propertiesPanel.style.display = 'none';
                window.__vis.heat(0.3);
            };
            document.getElementById('save-edge').onclick = saveEdge;
            const inputs = this.propertiesPanel.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveEdge();
                    }
                });
            });
            document.getElementById('delete-edge').onclick = () => {
                if (confirm('Delete this edge?')) {
                    graphStorage.deleteEdge(id);
                    this._isDirty = false;
                    this.propertiesPanel.style.display = 'none';
                    window.__vis.heat(0.5);
                }
            };

        }
        this.propertiesPanel.style.display = 'flex';
        this._ensureResizeHandle();
    }

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

    // --- Actions ---
    createNode(type) {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        const pos = this.camera.position.clone().add(direction.multiplyScalar(5));
        const id = graphStorage.createNode(type, pos);
        this.hideMenu();
        this.selectedIds.clear();
        this.selectedIds.add(id);
        this.selectedType = 'node';
        this.buildPropertiesPanel(id, 'node');
        this._showSaveIndicator();
        window.__vis.highlightNode(id, true);
        this._updateSelectionBadge();
        return id;
    }

    createGroupFromSelected() {
        const ids = Array.from(this.selectedIds).filter(id => graphStorage.getNode(id)?.type !== 'edge'); // ensure nodes only
        if (ids.length < 2) return; // need at least two nodes

        // Get positions of selected nodes
        const positions = ids.map(id => graphStorage.getNode(id)?.position).filter(p => p);
        if (positions.length === 0) return;

        // Correct average calculation
        const sum = positions.reduce((acc, p) => {
            acc.x += p.x;
            acc.y += p.y;
            acc.z += p.z;
            return acc;
        }, { x: 0, y: 0, z: 0 });

        const avg = {
            x: sum.x / positions.length,
            y: sum.y / positions.length,
            z: sum.z / positions.length
        };

        const groupId = graphStorage.createGroup(ids, avg);
        this.selectedIds.clear();
        this.selectedIds.add(groupId);
        this.buildPropertiesPanel(groupId, 'node');
        this.hideMenu();
    }

    toggleGroupCollapse(id) {
        const group = graphStorage.getNode(id);
        if (group) graphStorage.setGroupCollapsed(id, !group.collapsed);
        this.hideMenu();
    }

    ungroup(id) {
        if (confirm('Ungroup – members will become independent nodes.')) {
            graphStorage.ungroup(id);
            this.selectedIds.delete(id);
            this.propertiesPanel.style.display = 'none';
            this.hideMenu();
        }
    }

    editSelected(forcedId) {
        let id = forcedId !== undefined ? (typeof forcedId === 'number' ? forcedId : Number(forcedId)) : Array.from(this.selectedIds)[0];
        if (id !== undefined) {
            const node = graphStorage.getNode(id);
            const type = node ? 'node' : (this.selectedType || 'node');
            this.buildPropertiesPanel(id, type);
        }
        this.hideMenu();
    }

    startEdgeConnection(forcedId) {
        const id = forcedId !== undefined ? (typeof forcedId === 'number' ? forcedId : Number(forcedId)) : Array.from(this.selectedIds)[0];
        if (id !== undefined && (this.selectedType === 'node' || !this.selectedType)) {
            this.edgeSourceId = id;
            this.edgeHint.style.display = 'block';
        }
        this.hideMenu();
    }

    quickConnect(sourceId, targetId, bidirectional = false) {
        const sId = typeof sourceId === 'number' ? sourceId : Number(sourceId);
        const tId = typeof targetId === 'number' ? targetId : Number(targetId);
        if (!validateEdgeCreation(sId, tId)) {
            this.hideMenu();
            return;
        }
        graphStorage.createEdge(sId, tId);
        if (bidirectional) {
            if (validateEdgeCreation(tId, sId)) {
                graphStorage.createEdge(tId, sId);
            }
        }
        this.hideMenu();
    }

    connectAllTo(targetId) {
        const tId = typeof targetId === 'number' ? targetId : Number(targetId);
        this.selectedIds.forEach(sourceId => {
            if (sourceId !== tId && areNodesVisible(sourceId, tId)) {
                graphStorage.createEdge(sourceId, tId);
            }
        });
        this.hideMenu();
    }

    deleteSelected() {
        if (this.selectedIds.size > 0) {
            if (confirm(`Delete ${this.selectedIds.size} selected item(s)?`)) {
                this.selectedIds.forEach(id => {
                    if (this.selectedType === 'node' || graphStorage.nodes.has(id)) {
                        graphStorage.deleteNode(id);
                    } else {
                        graphStorage.deleteEdge(id);
                    }
                });
                this.selectedIds.clear();
                this.propertiesPanel.style.display = 'none';
                window.__vis.highlightNode(null);
            }
        }
        this.hideMenu();
    }

    async saveGraph() {
        await graphStorage.save(); // Wait for IDB to finish
        this._showSaveIndicator(); // Now show the "Saved" tick
        this.hideMenu();
    }

    loadGraph() {
        graphStorage.load();
        this.hideMenu();
    }

    exportJSON() {
        graphStorage.exportJSON();
        this.hideMenu();
    }

    importJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                try {
                    const data = JSON.parse(re.target.result);
                    graphStorage.importJSON(data);
                    alert('Graph imported successfully');
                } catch (err) {
                    console.error('Import failed', err);
                    alert('Failed to import JSON: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
        this.hideMenu();
    }

    undo() {
        graphStorage.undo();
        window.__vis.heat(0.5);
    }

    redo() {
        graphStorage.redo();
        window.__vis.heat(0.5);
    }

    // --- MARKDOWN EXPORT LOGIC (as you added) ---
    exportMarkdown() {
    return exportMarkdown();
}

    // 1. Hover Preview Logic
    updateHoverPreview(id, type) {
        const el = document.getElementById('hover-preview');
        if (!id || this.propertiesPanel.style.display === 'flex') {
            el.style.display = 'none';
            return;
        }

        const node = graphStorage.getNode(id);
        if (!node) return;

        let html = `<h4>${node.label}</h4>`;

        // Recursive function to find non-empty fields
        const getFields = (obj, path = "") => {
            let lines = "";
            for (const [k, v] of Object.entries(obj)) {
                if (!v || (Array.isArray(v) && v.length === 0)) continue;
                if (typeof v === 'object' && !Array.isArray(v)) {
                    lines += getFields(v, k + " ");
                } else {
                    const val = Array.isArray(v) ? v.join(", ") : v;
                    if (val && val !== "0" && val !== "") {
                        lines += `<div class="field"><span class="label">${k}:</span> ${val}</div>`;
                    }
                }
            }
            return lines;
        };

        html += getFields(node.properties);
        el.innerHTML = html;
        el.style.display = 'block';
    }

    // 2. Enhanced File Saving (File System Access API)
    async saveFile(content, defaultName, extension) {
    return saveFile(content, defaultName);
}

    // 3. New Graph Manager UI in setupGlobalSettings
    // Add this inside the settings-content div:
    /*
        <label>Switch Graph</label>
        <select id="graph-selector"></select>
        <button onclick="window.__ui.createNewGraph()">+ New World</button>
    */

    async refreshGraphList() {
    return refreshGraphList();
}

    // 4. Multi-Hop Export Modal
    showExportModal(nodeId) {
    return showExportModal(nodeId);
}

    _generateMarkdownContent(activeFilters = null) {
        if (!activeFilters && window.__vis) activeFilters = window.__vis.activeFilters;
        const isIncluded = (type) => activeFilters ? activeFilters.has(type) : true;
        const graphName = graphStorage.graphName || 'World Graph';
        const date = new Date().toLocaleDateString();

        let md = `# ${graphName}\n\n`;
        md += `> *"A world profile generated on ${date}."*\n\n---\n\n`;

        md += `## 📍 Geography & Setting\n\n`;
        const locations = Array.from(graphStorage.nodes.values()).filter(n => n.type === 'location' && isIncluded('location'));
        if (locations.length === 0) {
            md += `*No specific locations recorded.*\n\n`;
        } else {
            locations.forEach(loc => {
                md += `### **${loc.label}**\n`;
                if (loc.properties.description) md += `- ${loc.properties.description}\n`;
                if (loc.properties.address) md += `- **Address:** ${loc.properties.address}\n`;
                const relatedEdges = Array.from(graphStorage.edges.values()).filter(e => e.target === loc.id || e.source === loc.id);
                if (relatedEdges.length > 0) {
                    md += `- **Connections:**\n`;
                    relatedEdges.forEach(e => {
                        const otherId = e.source === loc.id ? e.target : e.source;
                        const otherNode = graphStorage.getNode(otherId);
                        if (otherNode && isIncluded(otherNode.type)) md += `  - ${otherNode.label} (${e.label || e.type})\n`;
                    });
                }
                md += `\n`;
            });
        }
        md += `---\n\n`;

        md += `## 🏛️ Lore & Concepts\n\n`;
        const concepts = Array.from(graphStorage.nodes.values()).filter(n => n.type === 'concept' && isIncluded('concept'));
        if (concepts.length > 0) {
            concepts.forEach(c => {
                md += `### ${c.label}\n`;
                if (c.properties.description) md += `${c.properties.description}\n\n`;
            });
            md += `---\n\n`;
        }

        md += `## 🏺 Items & Objects\n\n`;
        const items = Array.from(graphStorage.nodes.values()).filter(n => n.type === 'item' && isIncluded('item'));
        if (items.length > 0) {
            items.forEach(item => {
                md += `### ${item.label}\n`;
                if (item.properties.description) md += `${item.properties.description}\n\n`;
            });
            md += `---\n\n`;
        }

        md += `## 👥 The Residents\n\n`;
        const people = Array.from(graphStorage.nodes.values()).filter(n => n.type === 'person' && isIncluded('person'));

        people.forEach(p => {
            const props = p.properties;
            const basic = props.basic_info || {};

            md += `### **${p.label}**\n`;
            md += `\`\`\`\n`;

            md += `NAME: ${basic.name?.full || p.label}\n`;
            if (basic.name?.aliases?.length) md += `ALIASES: ${basic.name.aliases.join(', ')}\n`;
            if (basic.age) md += `AGE: ${basic.age}\n`;
            if (basic.birthdate) md += `BIRTHDATE: ${basic.birthdate}\n`;
            if (basic.species && basic.species !== 'Human') md += `SPECIES: ${basic.species}\n`;
            if (basic.gender) md += `GENDER: ${basic.gender} (${basic.pronouns || ''})\n`;
            if (basic.occupation) md += `OCCUPATION: ${basic.occupation}\n`;
            if (basic.residence?.full_address || basic.residence?.name)
                md += `RESIDENCE: ${basic.residence.name || ''} ${basic.residence.full_address || ''}\n`;

            if (basic.marital_status) md += `STATUS: ${basic.marital_status}\n`;
            if (basic.family) {
                if (basic.family.parents?.length) md += `PARENTS: ${basic.family.parents.join(', ')}\n`;
                if (basic.family.siblings?.length) md += `SIBLINGS: ${basic.family.siblings.join(', ')}\n`;
                if (basic.family.children?.length) md += `CHILDREN: ${basic.family.children.join(', ')}\n`;
            }

            md += `\nAPPEARANCE:\n`;
            const app = props.appearance || {};
            if (app.height?.value) md += `- Height: ${app.height.value}${app.height.unit}\n`;
            if (app.build) md += `- Build: ${app.build}\n`;
            if (app.hair?.color) md += `- Hair: ${app.hair.color} ${app.hair.style || ''}\n`;
            if (app.eyes?.color) md += `- Eyes: ${app.eyes.color}\n`;
            if (app.face?.features && app.face.features.length) md += `- Face: ${app.face.features.join(', ')}\n`;
            if (app.body) {
                if (app.body.chest?.size) md += `- Chest: ${app.body.chest.size} ${app.body.chest.description || ''}\n`;
                if (app.body.waist) md += `- Waist: ${app.body.waist}\n`;
                if (app.body.hips) md += `- Hips: ${app.body.hips}\n`;
                if (app.body.butt) md += `- Butt: ${app.body.butt}\n`;
            }
            if (app.genitalia?.pubic_hair || app.genitalia?.vaginal_description || app.genitalia?.penis_description) {
                md += `- Intimate: ${app.genitalia.pubic_hair || ''} ${app.genitalia.vaginal_description || ''} ${app.genitalia.penis_description || ''}\n`;
            }
            if (app.style && Array.isArray(app.style.clothing)) md += `- Style: ${app.style.clothing.join(', ')}\n`;
            if (app.scent) md += `- Scent: ${app.scent}\n`;
            if (app.voice?.pitch) md += `- Voice: ${app.voice.pitch} (${app.voice.accent || ''})\n`;

            md += `\nPERSONALITY:\n`;
            const pers = props.personality || {};
            if (pers.traits && Array.isArray(pers.traits)) md += `- Traits: ${pers.traits.join(', ')}\n`;
            if (pers.mbti) md += `- MBTI: ${pers.mbti}\n`;
            if (pers.alignment) md += `- Alignment: ${pers.alignment}\n`;
            if (pers.likes && Array.isArray(pers.likes)) md += `- Likes: ${pers.likes.join(', ')}\n`;
            if (pers.dislikes && Array.isArray(pers.dislikes)) md += `- Dislikes: ${pers.dislikes.join(', ')}\n`;
            if (pers.habits && Array.isArray(pers.habits)) md += `- Habits: ${pers.habits.join(', ')}\n`;
            if (pers.quirks && Array.isArray(pers.quirks)) md += `- Quirks: ${pers.quirks.join(', ')}\n`;
            if (pers.fears && Array.isArray(pers.fears)) md += `- Fears: ${pers.fears.join(', ')}\n`;
            if (pers.aspirations && Array.isArray(pers.aspirations)) md += `- Aspirations: ${pers.aspirations.join(', ')}\n`;

            const bio = props.biography || {};
            if (bio.early_life?.family_background || bio.early_life?.place_of_birth) {
                md += `\nBACKGROUND (Early):\n${bio.early_life.place_of_birth || ''}. ${bio.early_life.family_background || ''}\n`;
            }
            if (bio.adulthood?.career_history?.length) {
                md += `\nCAREER HISTORY:\n${bio.adulthood.career_history.join(', ')}\n`;
            }
            if (bio.current_situation) {
                md += `\nCURRENT STATE:\n${bio.current_situation}\n`;
            }

            const kinks = props.kinks_and_sexuality || {};
            if (kinks.orientation || kinks.experience) {
                md += `\nSEXUALITY:\n- Orientation: ${kinks.orientation || 'Unknown'}\n`;
                if (kinks.experience) md += `- Experience: ${kinks.experience}\n`;
                if (kinks.turn_ons?.length) md += `- Turn Ons: ${kinks.turn_ons.join(', ')}\n`;
                if (kinks.turn_offs?.length) md += `- Turn Offs: ${kinks.turn_offs.join(', ')}\n`;
                if (kinks.preferences?.length) md += `- Preferences: ${kinks.preferences.join(', ')}\n`;
            }

            if (props.secrets?.deepest_secret || (props.secrets?.hidden_facts && props.secrets.hidden_facts.length)) {
                md += `\nSECRETS:\n`;
                if (props.secrets.deepest_secret) md += `- Deepest Secret: ${props.secrets.deepest_secret}\n`;
                if (props.secrets.hidden_facts) md += `- Hidden Facts: ${props.secrets.hidden_facts.join('; ')}\n`;
            }

            if (props.narrative?.arc || props.narrative?.role_in_town) {
                md += `\nNARRATIVE:\n`;
                if (props.narrative.role_in_town) md += `- Role: ${props.narrative.role_in_town}\n`;
                if (props.narrative.arc) md += `- Arc: ${props.narrative.arc}\n`;
            }

            if (props.capabilities?.skills?.length) {
                md += `\nSKILLS:\n${props.capabilities.skills.join(', ')}\n`;
            }

            const media = props.media || {};
            if ((media.favorite_movies && media.favorite_movies.length) || (media.favorite_books && media.favorite_books.length)) {
                md += `\nFAVORITES:\n`;
                if (media.favorite_movies) md += `- Movies: ${media.favorite_movies.join(', ')}\n`;
                if (media.favorite_books) md += `- Books: ${media.favorite_books.join(', ')}\n`;
                if (media.favorite_music) md += `- Music: ${media.favorite_music.join(', ')}\n`;
            }

            const relEdges = Array.from(graphStorage.edges.values()).filter(e => e.source === p.id || e.target === p.id);
            if (relEdges.length > 0) {
                md += `\nGRAPH CONNECTIONS:\n`;
                relEdges.forEach(e => {
                    const isSource = e.source === p.id;
                    const otherId = isSource ? e.target : e.source;
                    const otherNode = graphStorage.getNode(otherId);
                    if (otherNode) {
                        const relType = e.label || e.type || 'connected to';
                        const directionArrow = e.attributes?.bidirectional ? '<->' : (isSource ? '->' : '<-');
                        md += `- ${relType} ${otherNode.label} (${directionArrow})\n`;
                    }
                });
            }
            md += `\`\`\`\n\n`;
        });
        return md;
    }

    selectNode(id) {
        const vis = window.__vis;
        if (!vis) return;
        this.selectedIds.clear();
        this.selectedIds.add(id);
        this.selectedType = 'node';
        this.buildPropertiesPanel(id, 'node');
        vis.highlightNode(null);
        vis.highlightNode(id, true);
        const node = graphStorage.getNode(id);
        if (node && !vis.physicsConfig.is2D) {
            window.__controls.target.copy(node.position);
        }
        this._updateSelectionBadge();
    }

    _updateSelectionBadge() {
        if (!this.selectionBadge) return;
        if (this.selectedIds.size > 1) {
            this.selectionBadge.textContent = `${this.selectedIds.size} nodes selected`;
            this.selectionBadge.style.display = 'block';
            this.selectionBadge.style.opacity = '1';
        } else {
            this.selectionBadge.style.opacity = '0';
            setTimeout(() => { if (this.selectedIds.size <= 1) this.selectionBadge.style.display = 'none'; }, 200);
        }
    }

    _showSaveIndicator() {
        if (!this.saveIndicator) return;
        this.saveIndicator.textContent = 'Saved ✓';
        this.saveIndicator.classList.add('visible');
        if (this._saveTimeout) clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => {
            if (this.saveIndicator) this.saveIndicator.classList.remove('visible');
        }, 2000);
    }

    setupGlobalSettings() {
        const searchBar = document.createElement('div');
        searchBar.className = 'top-search-bar';
        searchBar.innerHTML = `
            <input type="text" id="graph-search" placeholder="Search nodes & properties... (Enter to filter)" style="padding-right: 30px;">
            <button id="search-clear-btn" title="Clear search filter" style="display:none; position:absolute; right:8px; top:50%; transform:translateY(-50%); background:#ff4466; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; line-height:1; padding:0; z-index:201;">✕</button>
        `;
        document.body.appendChild(searchBar);

        const settings = document.createElement('div');
        settings.className = 'global-settings';
        settings.innerHTML = `
            <div class="settings-header" id="settings-toggle">
                <h3>Settings & Tools</h3>
                <span id="settings-arrow">▼</span>
            </div>
            <div class="settings-tabs">
                <button class="tab-btn active" data-tab="tab-data">Data</button>
                <button class="tab-btn" data-tab="tab-physics">Physics</button>
                <button class="tab-btn" data-tab="tab-style">Style</button>
                <button class="tab-btn" data-tab="tab-ai">AI</button>
            </div>
            <div class="settings-content">
                <!-- DATA TAB -->
                <div id="tab-data" class="tab-content active">
                    <label>Graph Name</label>
                    <input type="text" id="graph-name" value="${graphStorage.graphName}">
                    <div class="file-ops">
                        <button onclick="window.__ui.createNewGraph()" style="background:#5a3a8a;">+ New Graph</button>
                        <button onclick="window.__ui.saveGraph()">Save</button>
                        <button onclick="window.__ui.loadGraph()">Load</button>
                        <button onclick="window.__ui._showExportModal()" style="background:#3a5a5a;">📤 Export</button>
                        <button onclick="window.__ui._showImportModal()" style="background:#4a4a8a;">📥 Import</button>
                    </div>
                    <button onclick="window.__ui.showMergeDuplicatesModal()" style="margin-top:10px; background:#8a5a3a; width:100%;" title="Find and merge duplicate nodes">🛠️ Merge Duplicates</button>
                    <div style="display: flex; gap: 5px; margin-top: 5px;">
                        <button onclick="window.__ui.undo()" style="flex:1;">↩ Undo</button>
                        <button onclick="window.__ui.redo()" style="flex:1;">↪ Redo</button>
                    </div>
                    <hr>
                    <h3>Filters</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                        <label><input type="checkbox" class="filter-type" data-type="person" checked> Person</label>
                        <label><input type="checkbox" class="filter-type" data-type="location" checked> Location</label>
                        <label><input type="checkbox" class="filter-type" data-type="item" checked> Item</label>
                        <label><input type="checkbox" class="filter-type" data-type="concept" checked> Concept</label>
                        <label><input type="checkbox" class="filter-type" data-type="group" checked> Group</label>
                         <label><input type="checkbox" class="filter-type" data-type="event" checked> Event</label>  
                          <label><input type="checkbox" class="filter-type" data-type="file" checked> File</label>  
                           <label><input type="checkbox" class="filter-type" data-type="folder" checked> Folder</label>  
                    </div>
                    <label>Show Inactive: <input type="checkbox" id="show-inactive"></label>
                </div>

                <!-- PHYSICS TAB -->
                <div id="tab-physics" class="tab-content">
                    <label>View: <button id="toggle-2d">3D</button></label>
                    <hr>
                    <label>Physics: <input type="checkbox" id="physics-enabled" checked></label>
                    <label>Repulsion</label>
                    <input type="range" id="physics-repulsion" min="0" max="5" step="0.1" value="1">
                    <label>Attraction</label>
                    <input type="range" id="physics-attraction" min="0" max="0.5" step="0.01" value="0.05">
                    <label>Min Distance</label>
                    <input type="range" id="physics-min-dist" min="1" max="20" step="0.5" value="4">
                    <hr>
                    <label>Physics Speed: <span id="speed-val">1.0</span>x</label>
                    <input type="range" id="physics-speed" min="0" max="2" step="0.1" value="1">
                </div>

                <!-- STYLE TAB -->
                <div id="tab-style" class="tab-content">
                    <h3>Highlighting</h3>
                    <label>Flow Direction</label>
                    <select id="highlight-direction" style="width:100%; margin-bottom:10px; background:#1e1e2a; color:white; padding:4px; border:1px solid #5a6a8a; border-radius:3px;">
                        <option value="both">Bidirectional</option>
                        <option value="outgoing">Outgoing only</option>
                        <option value="incoming">Incoming only</option>
                    </select>
                    <label>Connection Depth: <span id="depth-val">1</span></label>
                    <input type="range" id="highlight-depth" min="1" max="10" step="1" value="1">
                    <label>Dimming Strength</label>
                    <input type="range" id="highlight-dim" min="0" max="0.5" step="0.05" value="0.1">
                    <hr>
                    <label>Label Size</label>
                    <input type="range" id="label-size-slider" min="0.5" max="3" step="0.1" value="1">
                    <label>Line Thickness: <span id="thickness-val">1.0</span></label>
                    <input type="range" id="line-thickness" min="1" max="10" step="0.5" value="1">
                    <div style="font-size: 0.65em; color: #777; margin-bottom: 8px;">Note: High thickness depends on browser/driver support.</div>
                    <hr>
                    <label>Type Colors (Global Defaults)</label>
                    <div id="type-styles-list" style="margin-top: 5px; display: flex; flex-direction: column; gap: 4px;">
                        <!-- Populate dynamically -->
                    </div>
                </div>

                <!-- AI TAB -->
                <div id="tab-ai" class="tab-content">
                    <h3 style="color: #aaa;">AI & Integrations</h3>
                    <p style="font-size: 0.85em; color: #888;">Future capabilities for ComfyUI and LLM processing will appear here.</p>
                    <div style="padding: 20px; text-align: center; color: #555;">
                        <span style="font-size: 2em;">🤖</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(settings);

        // Header Toggle
        const header = settings.querySelector('#settings-toggle');
        const arrow = settings.querySelector('#settings-arrow');
        header.onclick = () => {
            settings.classList.toggle('collapsed');
            arrow.textContent = settings.classList.contains('collapsed') ? '▲' : '▼';
        };

        // Tab Switching Logic
        const tabs = settings.querySelectorAll('.tab-btn');
        const contents = settings.querySelectorAll('.tab-content');
        tabs.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation(); // Prevent header toggle
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                settings.querySelector(`#${btn.dataset.tab}`).classList.add('active');
            };
        });

        const nameInput = document.getElementById('graph-name');
        nameInput.oninput = (e) => {
            graphStorage.graphName = e.target.value;
            graphStorage.save();
        };
        nameInput.onkeydown = (e) => {
            if (e.key === 'Enter') e.target.blur();
        };

        const searchInput = document.getElementById('graph-search');
        searchInput.oninput = (e) => {
            window.__vis.applySearch(e.target.value);
            // Show/hide clear button - only show when filter is active
            const clearBtn = document.getElementById('search-clear-btn');
            if (clearBtn && !window.__vis.hideNonMatches) {
                clearBtn.style.display = 'none';
            }
        };
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                // Instead of creating a node, hide non-matches on Enter
                window.__vis.applySearch(query, true);
                e.target.blur();
                // Show clear button
                const clearBtn = document.getElementById('search-clear-btn');
                if (clearBtn && query.length > 0) {
                    clearBtn.style.display = 'block';
                    searchBar.style.boxShadow = '0 0 8px rgba(255, 68, 102, 0.5)';
                }
            }
        };

        // Clear filter button
        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) {
            clearBtn.onclick = () => {
                searchInput.value = '';
                window.__vis.applySearch('', false);
                clearBtn.style.display = 'none';
                searchBar.style.boxShadow = '';
            };
        }

        settings.querySelectorAll('.filter-type').forEach(cb => {
            cb.onchange = (e) => {
                const vis = window.__vis;
                if (vis) vis.setFilter(e.target.dataset.type, e.target.checked);
            };
        });

        document.getElementById('show-inactive').onchange = (e) => {
            const vis = window.__vis;
            if (vis) vis.setShowInactive(e.target.checked);
        };

        document.getElementById('toggle-2d').onclick = (e) => {
            const vis = window.__vis;
            if (!vis) return;
            vis.physicsConfig.is2D = !vis.physicsConfig.is2D;
            e.target.textContent = vis.physicsConfig.is2D ? '2D' : '3D';
            if (vis.physicsConfig.is2D) {
                vis.nodes.forEach(n => {
                    n.mesh.position.y = 0;
                    n.velocity.y = 0;
                });
                this.camera.position.set(0, 30, 0);
                this.camera.lookAt(0, 0, 0);
                window.__controls.target.set(0, 0, 0);
            } else {
                this.camera.position.set(10, 10, 10);
                window.__controls.target.set(0, 0, 0);
                vis.nodes.forEach(n => {
                    n.mesh.position.y += (Math.random() - 0.5) * 2.0;
                    n.velocity.y += (Math.random() - 0.5) * 2.0;
                });
                vis.heat(1.0);
            }
        };

        document.getElementById('physics-enabled').onchange = (e) => {
            const vis = window.__vis;
            if (vis) vis.physicsConfig.enabled = e.target.checked;
        };

        document.getElementById('label-size-slider').oninput = (e) => {
            const vis = window.__vis;
            if (vis && vis.physicsConfig) {
                vis.physicsConfig.labelSizeMultiplier = parseFloat(e.target.value);
                vis.updateNodeScales();
                // We must update edge scales; update all pairs directly for O(E) performance
                vis.pairMap.forEach(p => vis.updateEdgePair(p.idA, p.idB));
            }
        };

        document.getElementById('physics-repulsion').oninput = (e) => {
            const vis = window.__vis;
            if (vis) vis.physicsConfig.repulsion = parseFloat(e.target.value);
        };
        document.getElementById('physics-attraction').oninput = (e) => {
            const vis = window.__vis;
            if (vis) vis.physicsConfig.attraction = parseFloat(e.target.value);
        };
        document.getElementById('physics-min-dist').oninput = (e) => {
            const vis = window.__vis;
            if (vis) vis.physicsConfig.minDist = parseFloat(e.target.value);
        };
        const depthSlider = document.getElementById('highlight-depth');
        const depthVal = document.getElementById('depth-val');

        depthSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            // Visual feedback: If maxed out, say "Chain"
            depthVal.textContent = val === 10 ? 'Max (Chain)' : val;

            const vis = window.__vis;
            if (vis) {
                // If set to 10, we treat it as infinite for small graphs
                vis.highlightSettings.depth = val === 10 ? 100 : val;

                // Re-apply highlight if a node is currently selected
                if (this.selectedIds.size === 1 && this.selectedType === 'node') {
                    const id = Array.from(this.selectedIds)[0];
                    vis.highlightNode(id, true);
                }
            }
        };
        document.getElementById('highlight-direction').onchange = (e) => {
            const vis = window.__vis;
            if (vis) {
                vis.highlightSettings.direction = e.target.value;
                // Instantly update visuals if something is selected
                if (this.selectedIds.size === 1) {
                    const id = Array.from(this.selectedIds)[0];
                    if (this.selectedType === 'node') vis.highlightNode(id, true);
                    if (this.selectedType === 'edge') vis.highlightEdge(id);
                }
            }
        };

        document.getElementById('highlight-dim').oninput = (e) => {
            const vis = window.__vis;
            if (vis) {
                vis.highlightSettings.dimming = parseFloat(e.target.value);
                // Re-apply highlight if needed
                if (this.selectedIds.size === 1 && this.selectedType === 'node') {
                    const id = Array.from(this.selectedIds)[0];
                    vis.highlightNode(id, true);
                }
            }
        };

        document.getElementById('physics-speed').oninput = (e) => {
            const val = parseFloat(e.target.value);
            const speedVal = document.getElementById('speed-val');
            if (speedVal) speedVal.textContent = val.toFixed(1);
            const vis = window.__vis;
            if (vis) vis.physicsConfig.speed = val;
        };

        document.getElementById('line-thickness').oninput = (e) => {
            const val = parseFloat(e.target.value);
            const thickVal = document.getElementById('thickness-val');
            if (thickVal) thickVal.textContent = val.toFixed(1);
            const vis = window.__vis;
            if (vis) {
                vis.physicsConfig.edgeThickness = val;
                // Optimized: update all pairs once for O(E) performance
                vis.pairMap.forEach(p => vis.updateEdgePair(p.idA, p.idB));
            }
        };

        const debouncedRefresh = () => {
            if (this._refreshTimer) clearTimeout(this._refreshTimer);
            this._refreshTimer = setTimeout(() => this.refreshTypeStylesList(), 100);
        };

        this.refreshTypeStylesList();
        graphStorage.addEventListener('nodeAdded', debouncedRefresh);
        graphStorage.addEventListener('edgeAdded', debouncedRefresh);
        graphStorage.addEventListener('nodeRemoved', debouncedRefresh);
        graphStorage.addEventListener('edgeRemoved', debouncedRefresh);
    }

    refreshTypeStylesList() {
        const container = document.getElementById('type-styles-list');
        if (!container) return;

        // Get all unique types
        const nodeTypes = new Set();
        graphStorage.nodes.forEach(n => nodeTypes.add(n.type));
        const edgeTypes = new Set();
        graphStorage.edges.forEach(e => edgeTypes.add(e.type));

        container.innerHTML = '';

        const createPicker = (category, type) => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.style.background = 'rgba(0,0,0,0.2)';
            div.style.padding = '4px 8px';
            div.style.borderRadius = '4px';
            div.style.marginBottom = '2px';

            const label = document.createElement('span');
            label.textContent = `${category === 'node' ? 'Node' : 'Edge'}: ${type}`;
            label.style.fontSize = '0.75em';
            label.style.color = '#ccc';

            const picker = document.createElement('input');
            picker.type = 'color';
            picker.style.width = '24px';
            picker.style.height = '18px';
            picker.style.border = 'none';
            picker.style.padding = '0';
            picker.style.background = 'transparent';
            picker.style.cursor = 'pointer';

            const currentColor = category === 'node' ?
                (graphStorage.typeStyles.node[type] || '#88aaff') :
                (graphStorage.typeStyles.edge[type] || '#88aaff');
            picker.value = currentColor;

            picker.onchange = (e) => {
                graphStorage.updateTypeStyle(category, type, e.target.value);
            };

            div.appendChild(label);
            div.appendChild(picker);
            return div;
        };

        nodeTypes.forEach(t => container.appendChild(createPicker('node', t)));
        edgeTypes.forEach(t => container.appendChild(createPicker('edge', t)));
    }

    async saveGraph() {
        // Creates a simple modal to ask for the save slot name
        const oldName = graphStorage.graphName;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:3000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;border-radius:8px;padding:20px;width:300px;max-width:90vw;color:white;box-shadow:0 0 30px rgba(0,0,0,0.8);';

        modal.innerHTML = `
            <h3 style="margin:0 0 12px 0;color:#aaccff;">Save Graph</h3>
            <label style="display:block;margin-bottom:8px;font-size:0.9em;color:#ccc;">Save Slot Name:</label>
            <input type="text" id="save-slot-name" value="${oldName}" style="width:100%;padding:8px;background:#252540;border:1px solid #5a6a8a;color:white;border-radius:4px;box-sizing:border-box;margin-bottom:15px;">
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="save-btn-confirm" style="background:#3a8a5a;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Save</button>
                <button id="save-btn-cancel" style="background:#444;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Cancel</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const input = document.getElementById('save-slot-name');
        input.focus();
        input.select();

        const doSave = () => {
            const newName = input.value.trim();
            if (newName) {
                graphStorage.graphName = newName;
                document.getElementById('graph-name').value = newName;
                graphStorage.save();
                this._showSaveIndicator();
                document.body.removeChild(overlay);
            }
        };

        input.onkeydown = (e) => { if (e.key === 'Enter') doSave(); };
        document.getElementById('save-btn-confirm').onclick = doSave;
        document.getElementById('save-btn-cancel').onclick = () => document.body.removeChild(overlay);
    }

    async createNewGraph() {
        const oldName = graphStorage.graphName;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:3000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;border-radius:8px;padding:20px;width:300px;max-width:90vw;color:white;box-shadow:0 0 30px rgba(0,0,0,0.8);';

        modal.innerHTML = `
            <h3 style="margin:0 0 12px 0;color:#aaccff;">Create New Graph</h3>
            <p style="color:#ccc;font-size:0.9em;margin-bottom:12px;">This will clear the current graph. Are you sure?</p>
            <label style="display:block;margin-bottom:8px;font-size:0.9em;color:#ccc;">New Graph Name:</label>
            <input type="text" id="new-graph-name" value="New World Graph" style="width:100%;padding:8px;background:#252540;border:1px solid #5a6a8a;color:white;border-radius:4px;box-sizing:border-box;margin-bottom:15px;">
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="new-btn-confirm" style="background:#5a3a8a;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Create</button>
                <button id="new-btn-cancel" style="background:#444;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Cancel</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const input = document.getElementById('new-graph-name');
        input.focus();
        input.select();

        const doCreate = async () => {
            const newName = input.value.trim();
            if (newName) {
                // Clear current graph data
                await graphStorage.clear();

                // Set new graph name
                graphStorage.graphName = newName;

                // Create default node
                graphStorage.createDefaultGraph();

                // Update UI
                document.getElementById('graph-name').value = newName;
                window.__vis.heat(1.0);

                // Save the new graph
                await graphStorage.save();

                document.body.removeChild(overlay);
                this._showSaveIndicator();
            }
        };

        input.onkeydown = (e) => { if (e.key === 'Enter') doCreate(); };
        document.getElementById('new-btn-confirm').onclick = doCreate;
        document.getElementById('new-btn-cancel').onclick = () => document.body.removeChild(overlay);
    }

    async loadGraph() {
        const slots = await graphStorage.listStoredGraphs();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:3000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;border-radius:8px;padding:20px;width:350px;max-width:90vw;color:white;box-shadow:0 0 30px rgba(0,0,0,0.8);max-height:80vh;display:flex;flex-direction:column;';

        let html = '<h3 style="margin:0 0 12px 0;color:#aaccff;flex-shrink:0;">Load Graph</h3>';

        if (slots.length === 0) {
            html += '<p style="color:#aaa;">No saved graphs found.</p>';
        } else {
            html += '<div style="overflow-y:auto;flex:1;margin-bottom:15px;border:1px solid #3a4a6a;border-radius:4px;background:rgba(0,0,0,0.3);">';
            slots.forEach(slot => {
                const isCurrent = slot === graphStorage.graphName;
                html += `
                    <div class="load-slot-item" data-slot="${slot}" style="padding:10px;border-bottom:1px solid #2a2a4a;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s;">
                        <span>${slot} ${isCurrent ? '<em style="color:#88ff88;font-size:0.8em;">(Current)</em>' : ''}</span>
                        <button class="load-btn" data-slot="${slot}" style="padding:4px 10px;background:#3a5a8a;color:white;border:none;border-radius:3px;cursor:pointer;">Load</button>
                    </div>
                `;
            });
            html += '</div>';
        }

        html += '<div style="display:flex;justify-content:flex-end;flex-shrink:0;"><button id="load-btn-cancel" style="background:#444;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">Cancel</button></div>';

        modal.innerHTML = html;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Add hover effects
        modal.querySelectorAll('.load-slot-item').forEach(item => {
            item.onmouseover = () => item.style.background = '#2a3a5a';
            item.onmouseout = () => item.style.background = 'transparent';
        });

        // Add load click handlers
        modal.querySelectorAll('.load-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const slotToLoad = e.target.dataset.slot;
                const success = await graphStorage.loadSpecificGraph(slotToLoad);
                if (success) {
                    document.getElementById('graph-name').value = graphStorage.graphName;
                    window.__vis.heat(1.0);
                    document.body.removeChild(overlay);
                } else {
                    alert("Failed to load graph.");
                }
            };
        });

        document.getElementById('load-btn-cancel').onclick = () => document.body.removeChild(overlay);
    }

    hideMenu() {
        this.contextMenu.style.display = 'none';
    }

    // --- Field option presets (unchanged) ---
    static FIELD_OPTIONS = {
        'basic_info.gender': ['Male', 'Female', 'Non-binary', 'Trans Male', 'Trans Female', 'Genderfluid', 'Agender'],
        'basic_info.pronouns': ['He/Him', 'She/Her', 'They/Them', 'He/They', 'She/They', 'Any'],
        'basic_info.sexuality': ['Heterosexual', 'Homosexual', 'Bisexual', 'Pansexual', 'Asexual', 'Demisexual'],
        'basic_info.species': ['Human', 'Elf', 'Dwarf', 'Orc', 'Vampire', 'Werewolf', 'Demon', 'Angel', 'Fae', 'Dragon'],
        'basic_info.marital_status': ['Single', 'In a Relationship', 'Engaged', 'Married', 'Divorced', 'Widowed', "It's Complicated"],
        'personality.mbti': ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'],
        'personality.alignment': ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'],
        'appearance.build': ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Stocky', 'Petite', 'Tall', 'Heavy'],
        'appearance.hair.color': ['Black', 'Brown', 'Blonde', 'Red', 'Auburn', 'White', 'Gray', 'Pink', 'Blue', 'Green', 'Purple', 'Multi'],
        'appearance.eyes.color': ['Brown', 'Blue', 'Green', 'Hazel', 'Gray', 'Amber', 'Violet', 'Heterochromia'],
        'kinks_and_sexuality.orientation': ['Heterosexual', 'Homosexual', 'Bisexual', 'Pansexual', 'Asexual', 'Demisexual'],
    };

    // --- Character Schema Helper (unchanged, but included for completeness) ---
    

    _renderConnectedNodes(nodeId, container) {
        const edges = Array.from(graphStorage.edges.values()).filter(e => e.source === nodeId || e.target === nodeId);
        if (edges.length === 0) {
            container.innerHTML = '<em style="color:#888;">No connections yet</em>';
            return;
        }

        const connectedIds = new Set();
        edges.forEach(e => {
            if (e.source === nodeId) connectedIds.add(e.target);
            if (e.target === nodeId) connectedIds.add(e.source);
        });

        const nodes = Array.from(connectedIds)
            .map(id => graphStorage.getNode(id))
            .filter(n => n)
            .sort((a, b) => a.label.localeCompare(b.label));

        let html = '';
        nodes.slice(0, 5).forEach(n => {
            const typeClass = n.type;
            const icon = n.type.charAt(0).toUpperCase();
            html += `
            <div class="connected-item ${typeClass}" data-id="${n.id}">
                <span class="type-icon">${icon}</span>
                <span>${n.label}</span>
            </div>
        `;
        });
        if (nodes.length > 5) {
            html += `<div style="margin-top:4px; color:#88aaff; font-size:0.8em;">+ ${nodes.length - 5} more</div>`;
        }
        container.innerHTML = html;

        container.querySelectorAll('.connected-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                if (id) this.selectNode(id);
            });
        });
    }
    

    

    

    _renderObjectArray(arr, container, path) {
        const listDiv = document.createElement('div');
        listDiv.className = 'obj-array-list';
        listDiv.dataset.path = path.join('.');
        listDiv.dataset.type = 'object-array';

        // 1. Define which object arrays are allowed to be extracted
        const EXTRACTABLE_OBJECT_ARRAYS = [
            'basic_info.family.parents',
            'relationships.connections'
        ];
        const isExtractable = EXTRACTABLE_OBJECT_ARRAYS.includes(path.join('.'));

        const renderItem = (item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'obj-array-item';
            itemDiv.style.background = 'rgba(255,255,255,0.03)';
            itemDiv.style.padding = '8px';
            itemDiv.style.marginBottom = '6px';
            itemDiv.style.borderRadius = '4px';
            itemDiv.style.border = '1px solid #3a4a6a';
            itemDiv.style.position = 'relative';

            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕';
            removeBtn.title = 'Remove Entry';
            removeBtn.style.cssText = 'position:absolute; top:4px; right:4px; width:24px; height:24px; padding:0; margin:0; font-size:0.8em; background:#8a3a3a; border-radius:50%; min-width:unset;';
            removeBtn.onclick = (e) => {
                e.preventDefault();
                itemDiv.remove();
            };
            itemDiv.appendChild(removeBtn);

            // Extract Button (Only for whitelisted object arrays)
            if (isExtractable) {
                const extractBtn = document.createElement('button');
                extractBtn.textContent = '⤴';
                extractBtn.title = 'Extract to Graph Node';
                extractBtn.style.cssText = 'position:absolute; top:4px; right:32px; width:24px; height:24px; padding:0; margin:0; font-size:0.9em; background:#2a4a4a; border-radius:50%; min-width:unset; color:#88ffaa; border:1px solid #5a8a6a;';
                extractBtn.onclick = (e) => {
                    e.preventDefault();
                    // Gather the *current* values from the inputs
                    const currentObj = {};
                    itemDiv.querySelectorAll('.obj-array-field').forEach(field => {
                        const k = field.dataset.field;
                        if (field.type === 'checkbox') currentObj[k] = field.checked;
                        else if (field.dataset.subtype === 'array') currentObj[k] = field.value.split(',').map(s => s.trim());
                        else if (field.type === 'number') currentObj[k] = parseFloat(field.value);
                        else currentObj[k] = field.value;
                    });
                    this._showObjectExtractPopup(currentObj, this._editingNodeId, path.join('.'), itemDiv);
                };
                itemDiv.appendChild(extractBtn);
            }

            for (const [k, v] of Object.entries(item)) {
                const fieldLabel = document.createElement('label');
                fieldLabel.textContent = k.replace(/_/g, ' ');
                fieldLabel.style.fontSize = '0.8em';
                fieldLabel.style.color = '#aaa';
                fieldLabel.style.marginTop = '4px';
                itemDiv.appendChild(fieldLabel);

                let fieldInput;
                if (typeof v === 'boolean') {
                    fieldInput = document.createElement('input');
                    fieldInput.type = 'checkbox';
                    fieldInput.checked = v;
                } else if (typeof v === 'string' && v.length > 60) {
                    fieldInput = document.createElement('textarea');
                    fieldInput.value = v;
                    fieldInput.rows = 3;
                } else if (Array.isArray(v)) {
                    fieldInput = document.createElement('textarea');
                    fieldInput.value = v.join(', ');
                    fieldInput.rows = 2;
                    fieldInput.dataset.subtype = 'array';
                } else {
                    fieldInput = document.createElement('input');
                    fieldInput.type = typeof v === 'number' ? 'number' : 'text';
                    fieldInput.value = v ?? '';
                }
                fieldInput.dataset.field = k;
                fieldInput.className = 'obj-array-field';
                itemDiv.appendChild(fieldInput);
            }

            listDiv.appendChild(itemDiv);
        };

        arr.forEach((item, i) => renderItem(item, i));

        container.appendChild(listDiv);

        // Add button
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Entry';
        addBtn.style.cssText = 'margin-top:5px; font-size:0.8em; padding:4px 8px; background:#3a6a3a;';
        addBtn.onclick = (e) => {
            e.preventDefault();
            const template = {};
            if (arr.length > 0) {
                for (const k of Object.keys(arr[0])) {
                    const v = arr[0][k];
                    if (typeof v === 'boolean') template[k] = false;
                    else if (typeof v === 'number') template[k] = 0;
                    else if (Array.isArray(v)) template[k] = [];
                    else template[k] = '';
                }
            } else {
                template['value'] = '';
            }
            renderItem(template, listDiv.children.length);
        };
        container.appendChild(addBtn);
    }
_ensureResizeHandle() {
    // Remove old handle if any (prevents duplicates)
    if (this.resizeHandle && this.resizeHandle.parentNode) {
        this.resizeHandle.parentNode.removeChild(this.resizeHandle);
    }
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'panel-resize-handle';
    this.resizeHandle.style.cssText = `
        position: absolute;
        left: -5px;
        top: 0;
        width: 10px;
        height: 100%;
        cursor: ew-resize;
        background: transparent;
        z-index: 1000;
    `;
    this.propertiesPanel.style.position = 'absolute'; // needed for absolute positioning
    this.propertiesPanel.appendChild(this.resizeHandle);
    this._initResize(); // re‑attach events
}
    _collectFormData(container) {
        const data = {};

        // 1) Collect simple inputs (char-input)
        const inputs = container.querySelectorAll('.char-input');
        inputs.forEach(input => {
            const path = input.dataset.path.split('.');
            let current = data;
            for (let i = 0; i < path.length - 1; i++) {
                const part = path[i];
                if (!current[part]) current[part] = {};
                current = current[part];
            }
            const lastPart = path[path.length - 1];
            if (input.dataset.type === 'array') {
                current[lastPart] = input.value.split(',').map(s => s.trim()).filter(s => s !== '');
            } else if (input.type === 'checkbox') {
                current[lastPart] = input.checked;
            } else if (input.type === 'number') {
                current[lastPart] = parseFloat(input.value);
            } else {
                current[lastPart] = input.value;
            }
        });

        // 2) Collect object-array lists
        const objArrays = container.querySelectorAll('.obj-array-list');
        objArrays.forEach(list => {
            const path = list.dataset.path.split('.');
            let current = data;
            for (let i = 0; i < path.length - 1; i++) {
                const part = path[i];
                if (!current[part]) current[part] = {};
                current = current[part];
            }
            const lastPart = path[path.length - 1];
            const items = [];
            list.querySelectorAll('.obj-array-item').forEach(itemDiv => {
                const obj = {};
                itemDiv.querySelectorAll('.obj-array-field').forEach(field => {
                    const k = field.dataset.field;
                    if (field.type === 'checkbox') {
                        obj[k] = field.checked;
                    } else if (field.dataset.subtype === 'array') {
                        obj[k] = field.value.split(',').map(s => s.trim()).filter(s => s !== '');
                    } else if (field.type === 'number') {
                        obj[k] = parseFloat(field.value);
                    } else {
                        obj[k] = field.value;
                    }
                });
                items.push(obj);
            });
            current[lastPart] = items;
        });

        // 3) Collect combo-select values
        const comboSelects = container.querySelectorAll('.char-combo-select');
        comboSelects.forEach(select => {
            const path = select.dataset.path.split('.');
            let current = data;
            for (let i = 0; i < path.length - 1; i++) {
                const part = path[i];
                if (!current[part]) current[part] = {};
                current = current[part];
            }
            const lastPart = path[path.length - 1];
            if (select.value === '__other__') {
                // Use the linked custom input
                const customInput = container.querySelector(`.char-input[data-path="${select.dataset.path}"]`);
                current[lastPart] = customInput ? customInput.value : '';
            } else {
                current[lastPart] = select.value;
            }
        });

        return data;
    }

    _showExtractPopup(fieldValue, sourceNodeId, fieldPath = '') {
        const old = document.querySelector('.extract-popup-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.className = 'extract-popup-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:3000;display:flex;align-items:center;justify-content:center;';

        const popup = document.createElement('div');
        popup.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;border-radius:8px;padding:20px;width:380px;max-width:90vw;color:white;box-shadow:0 0 30px rgba(0,0,0,0.8);';

        const title = document.createElement('h3');
        title.textContent = 'Extract to Node(s)';
        title.style.cssText = 'margin:0 0 12px 0;color:#aaccff;';
        popup.appendChild(title);

        // Split multiple items if they are comma-separated!
        const items = fieldValue ? String(fieldValue).split(',').map(s => s.trim()).filter(s => s) : [];
        const isMultiple = items.length > 1;

        const labelLabel = document.createElement('label');
        labelLabel.textContent = isMultiple ? 'Node Labels (One per line)' : 'Node Label';
        labelLabel.style.cssText = 'display:block;margin:8px 0 4px;font-size:0.9em;color:#ccc;';
        popup.appendChild(labelLabel);

        const labelInput = document.createElement('textarea');
        labelInput.value = items.join('\n');
        labelInput.rows = Math.max(2, Math.min(items.length || 1, 5));
        labelInput.style.cssText = 'width:100%;padding:6px;background:#252540;border:1px solid #5a6a8a;color:white;border-radius:4px;box-sizing:border-box;resize:vertical;font-family:inherit;';
        popup.appendChild(labelInput);

        const typeLabel = document.createElement('label');
        typeLabel.textContent = 'Node Type';
        typeLabel.style.cssText = 'display:block;margin:12px 0 4px;font-size:0.9em;color:#ccc;';
        popup.appendChild(typeLabel);

        const typeSelect = document.createElement('select');
        typeSelect.style.cssText = 'width:100%;padding:6px;background:#252540;border:1px solid #5a6a8a;color:white;border-radius:4px;';
        ['person', 'location', 'item', 'concept'].forEach(t => {
            typeSelect.innerHTML += `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`;
        });

        // Smart Default Type matching based on the field path
        let defaultType = 'concept';
        if (fieldPath.includes('location') || fieldPath.includes('residence') || fieldPath.includes('nationality')) defaultType = 'location';
        else if (fieldPath.match(/family|partner|friends|enemies|rivals|mentors|protégé|parents|siblings|children|participants/)) defaultType = 'person';
        else if (fieldPath.match(/media|item|books|movies|music/)) defaultType = 'item';
        typeSelect.value = defaultType;
        popup.appendChild(typeSelect);

        const matchLabel = document.createElement('label');
        matchLabel.textContent = 'Or connect to existing node:';
        matchLabel.style.cssText = 'display:block;margin:14px 0 6px;font-size:0.9em;color:#88ccff;';
        popup.appendChild(matchLabel);

        const matchList = document.createElement('div');
        matchList.style.cssText = 'max-height:150px;overflow-y:auto;border:1px solid #3a4a6a;border-radius:4px;background:#12122a;';
        popup.appendChild(matchList);

        let selectedExistingId = null;

        const updateMatches = (query) => {
            const matches = graphStorage.searchNodes(query);
            matchList.innerHTML = '';
            if (matches.length === 0) {
                matchList.innerHTML = '<div style="padding:8px;color:#888;font-style:italic;">No matches found</div>';
                return;
            }
            matches.slice(0, 10).forEach(m => {
                const row = document.createElement('div');
                row.style.cssText = 'padding:6px 10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2a2a4a;transition:background 0.15s;';
                row.innerHTML = `<span>${m.label}</span><span style="font-size:0.75em;color:#888;text-transform:uppercase;">${m.type}</span>`;
                row.onmouseover = () => row.style.background = '#2a3a5a';
                row.onmouseout = () => { if (selectedExistingId !== m.id) row.style.background = ''; };
                row.onclick = () => {
                    matchList.querySelectorAll('div').forEach(d => d.style.background = '');
                    row.style.background = '#3a5a8a';
                    selectedExistingId = m.id;
                };
                matchList.appendChild(row);
            });
        };

        const checkMultiple = () => {
            const lines = labelInput.value.split('\n').map(s => s.trim()).filter(s => s);
            if (lines.length > 1) {
                matchList.style.display = 'none';
                matchLabel.style.display = 'none';
                selectedExistingId = null;
            } else {
                matchList.style.display = 'block';
                matchLabel.style.display = 'block';
                updateMatches(lines[0] || '');
            }
        };

        checkMultiple();
        labelInput.oninput = () => {
            selectedExistingId = null;
            checkMultiple();
        };

        // Auto-generate edge label from the field name
        let edgeLabel = '';
        if (fieldPath) {
            const parts = fieldPath.split('.');
            edgeLabel = parts[parts.length - 1].replace(/_/g, ' ');
            edgeLabel = edgeLabel.charAt(0).toUpperCase() + edgeLabel.slice(1);
        }

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;margin-top:16px;';

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create & Connect';
        createBtn.style.cssText = 'flex:1;padding:8px;background:#3a8a5a;color:white;border:none;border-radius:4px;cursor:pointer;';
        createBtn.onclick = () => {
            const labels = labelInput.value.split('\n').map(s => s.trim()).filter(s => s);
            if (labels.length === 0) return;

            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            const basePos = this.camera.position.clone().add(direction.multiplyScalar(5));

            labels.forEach((label) => {
                const pos = basePos.clone();
                // If creating multiple items, scatter them slightly so they don't stack
                if (labels.length > 1) {
                    pos.x += (Math.random() - 0.5) * 4;
                    pos.y += (Math.random() - 0.5) * 4;
                    pos.z += (Math.random() - 0.5) * 4;
                }
                const newId = graphStorage.createNode(typeSelect.value, pos);
                graphStorage.updateNode(newId, { label: label });

                const edgeId = graphStorage.createEdge(sourceNodeId, newId);
                if (edgeLabel) {
                    graphStorage.updateEdge(edgeId, { label: edgeLabel });
                }
            });

            overlay.remove();
            window.__vis.heat(1.0);
        };

        const connectBtn = document.createElement('button');
        connectBtn.textContent = 'Connect Existing';
        connectBtn.style.cssText = 'flex:1;padding:8px;background:#3a5a8a;color:white;border:none;border-radius:4px;cursor:pointer;';
        connectBtn.onclick = () => {
            if (selectedExistingId === null) return;
            const edgeId = graphStorage.createEdge(sourceNodeId, selectedExistingId);
            if (edgeLabel) {
                graphStorage.updateEdge(edgeId, { label: edgeLabel });
            }
            overlay.remove();
            window.__vis.heat(0.5);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:8px 16px;background:#5a5a5a;color:white;border:none;border-radius:4px;cursor:pointer;';
        cancelBtn.onclick = () => overlay.remove();

        btnRow.appendChild(createBtn);
        btnRow.appendChild(connectBtn);
        btnRow.appendChild(cancelBtn);
        popup.appendChild(btnRow);

        overlay.appendChild(popup);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
        labelInput.focus();
    }

    _showObjectExtractPopup(itemObj, sourceNodeId, fieldPath, itemDiv) {
        const old = document.querySelector('.extract-popup-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.className = 'extract-popup-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:3000;display:flex;align-items:center;justify-content:center;';

        const popup = document.createElement('div');
        popup.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;border-radius:8px;padding:20px;width:380px;max-width:90vw;color:white;box-shadow:0 0 30px rgba(0,0,0,0.8);';

        const title = document.createElement('h3');
        title.textContent = 'Extract Detail to Node';
        title.style.cssText = 'margin:0 0 12px 0;color:#aaccff;';
        popup.appendChild(title);

        // Map Object properties to Graph properties intelligently
        const nodeName = itemObj.name || itemObj.character_name || itemObj.full_name || '';
        const edgeRelation = itemObj.relation || itemObj.relationship_type || '';

        let edgeDescParts = [];
        if (itemObj.status) edgeDescParts.push(`Status: ${itemObj.status}`);
        if (itemObj.affection_level) edgeDescParts.push(`Affection: ${itemObj.affection_level}`);
        if (itemObj.description) edgeDescParts.push(itemObj.description);
        if (itemObj.notes) edgeDescParts.push(itemObj.notes);
        const edgeDescription = edgeDescParts.join('\n\n');

        // Node Label Input
        const labelLabel = document.createElement('label');
        labelLabel.textContent = 'Node Label';
        labelLabel.style.cssText = 'display:block;margin:8px 0 4px;font-size:0.9em;color:#ccc;';
        popup.appendChild(labelLabel);

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = nodeName;
        labelInput.style.cssText = 'width:100%;padding:6px;background:#252540;border:1px solid #5a6a8a;color:white;border-radius:4px;box-sizing:border-box;';
        popup.appendChild(labelInput);

        // Edge Config Input
        const edgeContainer = document.createElement('div');
        edgeContainer.style.cssText = 'background:rgba(255,255,255,0.05); padding:10px; border-radius:4px; margin-top:10px; border:1px solid #3a4a6a;';

        edgeContainer.innerHTML = `
            <label style="display:block; font-size:0.85em; color:#aaffaa; margin-bottom:5px;">Relationship (Edge Label)</label>
            <input type="text" id="extract-edge-label" value="${edgeRelation}" style="width:100%; padding:5px; background:#1e1e2a; border:1px solid #5a6a8a; color:white; border-radius:3px; margin-bottom:10px; box-sizing:border-box;">
            
            <label style="display:block; font-size:0.85em; color:#aaffaa; margin-bottom:5px;">Relationship Details (Edge Desc)</label>
            <textarea id="extract-edge-desc" rows="3" style="width:100%; padding:5px; background:#1e1e2a; border:1px solid #5a6a8a; color:white; border-radius:3px; resize:vertical; box-sizing:border-box;">${edgeDescription}</textarea>
        `;
        popup.appendChild(edgeContainer);

        // Match existing nodes
        const matchLabel = document.createElement('label');
        matchLabel.textContent = 'Or connect to existing node:';
        matchLabel.style.cssText = 'display:block;margin:14px 0 6px;font-size:0.9em;color:#88ccff;';
        popup.appendChild(matchLabel);

        const matchList = document.createElement('div');
        matchList.style.cssText = 'max-height:120px;overflow-y:auto;border:1px solid #3a4a6a;border-radius:4px;background:#12122a;';
        popup.appendChild(matchList);

        let selectedExistingId = null;

        const updateMatches = (query) => {
            const matches = graphStorage.searchNodes(query);
            matchList.innerHTML = '';
            if (matches.length === 0) {
                matchList.innerHTML = '<div style="padding:8px;color:#888;font-style:italic;">No matches found</div>';
                return;
            }
            matches.slice(0, 5).forEach(m => {
                const row = document.createElement('div');
                row.style.cssText = 'padding:6px 10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2a2a4a;transition:background 0.15s;';
                row.innerHTML = `<span>${m.label}</span><span style="font-size:0.75em;color:#888;text-transform:uppercase;">${m.type}</span>`;
                row.onmouseover = () => row.style.background = '#2a3a5a';
                row.onmouseout = () => { if (selectedExistingId !== m.id) row.style.background = ''; };
                row.onclick = () => {
                    matchList.querySelectorAll('div').forEach(d => d.style.background = '');
                    row.style.background = '#3a5a8a';
                    selectedExistingId = m.id;
                };
                matchList.appendChild(row);
            });
        };

        updateMatches(nodeName);
        labelInput.oninput = () => {
            selectedExistingId = null;
            updateMatches(labelInput.value);
        };

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;margin-top:16px;';

        const finalizeExtraction = (targetNodeId) => {
            // Apply Edge Label and Description
            const finalEdgeLabel = popup.querySelector('#extract-edge-label').value;
            const finalEdgeDesc = popup.querySelector('#extract-edge-desc').value;

            const edgeId = graphStorage.createEdge(sourceNodeId, targetNodeId);
            graphStorage.updateEdge(edgeId, { label: finalEdgeLabel, description: finalEdgeDesc });

            // **Crucial Step**: Remove the item from the character panel so it's not duplicated!
            itemDiv.remove();

            overlay.remove();
            window.__vis.heat(1.0);

            // Note: User must still click "Update" on the main panel to save the deletion of the object.
            // We flash a little hint to remind them.
            const saveBtn = document.getElementById('save-node');
            if (saveBtn) {
                saveBtn.style.boxShadow = '0 0 15px #88ffaa';
                setTimeout(() => saveBtn.style.boxShadow = 'none', 1500);
            }
        };

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create New';
        createBtn.style.cssText = 'flex:1;padding:8px;background:#3a8a5a;color:white;border:none;border-radius:4px;cursor:pointer;';
        createBtn.onclick = () => {
            const label = labelInput.value.trim();
            if (!label) return;

            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            const pos = this.camera.position.clone().add(direction.multiplyScalar(5));
            pos.x += (Math.random() - 0.5) * 3;
            pos.z += (Math.random() - 0.5) * 3;

            const newId = graphStorage.createNode('person', pos); // Defaulting to person for family/connections
            graphStorage.updateNode(newId, { label: label });

            finalizeExtraction(newId);
        };

        const connectBtn = document.createElement('button');
        connectBtn.textContent = 'Link Existing';
        connectBtn.style.cssText = 'flex:1;padding:8px;background:#3a5a8a;color:white;border:none;border-radius:4px;cursor:pointer;';
        connectBtn.onclick = () => {
            if (selectedExistingId === null) return;
            finalizeExtraction(selectedExistingId);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:8px 16px;background:#5a5a5a;color:white;border:none;border-radius:4px;cursor:pointer;';
        cancelBtn.onclick = () => overlay.remove();

        btnRow.appendChild(createBtn);
        btnRow.appendChild(connectBtn);
        btnRow.appendChild(cancelBtn);
        popup.appendChild(btnRow);

        overlay.appendChild(popup);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
        labelInput.focus();
    }
    showMergeDuplicatesModal() {
        // 1. Scan graph for duplicates in ALLOWED types
        const groups = {};
        const allowedTypes = ['concept', 'item', 'location', 'person', 'event', 'file', 'folder'];

        graphStorage.nodes.forEach(n => {
            if (allowedTypes.includes(n.type)) {
                // Group by Type + Label to prevent cross-type merging
                const key = `${n.type}::${n.label.toLowerCase()}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(n);
            }
        });

        // 2. Filter for groups with > 1 node
        const duplicates = Object.entries(groups)
            .filter(([_, group]) => group.length > 1)
            .map(([key, group]) => ({
                type: group[0].type,
                label: group[0].label,
                count: group.length,
                rawLabel: group[0].label // Keep original casing of first found
            }));

        if (duplicates.length === 0) {
            alert("No duplicate Concepts, Items, or Locations found!");
            return;
        }

        // 3. Build UI
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:3000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;padding:20px;border-radius:8px;width:450px;max-width:90vw;max-height:80vh;overflow-y:auto;color:white;box-shadow:0 0 30px rgba(0,0,0,0.8);';

        modal.innerHTML = `
            <h3 style="margin-top:0; color:#aaccff;">Merge Duplicates</h3>
            <p style="font-size:0.85em; color:#ccc; margin-bottom:15px;">
                Merging combines descriptions and re-links connections to a single node.
                <br><em>Supports: Concepts, Items, Locations</em>
            </p>
        `;

        const listDiv = document.createElement('div');
        listDiv.style.cssText = 'background:rgba(0,0,0,0.3); border:1px solid #3a4a6a; border-radius:4px; padding:10px; margin-bottom:15px;';

        duplicates.forEach(dup => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #2a2a4a;';

            let typeColor = '#88aaff';
            if (dup.type === 'location') typeColor = '#88ffaa';
            if (dup.type === 'item') typeColor = '#ffcc88';

            row.innerHTML = `
        <div>
            <strong>${dup.label}</strong>
            <span style="font-size:0.75em; background:${typeColor}; color:#222; padding:1px 4px; border-radius:3px; margin-left:5px; text-transform:uppercase;">${dup.type}</span>
            <div style="font-size:0.75em; color:#88aaff;">${dup.count} nodes</div>
        </div>
        <div style="display:flex; gap:5px;">
            <button class="merge-auto-btn" style="background:#3a8a5a; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; font-size:0.9em;">Auto Merge</button>
            <button class="merge-resolve-btn" style="background:#5a3a8a; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; font-size:0.9em;">Resolve...</button>
        </div>
    `;

            // Find the actual node objects for this group
            const groupNodes = Array.from(graphStorage.nodes.values()).filter(n =>
                n.type === dup.type && n.label.toLowerCase() === dup.rawLabel.toLowerCase()
            );

            row.querySelector('.merge-auto-btn').onclick = () => {
                graphStorage.mergeDuplicateNodes(dup.rawLabel, dup.type);
                row.remove();
                window.__vis.heat(1.0);
                if (listDiv.children.length === 0) overlay.remove();
            };

            row.querySelector('.merge-resolve-btn').onclick = () => {
                this._showMergeResolutionModal(groupNodes, dup.type, dup.rawLabel);
            };

            listDiv.appendChild(row);
        });

        modal.appendChild(listDiv);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex; gap:10px; justify-content:flex-end;';

        const mergeAllBtn = document.createElement('button');
        mergeAllBtn.textContent = 'Merge All';
        mergeAllBtn.style.cssText = 'background:#8a6a3a; color:white; border:none; padding:8px 16px; border-radius:3px; cursor:pointer;';
        mergeAllBtn.onclick = () => {
            duplicates.forEach(dup => graphStorage.mergeDuplicateNodes(dup.rawLabel, dup.type));
            window.__vis.heat(1.0);
            overlay.remove();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Close';
        cancelBtn.style.cssText = 'background:#444; color:white; border:none; padding:8px 16px; border-radius:3px; cursor:pointer;';
        cancelBtn.onclick = () => overlay.remove();

        btnRow.appendChild(mergeAllBtn);
        btnRow.appendChild(cancelBtn);
        modal.appendChild(btnRow);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    async _handleFileUpload(input) {
        if (!input || !input.files || input.files.length === 0) return null;
        const file = input.files[0];
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    _showMergeResolutionModal(nodes, type, label) {
        if (nodes.length < 2) return;

        // Sort by ID to keep oldest as primary reference
        nodes.sort((a, b) => a.id - b.id);
        const primary = nodes[0];
        const others = nodes.slice(1);

        // Flatten properties of each node
        const flatNodes = nodes.map(node => this._flattenObject(node.properties || {}));
        const allFields = new Set();
        flatNodes.forEach(flat => Object.keys(flat).forEach(k => allFields.add(k)));

        // Build rows data
        const rows = Array.from(allFields).map(field => {
            const values = nodes.map(node => this._getValueByPath(node.properties, field));
            const isConflict = !this._allEqual(values);
            return { field, values, isConflict };
        });

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:5000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;border-radius:8px;padding:20px;width:800px;max-width:95vw;max-height:80vh;overflow-y:auto;color:white;box-shadow:0 0 30px rgba(0,0,0,0.9);';

        let html = `
        <h3 style="margin-top:0; color:#aaccff;">Merge Resolution: ${label} (${type})</h3>
        <p style="color:#ccc;">Select which values to keep for the merged node. Conflicting fields are highlighted.</p>
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
            <thead>
                <tr style="border-bottom:1px solid #3a4a6a;">
                    <th style="text-align:left; padding:8px;">Field</th>
                    ${nodes.map((_, idx) => `<th style="text-align:left; padding:8px;">Node ${idx + 1} (ID: ${nodes[idx].id})</th>`).join('')}
                    <th style="text-align:left; padding:8px;">Keep</th>
                </tr>
            </thead>
            <tbody>
    `;

        rows.forEach(row => {
            const rowColor = row.isConflict ? '#ffeedd' : '#ddeeff';
            html += `<tr style="border-bottom:1px solid #2a2a4a; background:${rowColor}10;">`;
            html += `<td style="padding:8px; font-family:monospace;">${row.field}</td>`;
            row.values.forEach((val, idx) => {
                const displayVal = val !== undefined ? JSON.stringify(val) : '<em>missing</em>';
                html += `<td style="padding:8px;">${displayVal}</td>`;
            });
            // Radio buttons to choose which node's value to keep (default to primary)
            html += `<td style="padding:8px;">`;
            nodes.forEach((_, idx) => {
                const checked = idx === 0 ? 'checked' : '';
                html += `<label style="display:block;"><input type="radio" name="${row.field}" value="${idx}" ${checked}> Node ${idx + 1}</label>`;
            });
            html += `</td>`;
            html += `</tr>`;
        });

        html += `
            </tbody>
        </table>
        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:20px;">
            <button id="merge-cancel" style="background:#5a3a3a; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Cancel</button>
            <button id="merge-preview" style="background:#3a5a8a; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Preview</button>
            <button id="merge-apply" style="background:#3a8a5a; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Apply Merge</button>
        </div>
    `;

        modal.innerHTML = html;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Preview functionality (simple alert for now)
        document.getElementById('merge-preview').onclick = () => {
            const selections = {};
            rows.forEach(row => {
                const radios = document.getElementsByName(row.field);
                let selectedIdx = null;
                for (let i = 0; i < radios.length; i++) {
                    if (radios[i].checked) {
                        selectedIdx = parseInt(radios[i].value);
                        break;
                    }
                }
                if (selectedIdx !== null) {
                    selections[row.field] = nodes[selectedIdx].id;
                }
            });
            console.log('Preview selections:', selections);
            alert('Check console for preview selections. Full preview coming soon!');
        };

        // Apply merge
        document.getElementById('merge-apply').onclick = () => {
            // Gather selected values
            const mergedProps = {};
            rows.forEach(row => {
                const radios = document.getElementsByName(row.field);
                let selectedIdx = null;
                for (let i = 0; i < radios.length; i++) {
                    if (radios[i].checked) {
                        selectedIdx = parseInt(radios[i].value);
                        break;
                    }
                }
                if (selectedIdx !== null) {
                    const value = this._getValueByPath(nodes[selectedIdx].properties, row.field);
                    this._setValueByPath(mergedProps, row.field, value);
                }
            });

            // Call a new merge function (we'll implement next)
            this._mergeNodesWithCustomProperties(primary.id, others.map(n => n.id), mergedProps);

            overlay.remove();
            window.__vis.heat(1.0);
            alert('Merge complete!');
        };

        document.getElementById('merge-cancel').onclick = () => overlay.remove();
    }
    _mergeNodesWithCustomProperties(primaryId, otherIds, mergedProperties) {
        // Start a history transaction
        graphStorage._pushState();

        const primaryNode = graphStorage.getNode(primaryId);
        if (!primaryNode) return;

        // Update primary with merged properties
        graphStorage.updateNode(primaryId, { properties: mergedProperties });

        // Collect all edges that involve any of the other nodes
        const edgesToReattach = [];
        otherIds.forEach(id => {
            graphStorage.edges.forEach(edge => {
                if (edge.source === id || edge.target === id) {
                    edgesToReattach.push({ edge, oldId: id });
                }
            });
        });

        // For each edge, delete the old one and create a new one pointing to primary
        edgesToReattach.forEach(({ edge, oldId }) => {
            graphStorage.deleteEdge(edge.id); // Remove old visual

            const newSource = edge.source === oldId ? primaryId : edge.source;
            const newTarget = edge.target === oldId ? primaryId : edge.target;

            if (newSource !== newTarget) { // avoid self-loops
                const newId = graphStorage.createEdge(newSource, newTarget);
                // Copy over attributes
                graphStorage.updateEdge(newId, {
                    label: edge.label,
                    description: edge.description,
                    attributes: { ...edge.attributes },
                    status: edge.status || 'active'
                });
            }
        });

        // Delete the other nodes
        otherIds.forEach(id => graphStorage.deleteNode(id));

        // Save
        graphStorage.save();
        console.log(`Merged nodes: primary ${primaryId}, removed ${otherIds.join(', ')}`);
    }

    _showExportModal(nodeId = null) {
    return _showExportModal(nodeId);
}

    // Flatten a nested object into dot‑notation keys
    _flattenObject(obj, prefix = '') {
        let result = {};
        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(result, this._flattenObject(value, newKey));
            } else {
                result[newKey] = value;
            }
        }
        return result;
    }

    // Get a value by dot‑notation path
    _getValueByPath(obj, path) {
        return path.split('.').reduce((current, part) => current && current[part], obj);
    }

    // Set a value by dot‑notation path (for constructing merged object)
    _setValueByPath(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const target = parts.reduce((current, part) => {
            if (!current[part] || typeof current[part] !== 'object') current[part] = {};
            return current[part];
        }, obj);
        target[last] = value;
    }

    // Check if all values in an array are equal (for conflict detection)
    _allEqual(arr) {
        return arr.every(v => JSON.stringify(v) === JSON.stringify(arr[0]));
    }

    _generateMDStringForNode(nodeId, maxHops) {
        const nodeIdsToExport = this._getNodesWithinHops(nodeId, maxHops);
        let fullMD = "";
        nodeIdsToExport.forEach(nId => {
            fullMD += this._generateMDForNode(nId);
        });
        return fullMD;
    }
    _generateSillyTavernLorebook(activeFilters, startNodeId = null, hops = 0) {
        let nodesToExport = [];
        if (startNodeId !== null) {
            const ids = this._getNodesWithinHops(startNodeId, hops);
            nodesToExport = ids.map(id => graphStorage.getNode(id)).filter(Boolean);
        } else {
            nodesToExport = Array.from(graphStorage.nodes.values());
            if (activeFilters) {
                nodesToExport = nodesToExport.filter(n => activeFilters.has(n.type));
            }
        }

        const entries = {};
        nodesToExport.forEach((node, index) => {
            // Use a Set to avoid duplicate trigger words
            const keys = new Set();

            // 1. Add Base Label
            if (node.label) keys.add(node.label.trim());

            // 2. Scrape deep character name fields
            if (node.properties?.basic_info?.name) {
                const nameData = node.properties.basic_info.name;
                if (nameData.full) keys.add(nameData.full.trim());
                if (nameData.first) keys.add(nameData.first.trim());
                if (nameData.last) keys.add(nameData.last.trim());

                if (Array.isArray(nameData.nicknames)) {
                    nameData.nicknames.forEach(n => { if (n.trim()) keys.add(n.trim()); });
                }
                if (Array.isArray(nameData.aliases)) {
                    nameData.aliases.forEach(a => { if (a.trim()) keys.add(a.trim()); });
                }
            }

            // Repurposing the markdown generator provides deeply robust info/context for LLMs
            let content = this._generateMDForNode(node.id).trim();

            entries[index.toString()] = {
                uid: index,
                key: Array.from(keys), // Convert Set back to Array for JSON
                keysecondary: [],
                comment: node.label,
                content: content,
                constant: false,
                selective: true,
                order: 100,
                position: 0,
                disable: false,
                displayIndex: index,
                addMemo: true,
                group: "",
                groupOverride: false,
                groupWeight: 100,
                sticky: 0,
                cooldown: 0,
                delay: 0,
                probability: 100,
                depth: 4,
                useProbability: true,
                role: null,
                vectorized: false,
                excludeRecursion: false,
                preventRecursion: false,
                delayUntilRecursion: false,
                scanDepth: null,
                caseSensitive: null,
                matchWholeWords: null,
                useGroupScoring: null,
                automationId: "",
                selectiveLogic: 0,
                ignoreBudget: false,
                matchPersonaDescription: false,
                matchCharacterDescription: false,
                matchCharacterPersonality: false,
                matchCharacterDepthPrompt: false,
                matchScenario: false,
                matchCreatorNotes: false,
                outletName: "",
                triggers: [],
                characterFilter: { isExclude: false, names: [], tags: [] }
            };
        });

        return { entries };
    }
    _generateCypherMerge(activeFilters, startNodeId = null, hops = 0) {
        let nodesToExport = [];
        let validNodeIds = new Set();

        if (startNodeId !== null) {
            const ids = this._getNodesWithinHops(startNodeId, hops);
            nodesToExport = ids.map(id => graphStorage.getNode(id)).filter(Boolean);
            validNodeIds = new Set(ids);
        } else {
            nodesToExport = Array.from(graphStorage.nodes.values());
            if (activeFilters) {
                nodesToExport = nodesToExport.filter(n => activeFilters.has(n.type));
            }
            nodesToExport.forEach(n => validNodeIds.add(n.id));
        }

        const escapeStr = (str) => (str || "").toString().replace(/(["\\])/g, '\\$1').replace(/\n/g, '\\n');

        let cypher = "// -- Nodes --\n";
        nodesToExport.forEach(node => {
            const label = (node.type || 'Node').charAt(0).toUpperCase() + (node.type || 'Node').slice(1);
            let desc = "";
            if (node.properties?.description) {
                desc = node.properties.description;
            } else if (node.properties?.basic_info?.name?.full) {
                desc = "Character: " + node.properties.basic_info.name.full;
            }

            cypher += `MERGE (n:\`${label}\` { id: "${escapeStr(node.id.toString())}" })\n`;
            cypher += `SET n.label = "${escapeStr(node.label)}", n.description = "${escapeStr(desc)}";\n\n`;
        });

        cypher += "// -- Relationships --\n";
        const edgesToExport = Array.from(graphStorage.edges.values()).filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target));

        edgesToExport.forEach(edge => {
            // Cleans user-generated tags into valid Cypher relations (e.g. "Best Friend" -> :BEST_FRIEND)
            let relType = (edge.label || edge.type || "RELATED_TO").toUpperCase().replace(/[^A-Z0-9_]/g, '_');
            if (!relType.match(/^[A-Z]/)) relType = "REL_" + relType;

            cypher += `MATCH (a {id: "${escapeStr(edge.source.toString())}"}), (b {id: "${escapeStr(edge.target.toString())}"})\n`;
            cypher += `MERGE (a)-[r:\`${relType}\`]->(b)\n`;

            // Apply relationship attributes
            let sets = [];
            if (edge.label) sets.push(`r.label = "${escapeStr(edge.label)}"`);
            if (edge.description) sets.push(`r.description = "${escapeStr(edge.description)}"`);
            if (edge.attributes?.strength !== undefined) sets.push(`r.strength = ${edge.attributes.strength}`);

            if (sets.length > 0) {
                cypher += `SET ${sets.join(', ')}`;
            }
            cypher += `;\n\n`;

            // If the edge is marked bidirectional, create the reverse edge too
            if (edge.attributes?.bidirectional) {
                cypher += `MATCH (a {id: "${escapeStr(edge.target.toString())}"}), (b {id: "${escapeStr(edge.source.toString())}"})\n`;
                cypher += `MERGE (a)-[r:\`${relType}\`]->(b)\n`;
                if (sets.length > 0) {
                    cypher += `SET ${sets.join(', ')}`;
                }
                cypher += `;\n\n`;
            }
        });

        return cypher;
    }

    _getNodesWithinHops(startNodeId, maxHops) {
        const visited = new Map();
        const queue = [{ id: startNodeId, hops: 0 }];
        visited.set(startNodeId, 0);

        while (queue.length > 0) {
            const current = queue.shift();
            if (current.hops >= maxHops) continue;

            const connectedEdges = Array.from(graphStorage.edges.values()).filter(e => e.source === current.id || e.target === current.id);
            for (const edge of connectedEdges) {
                const neighborId = edge.source === current.id ? edge.target : edge.source;
                // Only follow connections to Person nodes to avoid clutter, or maybe all nodes? 
                // Let's include all nodes that are connected (Locations, Items).
                if (!visited.has(neighborId)) {
                    visited.set(neighborId, current.hops + 1);
                    queue.push({ id: neighborId, hops: current.hops + 1 });
                }
            }
        }
        return Array.from(visited.keys());
    }

    _generateMDForNode(nodeId) {
        const node = graphStorage.getNode(nodeId);
        if (!node) return "";
        let md = `# ${node.label}\n`;
        md += `**Type**: ${node.type}\n\n`;

        const props = node.properties;
        if (!props) return md + "---\n\n";

        // Smart recursive formatter to prevent [object Object]
        const formatValue = (v) => {
            if (typeof v === 'string') return v;
            if (Array.isArray(v)) {
                // Filter out empty items and format each recursively
                const formattedItems = v.map(item => formatValue(item)).filter(item => item !== "");
                return formattedItems.join(', ');
            }
            if (typeof v === 'object' && v !== null) {
                const entries = Object.entries(v)
                    .filter(([_, val]) => val !== null && val !== "" && (Array.isArray(val) ? val.length > 0 : true))
                    .map(([k, val]) => `${k.replace(/_/g, ' ')}: ${formatValue(val)}`);

                // If the object has properties, wrap them in brackets for readability
                if (entries.length > 0) return `{ ${entries.join(' | ')} }`;
                return "";
            }
            return String(v);
        };

        const formatSection = (title, obj) => {
            if (!obj) return "";
            if (typeof obj === 'string' && obj.trim() === "") return "";

            let section = `## ${title}\n`;
            if (typeof obj === 'string') {
                section += `${obj}\n\n`;
            } else if (Array.isArray(obj)) {
                if (obj.length === 0) return "";
                obj.forEach(item => {
                    section += `- ${formatValue(item)}\n`;
                });
                section += `\n`;
            } else if (typeof obj === 'object') {
                if (Object.keys(obj).length === 0) return "";
                let hasData = false;
                for (const [k, v] of Object.entries(obj)) {
                    // Check if value actually has content
                    if (v && (typeof v === 'number' || typeof v === 'boolean' || v.length > 0 || (typeof v === 'object' && Object.keys(v).length > 0))) {
                        hasData = true;
                        const readableKey = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                        // Clean up the output string
                        let formattedStr = formatValue(v);
                        if (formattedStr.startsWith('{ ') && formattedStr.endsWith(' }')) {
                            formattedStr = formattedStr.substring(2, formattedStr.length - 2); // Remove outer brackets for top-level traits
                        }
                        if (formattedStr) {
                            section += `**${readableKey}**: ${formattedStr}\n`;
                        }
                    }
                }
                if (!hasData) return "";
                section += `\n`;
            }
            return section;
        };

        const sections = [
            'metadata', 'basic_info', 'appearance', 'personality',
            'biography', 'relationships', 'secrets', 'capabilities',
            'kinks_and_sexuality', 'narrative', 'description', 'example_dialogues'
        ];

        sections.forEach(sec => {
            if (props[sec]) {
                const title = sec.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                md += formatSection(title, props[sec]);
            }
        });

        // Add Graph Relationships
        const connectedEdges = Array.from(graphStorage.edges.values()).filter(e => e.source === nodeId || e.target === nodeId);
        if (connectedEdges.length > 0) {
            md += `## Graph Relationships\n`;
            connectedEdges.forEach(e => {
                const otherId = e.source === nodeId ? e.target : e.source;
                const otherNode = graphStorage.getNode(otherId);
                if (otherNode) {
                    const direction = e.source === nodeId ? "➡" : "⬅";
                    const label = e.label ? `[${e.label}]` : "";
                    md += `- ${direction} **${otherNode.label}** ${label}\n`;
                }
            });
            md += `\n`;
        }

        md += "---\n\n";
        return md;
    }

    _showImportModal(nodeId = null) {
        const old = document.querySelector('.modal-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:3000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;border-radius:8px;padding:20px;width:300px;max-width:90vw;color:white;box-shadow:0 0 30px rgba(0,0,0,0.8);';

        const title = nodeId ? `Import Character` : `Import Graph`;

        modal.innerHTML = `
            <h3 style="margin-top:0">${title}</h3>
            <p style="font-size:0.9em; color:#ccc; margin-bottom:15px;">
                ${nodeId ? `Importing a character will allow you to select which fields to overwrite.` : `Importing a JSON file will either replace your graph OR apply structural updates (additions, modifications, deletions) if the file follows the update schema.`}
            </p>
            
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="import-file-btn" style="background:#3a5a5a; padding:10px; border:none; border-radius:4px; color:white; cursor:pointer;">📂 Select .JSON File</button>
                <button id="import-clip-btn" style="background:#5a3a8a; padding:10px; border:none; border-radius:4px; color:white; cursor:pointer;">📋 Paste from Clipboard</button>
                <button id="import-cancel-btn" style="background:#8a3a3a; padding:10px; border:none; border-radius:4px; color:white; cursor:pointer;">Cancel</button>
            </div>
            <input type="file" id="import-file-input" accept=".json" style="display:none;">
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const handleData = (data) => {
            const isAdditive = data && (
                (data.new_relationships && Array.isArray(data.new_relationships)) ||
                (data.new_nodes && Array.isArray(data.new_nodes)) ||
                (data.modified_nodes && Array.isArray(data.modified_nodes)) ||
                (data.deleted_nodes && Array.isArray(data.deleted_nodes)) ||
                (data.modified_relationships && Array.isArray(data.modified_relationships)) ||
                (data.deleted_relationships && Array.isArray(data.deleted_relationships))
            );

            if (isAdditive) {
                this._showAdditiveImportModal(data);
            } else if (nodeId) {
                const incomingChar = data.character || data;
                this._showImportComparisonModal(nodeId, incomingChar);
            } else {
                if (confirm('This will replace your current graph. Are you sure?')) {
                    graphStorage.importJSON(data);
                    alert('Graph imported successfully');
                    window.__vis.heat(1.0);
                }
            }
            overlay.remove();
        };

        const fileInput = modal.querySelector('#import-file-input');
        modal.querySelector('#import-file-btn').onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                try {
                    const data = JSON.parse(re.target.result);
                    handleData(data);
                } catch (err) {
                    alert('Invalid JSON file');
                }
            };
            reader.readAsText(file);
        };

        modal.querySelector('#import-clip-btn').onclick = async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (!text) {
                    alert("Clipboard is empty.");
                    return;
                }
                const data = JSON.parse(text);
                handleData(data);
            } catch (err) {
                console.error("Clipboard import failed:", err);
                alert("Failed to read or parse JSON from clipboard. Please make sure valid JSON is copied before clicking this.");
            }
        };

        modal.querySelector('#import-cancel-btn').onclick = () => overlay.remove();
    }

    _showAdditiveImportModal(data) {
        // 1. Initialize Local State for all categories
        let localNewNodes = (data.new_nodes || []).map(n => ({
            ...n,
            _id: Math.random().toString(36).substr(2, 9),
            selected: true,
            editing: false,
            category: 'new',
            hasProperties: !!(n.properties && Object.keys(n.properties).length > 0)
        }));
        let localNewRels = (data.new_relationships || []).map(r => ({ ...r, _id: Math.random().toString(36).substr(2, 9), selected: true, editing: false, category: 'new' }));

        let localModNodes = (data.modified_nodes || []).map(n => {
            const original = graphStorage.getNode(n.id);
            return {
                ...n,
                _id: Math.random().toString(36).substr(2, 9),
                original,
                selected: true,
                editing: false,
                category: 'mod',
                hasProperties: !!(n.updated_properties && Object.keys(n.updated_properties).length > 0)
            };
        }).filter(n => n.original);

        let localDelNodes = (data.deleted_nodes || []).map(n => {
            const original = graphStorage.getNode(n.id);
            return { ...n, _id: Math.random().toString(36).substr(2, 9), original, selected: true, category: 'del' };
        }).filter(n => n.original);

        let localModRels = (data.modified_relationships || []).map(r => {
            const original = graphStorage.edges.get(r.id);
            return {
                ...r,
                _id: Math.random().toString(36).substr(2, 9),
                original,
                selected: true,
                editing: false,
                category: 'mod',
                hasAttributes: !!(r.updated_attributes && Object.keys(r.updated_attributes).length > 0) || !!r.updated_color
            };
        }).filter(r => r.original);

        let localDelRels = (data.deleted_relationships || []).map(r => {
            const original = graphStorage.edges.get(r.id);
            return { ...r, _id: Math.random().toString(36).substr(2, 9), original, selected: true, category: 'del' };
        }).filter(r => r.original);

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:4000;display:flex;align-items:flex-start;justify-content:center;padding-top:5vh;overflow-y:auto;';

        const modal = document.createElement('div');
        modal.className = 'import-modal';
        modal.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;border-radius:8px;padding:20px;width:800px;max-width:95vw;color:white;box-shadow:0 0 40px rgba(0,0,0,0.9); margin-bottom:5vh;';

        const render = () => {
            const totalCount = localNewNodes.length + localNewRels.length + localModNodes.length + localDelNodes.length + localModRels.length + localDelRels.length;

            let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h2 style="margin:0;color:#aaccff;">Graph Update Review (${totalCount} Ops)</h2>
                <button id="add-imp-close" style="background:transparent;color:#ccc;border:none;font-size:1.5em;cursor:pointer;">&times;</button>
            </div>
            <p style="color:#aaa;font-size:0.9em;">Review proposed additions, modifications, and deletions.</p>
            
            <div style="margin-bottom:15px; display:flex; gap:10px;">
                <button id="add-sel-all" style="background:#3a4a6a;border:none;color:white;padding:5px 10px;border-radius:3px;cursor:pointer;">Select All</button>
                <button id="add-sel-none" style="background:#3a4a6a;border:none;color:white;padding:5px 10px;border-radius:3px;cursor:pointer;">Deselect All</button>
            </div>

            <div id="add-imp-sections" style="display:flex; flex-direction:column; gap:20px; max-height:60vh; overflow-y:auto; border:1px solid #3a4a6a; padding:10px; background:#111122; border-radius:4px;">
        `;

            // --- SECTION: NEW NODES (unchanged, with full properties support) ---
            if (localNewNodes.length > 0) {
                html += `<h3 style="margin-top:10px; margin:0; color:#88ffaa; border-bottom:1px solid #2a5a3a; padding-bottom:5px;">🆕 Proposed New Nodes</h3>`;
                localNewNodes.forEach((node) => {
                    const lowerName = (node.name || "").toLowerCase().trim();
                    const alreadyExists = Array.from(graphStorage.nodes.values()).some(n => n.label.toLowerCase().trim() === lowerName);
                    const displayLabel = node.properties?.basic_info?.name?.full || node.name || 'Unnamed';
                    const displayType = node.type || 'concept';
                    const displayDesc = node.properties?.description || node.description || '';
                    const hasFullProps = node.hasProperties || !!(node.properties && Object.keys(node.properties).length > 0);

                    html += `
                    <div class="import-row" style="display:flex; align-items:flex-start; padding:10px; border-bottom:1px solid #1a3a2a; ${alreadyExists ? 'background:rgba(255,100,0,0.05);' : ''}">
                        <input type="checkbox" class="node-cb" data-id="${node._id}" ${node.selected ? 'checked' : ''} style="margin-top:4px; margin-right:15px; transform:scale(1.2);">
                        <div style="flex:1;">
                            ${node.editing ? `
                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:5px;">
                                    <input type="text" class="edit-node-name" data-id="${node._id}" value="${node.name}" style="background:#252540; color:white; border:1px solid #5a6a8a; padding:4px;">
                                    <select class="edit-node-type" data-id="${node._id}" style="background:#252540; color:white; border:1px solid #5a6a8a; padding:4px;">
                                        <option value="person" ${node.type === 'person' ? 'selected' : ''}>Person</option>
                                        <option value="location" ${node.type === 'location' ? 'selected' : ''}>Location</option>
                                        <option value="item" ${node.type === 'item' ? 'selected' : ''}>Item</option>
                                        <option value="concept" ${node.type === 'concept' ? 'selected' : ''}>Concept</option>
                                    </select>
                                </div>
                                <textarea class="edit-node-desc" data-id="${node._id}" style="width:100%; height:40px; background:#252540; color:white; border:1px solid #5a6a8a; padding:4px; font-size:0.85em;" placeholder="Description">${node.description || ''}</textarea>
                            ` : `
                                <div style="font-weight:bold; color:${alreadyExists ? '#ffaa88' : '#88ffaa'};">
                                    ${displayLabel} ${alreadyExists ? '<span style="color:#ff6666; font-size:0.8em; margin-left:10px;">(Already Exists)</span>' : ''}
                                    <span style="font-size:0.8em; color:#aaa; font-weight:normal;">(${displayType})</span>
                                    ${hasFullProps ? ' <span style="color:#88ccff; font-size:0.8em;">📦 full</span>' : ''}
                                </div>
                                <div style="font-size:0.85em; color:#aaa;">${displayDesc}</div>
                            `}
                        </div>
                        <div style="display:flex; gap:5px; margin-left:15px;">
                            <button class="node-edit-btn" data-id="${node._id}" style="background:transparent; border:none; color:#aaccff; cursor:pointer;">${node.editing ? '💾' : '✏️'}</button>
                            <button class="node-del-btn" data-id="${node._id}" style="background:transparent; border:none; color:#ff8888; cursor:pointer;">🗑️</button>
                        </div>
                    </div>
                `;
                });
            }

            // --- SECTION: MODIFIED NODES (enhanced with property updates) ---
            if (localModNodes.length > 0) {
                html += `<h3 style="margin:0; color:#ffcc88; border-bottom:1px solid #5a4a3a; padding-bottom:5px;">🔄 Modified Nodes</h3>`;
                localModNodes.forEach(node => {
                    const hasPropUpdates = node.hasProperties || !!(node.updated_properties && Object.keys(node.updated_properties).length > 0);
                    html += `
                    <div class="import-row" style="display:flex; align-items:flex-start; padding:10px; border-bottom:1px solid #3a2a1a; background:rgba(255,200,100,0.03);">
                        <input type="checkbox" class="mod-node-cb" data-id="${node._id}" ${node.selected ? 'checked' : ''} style="margin-top:4px; margin-right:15px; transform:scale(1.2);">
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:15px; margin-bottom:5px; flex-wrap:wrap;">
                                <div style="color:#888; font-size:0.9em; text-decoration:line-through;">${node.original.label || 'unlabeled'}</div>
                                <div style="color:#aaccff;">➡️</div>
                                <div style="font-weight:bold; color:#ffcc88;">${node.updated_label || node.original.label}</div>
                                <span style="font-size:0.8em; color:#aaa;">(${node.updated_type || node.original.type})</span>
                                ${hasPropUpdates ? ' <span style="color:#88ccff; font-size:0.8em;">📦 props</span>' : ''}
                            </div>
                            <div style="font-size:0.85em; color:#aaa; border-left:2px solid #5a4a3a; padding-left:10px;">
                                ${node.updated_description || node.original.properties.description || ''}
                            </div>
                        </div>
                        <div style="margin-left:15px;">
                            <button class="mod-node-del-btn" data-id="${node._id}" style="background:transparent; border:none; color:#ff8888; cursor:pointer;">&times;</button>
                        </div>
                    </div>
                `;
                });
            }

            // --- SECTION: DELETED NODES (unchanged) ---
            if (localDelNodes.length > 0) {
                html += `<h3 style="margin-top:10px; margin-bottom:0; color:#ff8888; border-bottom:1px solid #5a2a2a; padding-bottom:5px;">🗑️ Deleted Nodes</h3>`;
                localDelNodes.forEach(node => {
                    html += `
                    <div class="import-row" style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #3a1a1a; background:rgba(255,50,50,0.05);">
                        <input type="checkbox" class="del-node-cb" data-id="${node._id}" ${node.selected ? 'checked' : ''} style="margin-right:15px; transform:scale(1.2);">
                        <div style="flex:1; color:#ffaaaa; font-weight:bold;">${node.original.label} <span style="font-weight:normal; color:#888; font-size:0.9em;">(${node.original.type})</span></div>
                        <button class="del-node-rem-btn" data-id="${node._id}" style="background:transparent; border:none; color:#ff8888; cursor:pointer;">&times;</button>
                    </div>
                `;
                });
            }

            // --- SECTION: MODIFIED RELATIONSHIPS (enhanced attribute display) ---
            if (localModRels.length > 0) {
                html += `<h3 style="margin-top:10px; color:#ffcc88; border-bottom:1px solid #5a4a3a; padding-bottom:5px;">🔄 Modified Relationships</h3>`;
                localModRels.forEach(rel => {
                    const s = graphStorage.getNode(rel.original.source)?.label || 'Unknown';
                    const t = graphStorage.getNode(rel.original.target)?.label || 'Unknown';
                    const hasAttr = rel.hasAttributes;
                    html += `
                    <div class="import-row" style="display:flex; align-items:flex-start; padding:10px; border-bottom:1px solid #3a2a1a; background:rgba(255,200,100,0.03);">
                        <input type="checkbox" class="mod-rel-cb" data-id="${rel._id}" ${rel.selected ? 'checked' : ''} style="margin-top:4px; margin-right:15px; transform:scale(1.2);">
                        <div style="flex:1;">
                            <div style="font-size:0.8em; color:#888; margin-bottom:2px;">${s} ➡ ${t}</div>
                            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                                <div style="color:#888; text-decoration:line-through; font-size:0.9em;">${rel.original.label || 'unlabeled'}</div>
                                <div style="color:#aaccff;">➡️</div>
                                <div style="font-weight:bold; color:#ffcc88;">${rel.updated_label || rel.original.label}</div>
                                ${hasAttr ? ' <span style="color:#88ccff; font-size:0.8em;">⚙️ attr</span>' : ''}
                            </div>
                            <div style="font-size:0.8em; color:#aaa; font-style:italic;">${rel.updated_description || rel.original.description || ''}</div>
                        </div>
                        <button class="mod-rel-rem-btn" data-id="${rel._id}" style="background:transparent; border:none; color:#ff8888; cursor:pointer;">&times;</button>
                    </div>
                `;
                });
            }

            if (localDelRels.length > 0) {
                html += `<h3 style="margin-top:10px; color:#ff8888; border-bottom:1px solid #5a2a2a; padding-bottom:5px;">🗑️ Deleted Relationships</h3>`;
                localDelRels.forEach(rel => {
                    const s = graphStorage.getNode(rel.original.source)?.label || 'Unknown';
                    const t = graphStorage.getNode(rel.original.target)?.label || 'Unknown';
                    html += `
                    <div class="import-row" style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #3a1a1a; background:rgba(255,50,50,0.05);">
                        <input type="checkbox" class="del-rel-cb" data-id="${rel._id}" ${rel.selected ? 'checked' : ''} style="margin-right:15px; transform:scale(1.2);">
                        <div style="flex:1; color:#ffaaaa;">${s} <span style="color:#888;">--[${rel.original.label || ''}]--></span> ${t}</div>
                        <button class="del-rel-rem-btn" data-id="${rel._id}" style="background:transparent; border:none; color:#ff8888; cursor:pointer;">&times;</button>
                    </div>
                `;
                });
            }

            if (localNewRels.length > 0) {
                html += `<h3 style="margin-top:10px; color:#88ccff; border-bottom:1px solid #2a3a5a; padding-bottom:5px;">🔗 New Relationships</h3>`;
                localNewRels.forEach(rel => {
                    html += `
                    <div class="import-row" style="display:flex; align-items:flex-start; padding:10px; border-bottom:1px solid #1a2a3a;">
                        <input type="checkbox" class="new-rel-cb" data-id="${rel._id}" ${rel.selected ? 'checked' : ''} style="margin-top:4px; margin-right:15px; transform:scale(1.2);">
                        <div style="flex:1;">
                            <div style="font-weight:bold;">${rel.source_name} ➡ ${rel.target_name} <span style="color:#aaccff;">[${rel.label || ''}]</span></div>
                            <div style="font-size:0.85em; color:#aaa;">${rel.description || ''}</div>
                        </div>
                        <button class="new-rel-del-btn" data-id="${rel._id}" style="background:transparent; border:none; color:#ff8888; cursor:pointer;">&times;</button>
                    </div>
                `;
                });
            }

            html += `
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button id="add-imp-cancel" style="background:#5a3a3a; color:white; border:none; padding:10px 20px; border-radius:4px; cursor:pointer; font-weight:bold;">Cancel</button>
                <button id="add-imp-apply" style="background:#3a8a5a; color:white; border:none; padding:10px 20px; border-radius:4px; cursor:pointer; font-weight:bold;">Apply Changes</button>
            </div>
        `;

            modal.innerHTML = html;

            // --- EVENT LISTENERS ---
            modal.querySelector('#add-imp-close').onclick = closeFunc;
            modal.querySelector('#add-imp-cancel').onclick = closeFunc;
            modal.querySelector('#add-sel-all').onclick = () => {
                [localNewNodes, localNewRels, localModNodes, localDelNodes, localModRels, localDelRels].forEach(arr => arr.forEach(i => i.selected = true));
                render();
            };
            modal.querySelector('#add-sel-none').onclick = () => {
                [localNewNodes, localNewRels, localModNodes, localDelNodes, localModRels, localDelRels].forEach(arr => arr.forEach(i => i.selected = false));
                render();
            };

            // Individual checkboxes
            modal.querySelectorAll('.node-cb, .new-rel-cb, .mod-node-cb, .del-node-cb, .mod-rel-cb, .del-rel-cb').forEach(cb => cb.onchange = (e) => {
                const id = e.target.dataset.id;
                [localNewNodes, localNewRels, localModNodes, localDelNodes, localModRels, localDelRels].forEach(arr => {
                    const item = arr.find(i => i._id === id);
                    if (item) item.selected = e.target.checked;
                });
            });

            // Delete buttons (local removal)
            modal.querySelectorAll('[class*="-del-btn"], [class*="-rem-btn"]').forEach(btn => btn.onclick = () => {
                const id = btn.dataset.id;
                localNewNodes = localNewNodes.filter(n => n._id !== id);
                localNewRels = localNewRels.filter(r => r._id !== id);
                localModNodes = localModNodes.filter(n => n._id !== id);
                localDelNodes = localDelNodes.filter(n => n._id !== id);
                localModRels = localModRels.filter(r => r._id !== id);
                localDelRels = localDelRels.filter(r => r._id !== id);
                render();
            });

            // Edit button (New Nodes only)
            modal.querySelectorAll('.node-edit-btn').forEach(btn => btn.onclick = () => {
                const node = localNewNodes.find(n => n._id === btn.dataset.id);
                if (node) {
                    if (node.editing) {
                        // Save edits
                        node.name = modal.querySelector(`.edit-node-name[data-id="${node._id}"]`).value;
                        node.type = modal.querySelector(`.edit-node-type[data-id="${node._id}"]`).value;
                        node.description = modal.querySelector(`.edit-node-desc[data-id="${node._id}"]`).value;
                        // Keep properties unchanged
                    }
                    node.editing = !node.editing;
                    render();
                }
            });

            modal.querySelector('#add-imp-apply').onclick = () => {
                // 1. Process Deletions
                localDelNodes.filter(n => n.selected).forEach(n => graphStorage.deleteNode(n.id));
                localDelRels.filter(r => r.selected).forEach(r => graphStorage.deleteEdge(r.id));

                // 2. Process Modifications
                localModNodes.filter(n => n.selected).forEach(n => {
                    const updates = {};
                    if (n.updated_label) updates.label = n.updated_label;
                    if (n.updated_type) updates.visualType = n.updated_type === 'sprite' ? 'sprite' : 'sphere';

                    // Handle property updates
                    if (n.updated_properties) {
                        // Deep merge with existing properties
                        const currentProps = n.original.properties || {};
                        updates.properties = { ...currentProps, ...n.updated_properties };
                    } else if (n.updated_description) {
                        // Fallback to updating only description
                        updates.properties = { ...n.original.properties, description: n.updated_description };
                    }

                    graphStorage.updateNode(n.id, updates);
                });

                localModRels.filter(r => r.selected).forEach(r => {
                    const updates = {};
                    if (r.updated_label) updates.label = r.updated_label;
                    if (r.updated_description) updates.description = r.updated_description;
                    if (r.updated_attributes || r.updated_color) {
                        updates.attributes = {
                            ...(r.original.attributes || {}),
                            ...(r.updated_attributes || {})
                        };
                        if (r.updated_color) updates.attributes.color = r.updated_color;
                    }
                    graphStorage.updateEdge(r.id, updates);
                });

                // 3. Process Additions
                const tempNodeMap = new Map(); // maps node name (as provided) to new ID
                localNewNodes.filter(n => n.selected).forEach(node => {
                    const id = graphStorage.createNode(node.type || 'concept');
                    let properties = node.properties ? { ...node.properties } : {};
                    if (node.description && !properties.description) {
                        properties.description = node.description;
                    }
                    const label = properties?.basic_info?.name?.full || node.name || 'Unnamed';
                    graphStorage.updateNode(id, {
                        label: label,
                        properties: properties
                    });
                    // Store by original name (lowercased) for relationship matching
                    const key = node.name?.toLowerCase().trim() || label.toLowerCase().trim();
                    tempNodeMap.set(key, id);
                    console.log(`✅ Created new node: "${node.name}" (${node.type}) with ID ${id}`);
                });

                // Helper: find node ID by label (case‑insensitive, trimmed)
                const findNodeIdByName = (name) => {
                    if (!name) return null;
                    const lower = name.toLowerCase().trim();
                    // Check newly created nodes first
                    if (tempNodeMap.has(lower)) {
                        console.log(`Found "${name}" in new nodes, ID: ${tempNodeMap.get(lower)}`);
                        return tempNodeMap.get(lower);
                    }
                    // Then search existing graph
                    for (const [id, node] of graphStorage.nodes) {
                        if (node.label.toLowerCase().trim() === lower) {
                            console.log(`Found "${name}" in existing graph, ID: ${id}`);
                            return id;
                        }
                    }
                    console.warn(`❌ Could not find node with label: "${name}"`);
                    return null;
                };

                // Process new relationships
                localNewRels.filter(r => r.selected).forEach(rel => {
                    console.group(`Processing new relationship: ${rel.source_name} → ${rel.target_name}`);

                    const sourceId = findNodeIdByName(rel.source_name);
                    const targetId = findNodeIdByName(rel.target_name);

                    if (!sourceId || !targetId) {
                        console.warn('❌ Skipping relationship due to missing source/target');
                        console.groupEnd();
                        return;
                    }

                    // Create the edge
                    const edgeId = graphStorage.createEdge(sourceId, targetId);
                    if (!edgeId) {
                        console.error('❌ Failed to create edge');
                        console.groupEnd();
                        return;
                    }
                    console.log(`✅ Edge created with ID: ${edgeId}`);

                    // Prepare updates
                    const edgeUpdates = {};
                    if (rel.label) edgeUpdates.label = rel.label;
                    if (rel.description) edgeUpdates.description = rel.description;
                    if (rel.attributes || rel.color) {
                        edgeUpdates.attributes = { ...(rel.attributes || {}) };
                        if (rel.color) edgeUpdates.attributes.color = rel.color;
                    }

                    // Apply updates
                    if (Object.keys(edgeUpdates).length > 0) {
                        graphStorage.updateEdge(edgeId, edgeUpdates);
                        console.log('✅ Edge updated with:', edgeUpdates);
                    } else {
                        console.log('ℹ️ No updates to apply');
                    }

                    // Handle bidirectional flag
                    if (rel.bidirectional) {
                        graphStorage.ensureBidirectional(edgeId);
                        console.log('✅ Bidirectional ensured');
                    }

                    console.groupEnd();
                });

                window.__vis.heat(1.0);
                alert('Graph update applied successfully.');
                closeFunc();
            };
        };

        const closeFunc = () => document.body.removeChild(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) closeFunc(); };
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        render();
    }

    _showImportComparisonModal(nodeId, incoming) {
        const node = graphStorage.getNode(nodeId);
        if (!node) return;
        const current = node.properties;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'import-modal';

        // Map sections
        const sections = [
            'metadata', 'basic_info', 'appearance', 'personality',
            'biography', 'relationships', 'secrets', 'capabilities',
            'kinks_and_sexuality', 'narrative', 'example_dialogues', 'media'
        ];

        let html = `<h3>Selective Import: ${incoming.basic_info?.name?.full || 'Unknown'}</h3>`;
        html += `<p style="font-size:0.8em; color:#aaa; margin-bottom:15px;">Target: ${node.label} (ID: ${nodeId})</p>`;
        html += `
            <div class="import-section-row import-header">
                <div></div>
                <div>Section</div>
                <div>Current Preview</div>
                <div>Incoming Preview</div>
            </div>
        `;

        sections.forEach(key => {
            const currentVal = JSON.stringify(current[key] || {});
            const incomingVal = JSON.stringify(incoming[key] || {});
            const isDifferent = currentVal !== incomingVal;

            html += `
                <div class="import-section-row">
                    <input type="checkbox" class="import-toggle" data-key="${key}" ${isDifferent ? 'checked' : ''}>
                    <div style="text-transform: capitalize;">${key.replace(/_/g, ' ')}</div>
                    <div class="import-diff-old">${currentVal.substring(0, 40)}...</div>
                    <div class="import-diff-new" style="${isDifferent ? 'color:#88ff88;' : ''}">${incomingVal.substring(0, 40)}...</div>
                </div>
            `;
        });

        html += `
            <div class="import-modal-buttons">
                <button id="cancel-import" style="background:#444;">Cancel</button>
                <button id="confirm-import" style="background:#4a8a4a;">Apply Selected</button>
            </div>
        `;

        console.log("Showing comparison modal for node:", nodeId, "with incoming data:", incoming);

        modal.innerHTML = html;
        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        document.getElementById('cancel-import').onclick = () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
        };

        document.getElementById('confirm-import').onclick = () => {
            try {
                const toggles = modal.querySelectorAll('.import-toggle');
                const selectedUpdates = {};
                toggles.forEach(t => {
                    if (t.checked) {
                        const key = t.dataset.key;
                        selectedUpdates[key] = incoming[key];
                    }
                });

                console.log("Applying updates:", selectedUpdates);
                this._applySelectiveImport(nodeId, selectedUpdates);
                document.body.removeChild(overlay);
                document.body.removeChild(modal);
            } catch (err) {
                console.error("Import confirmation failed:", err);
                alert("Import failed: " + err.message);
            }
        };
    }

    _applySelectiveImport(nodeId, updates) {
        const node = graphStorage.getNode(nodeId);
        if (!node) return;
        const newProps = { ...node.properties, ...updates };
        graphStorage.updateNode(nodeId, {
            label: newProps.basic_info?.name?.full || node.label,
            properties: newProps
        });
        this.buildPropertiesPanel(nodeId, 'node');
        window.__vis.heat(0.5);
    }
}

export default GraphUI;
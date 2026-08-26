// Properties panel rendering for nodes/edges/groups, form collection, extract popups
import * as THREE from 'three';
import graphStorage from '../storage.js';
import {
    renderOverviewTab,
    renderAppearanceTab,
    renderPersonalityTab,
    renderBiographyTab,
    renderRelationshipsTab,
    renderKinksTab
} from './tabs.js';
import { renderCharacterProperties } from './forms.js';

export const panelsMixin = {
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
    },

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
    },

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
        this._initResize(); // re-attach events
    },

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
    },

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
    },

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
    },

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
    },

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
};

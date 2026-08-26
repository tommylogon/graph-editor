// Global settings panel: search bar, Data/Physics/Style/AI tabs, graph save/load/create modals
import graphStorage from '../storage.js';

export const settingsMixin = {
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
    },

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
    },

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
    },

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
    },

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
};

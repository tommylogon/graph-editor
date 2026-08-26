// Import/merge modals: merge duplicates, additive graph updates, selective character import
import graphStorage from '../storage.js';

export const modalsMixin = {
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
    },

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

            this._mergeNodesWithCustomProperties(primary.id, others.map(n => n.id), mergedProps);

            overlay.remove();
            window.__vis.heat(1.0);
            alert('Merge complete!');
        };

        document.getElementById('merge-cancel').onclick = () => overlay.remove();
    },

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
    },

    // Flatten a nested object into dot-notation keys
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
    },

    // Get a value by dot-notation path
    _getValueByPath(obj, path) {
        return path.split('.').reduce((current, part) => current && current[part], obj);
    },

    // Set a value by dot-notation path (for constructing merged object)
    _setValueByPath(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const target = parts.reduce((current, part) => {
            if (!current[part] || typeof current[part] !== 'object') current[part] = {};
            return current[part];
        }, obj);
        target[last] = value;
    },

    // Check if all values in an array are equal (for conflict detection)
    _allEqual(arr) {
        return arr.every(v => JSON.stringify(v) === JSON.stringify(arr[0]));
    },

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
    },

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

                // Helper: find node ID by label (case-insensitive, trimmed)
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
    },

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
    },

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
};

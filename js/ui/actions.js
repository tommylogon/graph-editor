// Actions: node/group operations, selection state, save indicator, delegates to exportImport
import * as THREE from 'three';
import graphStorage from '../storage.js';
import { areNodesVisible, validateEdgeCreation } from './utils.js';
import {
    exportMarkdown,
    saveFile,
    refreshGraphList,
    showExportModal,
    _showExportModal
} from './exportImport.js';

export const actionsMixin = {
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
    },

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
    },

    toggleGroupCollapse(id) {
        const group = graphStorage.getNode(id);
        if (group) graphStorage.setGroupCollapsed(id, !group.collapsed);
        this.hideMenu();
    },

    ungroup(id) {
        if (confirm('Ungroup – members will become independent nodes.')) {
            graphStorage.ungroup(id);
            this.selectedIds.delete(id);
            this.propertiesPanel.style.display = 'none';
            this.hideMenu();
        }
    },

    editSelected(forcedId) {
        let id = forcedId !== undefined ? (typeof forcedId === 'number' ? forcedId : Number(forcedId)) : Array.from(this.selectedIds)[0];
        if (id !== undefined) {
            const node = graphStorage.getNode(id);
            const type = node ? 'node' : (this.selectedType || 'node');
            this.buildPropertiesPanel(id, type);
        }
        this.hideMenu();
    },

    startEdgeConnection(forcedId) {
        const id = forcedId !== undefined ? (typeof forcedId === 'number' ? forcedId : Number(forcedId)) : Array.from(this.selectedIds)[0];
        if (id !== undefined && (this.selectedType === 'node' || !this.selectedType)) {
            this.edgeSourceId = id;
            this.edgeHint.style.display = 'block';
        }
        this.hideMenu();
    },

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
    },

    connectAllTo(targetId) {
        const tId = typeof targetId === 'number' ? targetId : Number(targetId);
        this.selectedIds.forEach(sourceId => {
            if (sourceId !== tId && areNodesVisible(sourceId, tId)) {
                graphStorage.createEdge(sourceId, tId);
            }
        });
        this.hideMenu();
    },

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
    },

    exportJSON() {
        graphStorage.exportJSON();
        this.hideMenu();
    },

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
    },

    undo() {
        graphStorage.undo();
        window.__vis.heat(0.5);
    },

    redo() {
        graphStorage.redo();
        window.__vis.heat(0.5);
    },

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
    },

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
    },

    _showSaveIndicator() {
        if (!this.saveIndicator) return;
        this.saveIndicator.textContent = 'Saved ✓';
        this.saveIndicator.classList.add('visible');
        if (this._saveTimeout) clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => {
            if (this.saveIndicator) this.saveIndicator.classList.remove('visible');
        }, 2000);
    },

    hideMenu() {
        this.contextMenu.style.display = 'none';
    },

    // --- Delegates to ui/exportImport.js ---

    exportMarkdown() {
        return exportMarkdown();
    },

    async saveFile(content, defaultName, extension) {
        return saveFile(content, defaultName);
    },

    async refreshGraphList() {
        return refreshGraphList();
    },

    showExportModal(nodeId) {
        return showExportModal(nodeId);
    },

    _showExportModal(nodeId = null) {
        return _showExportModal(nodeId);
    },

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
    },

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
};

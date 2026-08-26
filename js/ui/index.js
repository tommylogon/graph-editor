// js/ui/index.js - GraphUI composer
// Base class holds construction, overlay creation, and shared statics.
// Concern fragments live in sibling modules and are mixed in below.
import * as THREE from 'three';
import { eventsMixin } from './events.js';
import { contextMenuMixin } from './contextMenu.js';
import { panelsMixin } from './panels.js';
import { actionsMixin } from './actions.js';
import { settingsMixin } from './settings.js';
import { modalsMixin } from './modals.js';

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

    hideMenu() {
        this.contextMenu.style.display = 'none';
    }

    // --- Field option presets (used by ui/forms.js via window.__ui.constructor.FIELD_OPTIONS) ---
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
}

Object.assign(GraphUI.prototype,
    eventsMixin,
    contextMenuMixin,
    panelsMixin,
    actionsMixin,
    settingsMixin,
    modalsMixin
);

export default GraphUI;

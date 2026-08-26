// js/ui/exportImport.js

import graphStorage from '../storage.js';

/**
 * Save content to a file (uses File System Access API if available).
 * @param {string} content - File content
 * @param {string} defaultName - Suggested filename
 * @returns {Promise<void>}
 */
export async function saveFile(content, defaultName) {
    const blob = new Blob([content], { type: 'text/plain' });

    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [{
                    description: 'Files',
                    accept: { 'application/json': ['.json'], 'text/markdown': ['.md'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (err) {
            console.log("User cancelled or picker failed, falling back.");
        }
    }

    // Fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Export the current graph as Markdown.
 */
export function exportMarkdown() {
    const content = _generateMarkdownContent();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graphStorage.graphName.replace(/\s+/g, '_')}_Profile.md`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Refresh the graph selector dropdown.
 */
export async function refreshGraphList() {
    const selector = document.getElementById('graph-selector');
    if (!selector) return;
    const list = await graphStorage.listStoredGraphs();
    selector.innerHTML = list.map(name =>
        `<option value="${name}" ${name === graphStorage.graphName ? 'selected' : ''}>${name}</option>`
    ).join('');

    selector.onchange = async (e) => {
        const data = await graphStorage.db.transaction('saveData').objectStore('saveData').get(`graph_${e.target.value}`);
        graphStorage.importJSON(data);
        location.reload();
    };
}

/**
 * Show export modal for a specific node (multi-hop export).
 * @param {number|string} nodeId
 */
export function showExportModal(nodeId) {
    const hops = prompt("How many hops to include in export? (0 = just this node, 1 = neighbors, etc.)", "1");
    if (hops === null) return;

    const subGraph = graphStorage.getNeighborSubGraph(nodeId, parseInt(hops));
    const json = JSON.stringify(subGraph, null, 2);
    saveFile(json, `export_${nodeId}_${hops}hops.json`);
}

/**
 * Internal: Show the full export modal (called from UI).
 * @param {number|null} nodeId
 */
export function _showExportModal(nodeId = null) {
    const old = document.querySelector('.modal-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:3000;display:flex;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1a1a2e;border:1px solid #5a6a8a;border-radius:8px;padding:20px;width:350px;max-width:90vw;color:white;box-shadow:0 0 30px rgba(0,0,0,0.8);';

    const title = nodeId ? `Export Character` : `Export Graph`;

    modal.innerHTML = `
        <h3 style="margin-top:0">${title}</h3>
        
        <label style="display:block;margin-top:15px;color:#aaccff;">Format</label>
        <label style="display:block;margin-top:5px;"><input type="radio" name="export-format" value="json" checked> JSON (Data Transfer)</label>
        <label style="display:block;margin-top:5px;"><input type="radio" name="export-format" value="md"> Markdown (Document / Context)</label>
        ${!nodeId ? `<label style="display:block;margin-top:5px;"><input type="radio" name="export-format" value="llm_template"> LLM Template (For Additive Import)</label>` : ''}
        <label style="display:block;margin-top:5px;"><input type="radio" name="export-format" value="sillytavern"> SillyTavern Lorebook (.json)</label>
        <label style="display:block;margin-top:5px;"><input type="radio" name="export-format" value="cypher"> Cypher Merge / Neo4j (.cypher)</label>
        
        <div id="export-md-options" style="display:none; margin-top:10px; padding:10px; background:#111122; border-radius:4px;">
            ${nodeId ? `
            <label style="display:block;color:#aaccff;font-size:0.9em;">Include connections up to X hops:</label>
            <input type="number" id="export-hops" value="0" min="0" max="10" style="width:100%; padding:5px; margin-top:5px; background:#1a1a2e; color:white; border:1px solid #5a6a8a; border-radius:4px;">
            <small style="color:#888;">0 = only this char, 1 = direct links, 2+ = extended</small>
            ` : `<small style="color:#888;">Complete graph documentation containing all characters, items, and relationships.</small>`}
        </div>
        
        <hr style="border-color:#5a6a8a; margin:15px 0;">
        
        <div style="display:flex; gap:10px;">
            <button id="export-file-btn" style="flex:1; background:#3a5a5a; padding:8px; border:none; border-radius:4px; color:white; cursor:pointer;">💾 File</button>
            <button id="export-clip-btn" style="flex:1; background:#4a4a8a; padding:8px; border:none; border-radius:4px; color:white; cursor:pointer;">📋 Copy</button>
            <button id="export-cancel-btn" style="flex:1; background:#8a3a3a; padding:8px; border:none; border-radius:4px; color:white; cursor:pointer;">Cancel</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const formatRadios = modal.querySelectorAll('input[name="export-format"]');
    const mdOptions = modal.querySelector('#export-md-options');

    formatRadios.forEach(r => r.addEventListener('change', (e) => {
        const val = e.target.value;
        mdOptions.style.display = ['md', 'sillytavern', 'cypher'].includes(val) ? 'block' : 'none';
    }));

    const doExport = (dest) => {
        const format = modal.querySelector('input[name="export-format"]:checked').value;
        let outputStr = '';
        let filename = '';
        const hops = nodeId ? (parseInt(modal.querySelector('#export-hops').value, 10) || 0) : 0;
        const activeFilters = window.__vis ? window.__vis.activeFilters : null;

        if (format === 'json') {
            if (nodeId) {
                const node = graphStorage.nodes.get(nodeId);
                if (!node) return;
                outputStr = JSON.stringify({ character: node.properties }, null, 2);
                const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
                filename = `${typeLabel}_${node.label.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
            } else {
                const data = graphStorage.exportJSON(activeFilters);
                outputStr = JSON.stringify(data, null, 2);
                filename = `${graphStorage.graphName.replace(/\s+/g, '_')}.json`;
            }
        } else if (format === 'llm_template') {
                // Enhanced template with full node/edge update capabilities
                const template = {
                    "new_nodes": [
                        {
                            "name": "Lyra Silvertongue",
                            "type": "person",
                            "description": "A brave young girl from Jordan College",
                            "properties": {
                                "basic_info": {
                                    "name": {
                                        "full": "Lyra Silvertongue",
                                        "first": "Lyra",
                                        "last": "Silvertongue"
                                    },
                                    "age": 12,
                                    "gender": "Female",
                                    "pronouns": "She/Her",
                                    "species": "Human"
                                },
                                "appearance": {
                                    "hair": { "color": "dark blonde", "length": "shoulder-length" },
                                    "eyes": { "color": "blue" }
                                },
                                "personality": {
                                    "traits": ["curious", "rebellious", "brave"]
                                }
                            }
                        },
                        {
                            "name": "The Rusty Nail",
                            "type": "location",
                            "description": "A dive bar on the edge of town",
                            "properties": {
                                "address": "123 Main St",
                                "atmosphere": "grimy",
                                "owner": "Unknown"
                            }
                        },
                        {
                            "name": "Golden Compass",
                            "type": "item",
                            "description": "An alethiometer that reveals truth",
                            "properties": {
                                "material": "gold",
                                "age": "ancient",
                                "powers": ["truth-telling"]
                            }
                        },
                        {
                            "name": "Dust",
                            "type": "concept",
                            "description": "Elementary particles associated with consciousness",
                            "properties": {
                                "visibility": "invisible to children",
                                "effect": "reveals truth"
                            }
                        }
                    ],
                    "new_relationships": [
                        {
                            "source_name": "Lyra Silvertongue",
                            "target_name": "Golden Compass",
                            "label": "owns",
                            "description": "Lyra's alethiometer, given by the Master",
                            "bidirectional": false,
                            "attributes": {
                                "strength": 0.9,
                                "color": "#88ffaa"
                            }
                        },
                        {
                            "source_name": "Lyra Silvertongue",
                            "target_name": "The Rusty Nail",
                            "label": "visits",
                            "description": "A secret meeting place",
                            "bidirectional": false,
                            "attributes": {
                                "strength": 0.5,
                                "color": "#ffaa88"
                            }
                        },
                        {
                            "source_name": "Golden Compass",
                            "target_name": "Dust",
                            "label": "measures",
                            "description": "The alethiometer can read Dust",
                            "bidirectional": true,
                            "attributes": {
                                "strength": 1.0,
                                "color": "#aa88ff"
                            }
                        }
                    ],
                    "modified_nodes": [
                        {
                            "id": "node_uuid_here",
                            "updated_label": "Lyra",
                            "updated_type": "sprite",
                            "updated_description": "Updated character bio...",
                            "updated_properties": {
                                "basic_info": {
                                    "age": 13,
                                    "occupation": "Alethiometer reader"
                                },
                                "personality": {
                                    "traits": ["curious", "rebellious", "brave", "determined"]
                                }
                            }
                        }
                    ],
                    "deleted_nodes": [
                        { "id": "node_uuid_to_remove" }
                    ],
                    "modified_relationships": [
                        {
                            "id": "edge_uuid_here",
                            "updated_label": "enemies",
                            "updated_description": "A bitter rivalry",
                            "updated_attributes": {
                                "strength": 1.0,
                                "color": "#ff0000"
                            }
                        }
                    ],
                    "deleted_relationships": [
                        { "id": "edge_uuid_to_remove" }
                    ]
                };
            outputStr = JSON.stringify(template, null, 2);
            filename = `llm_universal_update_template.json`;
        } else if (format === 'sillytavern') {
            const stData = _generateSillyTavernLorebook(activeFilters, nodeId, hops);
            outputStr = JSON.stringify(stData, null, 2);
            if (nodeId) {
                const node = graphStorage.nodes.get(nodeId);
                const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
                const hopStr = hops > 0 ? `_${hops}hops` : '';
                filename = `ST_Lorebook_${typeLabel}_${node.label.replace(/\s+/g, '_')}${hopStr}.json`;
            } else {
                filename = `ST_Lorebook_${graphStorage.graphName.replace(/\s+/g, '_')}.json`;
            }
        } else if (format === 'cypher') {
            outputStr = _generateCypherMerge(activeFilters, nodeId, hops);
            if (nodeId) {
                const node = graphStorage.nodes.get(nodeId);
                const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
                const hopStr = hops > 0 ? `_${hops}hops` : '';
                filename = `Graph_Export_${typeLabel}_${node.label.replace(/\s+/g, '_')}${hopStr}.cypher`;
            } else {
                filename = `Graph_Export_${graphStorage.graphName.replace(/\s+/g, '_')}.cypher`;
            }
        } else { // md
            if (nodeId) {
                outputStr = _generateMDStringForNode(nodeId, hops);
                const node = graphStorage.nodes.get(nodeId);
                const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
                const hopStr = hops > 0 ? `_${hops}hops` : '';
                filename = `${typeLabel}_${node.label.replace(/\s+/g, '_')}${hopStr}_${new Date().toISOString().slice(0, 10)}.md`;
            } else {
                outputStr = _generateMarkdownContent(activeFilters);
                filename = `${graphStorage.graphName.replace(/\s+/g, '_')}_Profile.md`;
            }
        }

        if (dest === 'file') {
            let mime = 'text/plain';
            if (format === 'json' || format === 'llm_template' || format === 'sillytavern') mime = 'application/json';
            else if (format === 'md') mime = 'text/markdown';
            else if (format === 'cypher') mime = 'application/x-cypher-query';

            const blob = new Blob([outputStr], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } else {
            navigator.clipboard.writeText(outputStr).then(() => {
                alert('Copied to clipboard!');
            }).catch(err => {
                alert('Failed to copy to clipboard: ' + err);
            });
        }
        overlay.remove();
    };

    modal.querySelector('#export-file-btn').onclick = () => doExport('file');
    modal.querySelector('#export-clip-btn').onclick = () => doExport('clip');
    modal.querySelector('#export-cancel-btn').onclick = () => overlay.remove();
}

// ========== Helper functions for exports ==========

function _generateMarkdownContent(activeFilters = null) {
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

function _generateSillyTavernLorebook(activeFilters, startNodeId = null, hops = 0) {
    let nodesToExport = [];
    if (startNodeId !== null) {
        const ids = _getNodesWithinHops(startNodeId, hops);
        nodesToExport = ids.map(id => graphStorage.getNode(id)).filter(Boolean);
    } else {
        nodesToExport = Array.from(graphStorage.nodes.values());
        if (activeFilters) {
            nodesToExport = nodesToExport.filter(n => activeFilters.has(n.type));
        }
    }

    const entries = {};
    nodesToExport.forEach((node, index) => {
        const keys = new Set();
        if (node.label) keys.add(node.label.trim());

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

        let content = _generateMDForNode(node.id).trim();

        entries[index.toString()] = {
            uid: index,
            key: Array.from(keys),
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

function _generateCypherMerge(activeFilters, startNodeId = null, hops = 0) {
    let nodesToExport = [];
    let validNodeIds = new Set();

    if (startNodeId !== null) {
        const ids = _getNodesWithinHops(startNodeId, hops);
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
        let relType = (edge.label || edge.type || "RELATED_TO").toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        if (!relType.match(/^[A-Z]/)) relType = "REL_" + relType;

        cypher += `MATCH (a {id: "${escapeStr(edge.source.toString())}"}), (b {id: "${escapeStr(edge.target.toString())}"})\n`;
        cypher += `MERGE (a)-[r:\`${relType}\`]->(b)\n`;

        let sets = [];
        if (edge.label) sets.push(`r.label = "${escapeStr(edge.label)}"`);
        if (edge.description) sets.push(`r.description = "${escapeStr(edge.description)}"`);
        if (edge.attributes?.strength !== undefined) sets.push(`r.strength = ${edge.attributes.strength}`);

        if (sets.length > 0) {
            cypher += `SET ${sets.join(', ')}`;
        }
        cypher += `;\n\n`;

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

function _getNodesWithinHops(startNodeId, maxHops) {
    const visited = new Map();
    const queue = [{ id: startNodeId, hops: 0 }];
    visited.set(startNodeId, 0);

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.hops >= maxHops) continue;

        const connectedEdges = Array.from(graphStorage.edges.values()).filter(e => e.source === current.id || e.target === current.id);
        for (const edge of connectedEdges) {
            const neighborId = edge.source === current.id ? edge.target : edge.source;
            if (!visited.has(neighborId)) {
                visited.set(neighborId, current.hops + 1);
                queue.push({ id: neighborId, hops: current.hops + 1 });
            }
        }
    }
    return Array.from(visited.keys());
}

function _generateMDStringForNode(nodeId, maxHops) {
    const nodeIdsToExport = _getNodesWithinHops(nodeId, maxHops);
    let fullMD = "";
    nodeIdsToExport.forEach(nId => {
        fullMD += _generateMDForNode(nId);
    });
    return fullMD;
}

function _generateMDForNode(nodeId) {
    const node = graphStorage.getNode(nodeId);
    if (!node) return "";
    let md = `# ${node.label}\n`;
    md += `**Type**: ${node.type}\n\n`;

    const props = node.properties;
    if (!props) return md + "---\n\n";

    const formatValue = (v) => {
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) {
            const formattedItems = v.map(item => formatValue(item)).filter(item => item !== "");
            return formattedItems.join(', ');
        }
        if (typeof v === 'object' && v !== null) {
            const entries = Object.entries(v)
                .filter(([_, val]) => val !== null && val !== "" && (Array.isArray(val) ? val.length > 0 : true))
                .map(([k, val]) => `${k.replace(/_/g, ' ')}: ${formatValue(val)}`);
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
                if (v && (typeof v === 'number' || typeof v === 'boolean' || v.length > 0 || (typeof v === 'object' && Object.keys(v).length > 0))) {
                    hasData = true;
                    const readableKey = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    let formattedStr = formatValue(v);
                    if (formattedStr.startsWith('{ ') && formattedStr.endsWith(' }')) {
                        formattedStr = formattedStr.substring(2, formattedStr.length - 2);
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
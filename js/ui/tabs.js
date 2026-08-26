// js/ui/tabs.js

import { renderCharacterProperties } from './forms.js';  // we'll create this later, but for now we'll keep it in ui.js

export function renderOverviewTab(props, container, startCollapsed = false) {
    const basic = props.basic_info || {};
    const name = basic.name || {};
    const overviewProps = {
        metadata: props.metadata || {},
        basic_info: {
            name: {
                full: name.full || '',
                first: name.first || '',
                last: name.last || '',
                nicknames: name.nicknames || [],
                aliases: name.aliases || []
            },
            age: basic.age || 25,
            birthdate: basic.birthdate || '',
            gender: basic.gender || '',
            pronouns: basic.pronouns || '',
            species: basic.species || 'Human',
            nationality: basic.nationality || '',
            ethnicity: basic.ethnicity || '',
            occupation: basic.occupation || '',
            residence: basic.residence || { type: '', name: '', unit: '', area: '', full_address: '' },
            marital_status: basic.marital_status || 'Single',
            partner: basic.partner || null
        }
    };
    renderCharacterProperties(overviewProps, container, [], startCollapsed);
}

export function renderAppearanceTab(props, container, startCollapsed = false, currentData, handleFileUpload) {
    // First render the appearance fields
    renderCharacterProperties({ appearance: props.appearance }, container, [], startCollapsed);

    // Then add the image upload section (not collapsible, always visible)
    const imageSection = document.createElement('div');
    imageSection.className = 'visual-section';
    imageSection.innerHTML = `
        <h4 style="margin:15px 0 10px; color:#aaccff;">Character Image</h4>
        <div class="image-preview-container">
            <img id="image-preview" src="${currentData?.imageUrl || ''}" style="display: ${currentData?.imageUrl ? 'block' : 'none'};">
        </div>
        <input type="text" id="node-image-url" value="${currentData?.imageUrl || ''}" placeholder="Image URL">
        <input type="file" id="node-image-upload" style="margin-top:5px; font-size:0.8em;">
        <label>Image Prompt (AI)</label>
        <textarea id="node-image-prompt" rows="2" placeholder="Describe the character...">${currentData?.imagePrompt || ''}</textarea>
        <label style="margin-top:10px; color:#88ffaa;">Vertical Layer (Tier)</label>
        <input type="number" id="node-layer" value="${currentData?.layer !== undefined && currentData?.layer !== null ? currentData.layer : ''}" placeholder="Leave blank to float freely">
    `;

    // Image preview handlers
    const urlInput = imageSection.querySelector('#node-image-url');
    const fileInput = imageSection.querySelector('#node-image-upload');
    const preview = imageSection.querySelector('#image-preview');
    urlInput.oninput = (e) => {
        preview.src = e.target.value;
        preview.style.display = e.target.value ? 'block' : 'none';
    };
    fileInput.onchange = async (e) => {
        const base64 = await handleFileUpload(e.target);
        if (base64) { preview.src = base64; preview.style.display = 'block'; }
    };

    container.appendChild(imageSection);
}

export function renderPersonalityTab(props, container, startCollapsed = false) {
    const personality = props.personality || {};
    const personalityProps = {
        personality: {
            traits: personality.traits || [],
            mbti: personality.mbti || '',
            alignment: personality.alignment || '',
            likes: personality.likes || [],
            dislikes: personality.dislikes || [],
            fears: personality.fears || [],
            aspirations: personality.aspirations || [],
            quirks: personality.quirks || [],
            habits: personality.habits || [],
            speech_pattern: personality.speech_pattern || { style: '', dialect: '', catchphrases: [] }
        }
    };
    renderCharacterProperties(personalityProps, container, [], startCollapsed);
}

export function renderBiographyTab(props, container, startCollapsed = false) {
    renderCharacterProperties({ biography: props.biography }, container, [], startCollapsed);
}

export function renderRelationshipsTab(props, container, startCollapsed = false) {
    const rel = props.relationships || {};
    const family = props.basic_info?.family || {};
    const relationshipsProps = {
        relationships: {
            connections: rel.connections || [],
            friends: rel.friends || [],
            enemies: rel.enemies || [],
            rivals: rel.rivals || [],
            mentors: rel.mentors || [],
            protégés: rel.protégés || [],
            family: {
                parents: family.parents || [],
                siblings: family.siblings || [],
                children: family.children || [],
                other_relations: family.other_relations || []
            }
        }
    };
    renderCharacterProperties(relationshipsProps, container, [], startCollapsed);
}

export function renderKinksTab(props, container, startCollapsed = false) {
    const kinks = props.kinks_and_sexuality || {};
    const media = props.media || {};
    const kinksProps = {
        kinks_and_sexuality: {
            orientation: kinks.orientation || '',
            experience: kinks.experience || '',
            preferences: kinks.preferences || [],
            turn_ons: kinks.turn_ons || [],
            turn_offs: kinks.turn_offs || [],
            curiosities: kinks.curiosities || [],
            boundaries: kinks.boundaries || []
        },
        media: {
            favorite_movies: media.favorite_movies || [],
            favorite_music: media.favorite_music || [],
            favorite_books: media.favorite_books || []
        },
        example_dialogues: props.example_dialogues || []
    };
    renderCharacterProperties(kinksProps, container, [], startCollapsed);
}
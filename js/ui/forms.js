export function renderCharacterProperties(data, container, path = [], startCollapsed = false) {
    for (const [key, value] of Object.entries(data)) {
        const currentPath = [...path, key];
        const fullPath = currentPath.join('.');
        const div = document.createElement('div');
        div.style.paddingLeft = path.length ? '10px' : '0';
        div.style.borderLeft = path.length ? '1px solid #3a4a6a' : 'none';
        div.style.marginBottom = '5px';

        const label = document.createElement('label');
        label.textContent = key.replace(/_/g, ' ').toUpperCase();
        label.style.fontWeight = path.length === 0 ? 'bold' : 'normal';
        label.style.color = path.length === 0 ? '#aaccff' : '#ccc';

        // --- Handle arrays FIRST ---
        if (Array.isArray(value)) {
            div.appendChild(label);
            if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                // Use window.__ui to call the original method
                window.__ui._renderObjectArray(value, div, currentPath);
            } else {
                const input = document.createElement('textarea');
                input.value = value.join(', ');
                input.rows = 2;
                input.dataset.type = 'array';
                input.dataset.path = fullPath;
                input.className = 'char-input';
                div.appendChild(input);
            }
            container.appendChild(div);
            continue;
        }

        // Handle objects
        if (value !== null && typeof value === 'object') {
            if (path.length === 0) {
                label.style.cursor = 'pointer';
                label.style.userSelect = 'none';
                const arrow = document.createElement('span');
                arrow.textContent = startCollapsed ? ' ▶' : ' ▼';
                arrow.style.fontSize = '0.7em';
                arrow.style.transition = 'transform 0.2s';
                label.appendChild(arrow);
                div.appendChild(label);

                const contentDiv = document.createElement('div');
                contentDiv.className = 'section-collapsible';
                if (startCollapsed) contentDiv.style.display = 'none';
                div.appendChild(contentDiv);

                label.onclick = () => {
                    const isHidden = contentDiv.style.display === 'none';
                    contentDiv.style.display = isHidden ? '' : 'none';
                    arrow.textContent = isHidden ? ' ▼' : ' ▶';
                };

                container.appendChild(div);
                renderCharacterProperties(value, contentDiv, currentPath, false); // recursive call
                continue;
            } else {
                div.appendChild(label);
                container.appendChild(div);
                renderCharacterProperties(value, div, currentPath, false);
                continue;
            }
        }

        // Handle primitive values
        div.appendChild(label);

        // Special handling for empty objects that should be arrays (we'll keep it)
        const arrayFields = ['likes', 'dislikes', 'fears', 'aspirations', 'quirks', 'habits', 'traits', 'nicknames', 'aliases', 'favorite_movies', 'favorite_music', 'favorite_books', 'participants'];
        const lastKey = currentPath[currentPath.length - 1];
        if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0 && arrayFields.includes(lastKey)) {
            // This case should have been caught earlier, but we'll leave it for safety
        }

        let fieldElement;
        let valueGetter;

        const options = window.__ui.constructor.FIELD_OPTIONS[fullPath]; // use the static property

        if (options) {
            // Combo-box setup
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.gap = '4px';
            wrapper.style.flex = '1';

            const select = document.createElement('select');
            select.style.flex = '1';
            select.innerHTML = `<option value="">-- Select --</option>`;
            options.forEach(opt => {
                select.innerHTML += `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`;
            });
            select.innerHTML += `<option value="__other__" ${value && !options.includes(value) ? 'selected' : ''}>Other...</option>`;

            const customInput = document.createElement('input');
            customInput.type = 'text';
            customInput.placeholder = 'Custom...';
            customInput.style.flex = '1';
            customInput.style.display = (value && !options.includes(value)) ? '' : 'none';
            customInput.value = (value && !options.includes(value)) ? value : '';
            customInput.className = 'char-input';
            customInput.dataset.path = fullPath;

            select.onchange = () => {
                if (select.value === '__other__') {
                    customInput.style.display = '';
                    customInput.focus();
                } else {
                    customInput.style.display = 'none';
                    customInput.value = select.value;
                }
            };
            if (!value || options.includes(value)) {
                customInput.value = value || '';
            }
            select.dataset.linkedInput = fullPath;
            select.className = 'char-combo-select';
            select.dataset.path = fullPath;

            wrapper.appendChild(select);
            wrapper.appendChild(customInput);

            fieldElement = wrapper;
            valueGetter = () => select.value === '__other__' ? customInput.value : select.value;

        } else if (typeof value === 'boolean') {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = value;
            input.dataset.path = fullPath;
            input.className = 'char-input';
            fieldElement = input;
        } else if (typeof value === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = value;
            input.dataset.path = fullPath;
            input.className = 'char-input';
            input.onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
            fieldElement = input;
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value || '';
            input.dataset.path = fullPath;
            input.className = 'char-input';
            input.onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
            fieldElement = input;
            valueGetter = () => input.value;
        }

        const EXTRACTABLE_FIELDS = [
            'description', 'address', 'location', 'participants', 'outcome',
            'basic_info.birthdate', 'basic_info.nationality', 'basic_info.ethnicity', 'basic_info.occupation',
            'basic_info.residence', 'basic_info.work_or_study',
            'basic_info.family.parents', 'basic_info.family.siblings', 'basic_info.family.children', 'basic_info.family.other_relations', 'basic_info.partner',
            'personality.traits', 'personality.alignment', 'personality.likes', 'personality.dislikes', 'personality.fears',
            'relationships.connections', 'relationships.friends', 'relationships.enemies', 'relationships.rivals', 'relationships.mentors', 'relationships.protégés',
            'media.favorite_movies', 'media.favorite_music', 'media.favorite_books'
        ];
        const isExtractable = EXTRACTABLE_FIELDS.includes(fullPath) && valueGetter;

        if (isExtractable) {
            const extWrapper = document.createElement('div');
            extWrapper.style.cssText = 'display:flex; gap:3px; align-items:flex-start;';
            fieldElement.style.flex = '1';
            fieldElement.classList.add('extractable-field');
            extWrapper.appendChild(fieldElement);

            const extractBtn = document.createElement('button');
            extractBtn.textContent = '🔗';
            extractBtn.className = 'extract-btn';
            extractBtn.title = 'Extract to Node';
            extractBtn.onclick = (e) => {
                e.preventDefault();
                // Use window.__ui to call the popup
                window.__ui._showExtractPopup(valueGetter(), window.__ui._editingNodeId, fullPath);
            };
            extWrapper.appendChild(extractBtn);
            div.appendChild(extWrapper);
        } else {
            div.appendChild(fieldElement);
        }

        container.appendChild(div);
    }
}